// POST /api/coach  { messages: [{role, content}], context: string }
// Guardrails: emergency + medical filters before any AI call, strict rules, a second check on every
// reply (fails closed), per-member daily + burst caps, a global daily cap, and flagged replies saved for review.
import { CAPS, COACH_RULES, PROVIDER_TEXT, checkPrompt, preFilter } from '../src/shared/guardrails.js';
import { admin, bumpUsage, claude, fail, handle, json, parseJson, requireUser, textOf } from './_lib.js';

export const POST = handle(async (request) => {
  const { user, profile } = await requireUser(request);
  const body = await request.json().catch(() => ({}));
  const history = (Array.isArray(body.messages) ? body.messages : [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-8).map(m => ({ role: m.role, content: m.content.slice(0, 1000) }));
  while (history.length && history[0].role !== 'user') history.shift();
  const last = history[history.length - 1];
  if (!last || last.role !== 'user') return fail('Send a message first.');

  const pre = preFilter(last.content);
  if (pre) return json({ kind: pre.kind, text: pre.text });

  const capMsg = await bumpUsage(user.id, 'coach', CAPS);
  if (capMsg) return json({ kind: 'limit', text: capMsg });

  const name = (profile.first_name || '').slice(0, 40) || 'there';
  const context = String(body.context || '').slice(0, 1500);
  const system = `${COACH_RULES}\n\nMember data. First name: ${name}. ${context}`;

  // Merge consecutive same-role turns (the API needs alternating roles).
  const msgs = [];
  for (const m of history) { if (msgs.length && msgs[msgs.length - 1].role === m.role) msgs[msgs.length - 1].content += '\n' + m.content; else msgs.push({ ...m }); }

  const reply = textOf(await claude({ system, messages: msgs, maxTokens: 400 }));
  if (!reply) return json({ kind: 'provider', text: PROVIDER_TEXT });

  let ok = false, reason = 'review unavailable';
  try {
    const check = parseJson(textOf(await claude({ system: 'You are a strict safety reviewer. Reply with JSON only.', messages: [{ role: 'user', content: checkPrompt(last.content, reply) }], maxTokens: 80 })));
    ok = check?.ok === true; reason = check?.reason || reason;
  } catch (e) { if (!(e instanceof Response)) console.error(e); }

  if (!ok) {
    await admin().from('flags').insert({ user_id: user.id, question: last.content.slice(0, 300), reply: reply.slice(0, 600), reason: String(reason).slice(0, 140) });
    return json({ kind: 'provider', text: PROVIDER_TEXT });
  }
  const { data: u } = await admin().from('usage').select('coach').eq('user_id', user.id).order('day', { ascending: false }).limit(1).single();
  return json({ kind: 'ok', text: reply, left: Math.max(0, CAPS.coachDay - (u?.coach || 0)) });
});

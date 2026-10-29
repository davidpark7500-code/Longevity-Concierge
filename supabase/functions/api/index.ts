// Supabase Edge Function "api": AI coach, meal estimates, Circle checkout/portal, admin, account deletion.
// Routes: POST /api/coach, POST /api/estimate, POST /api/checkout, POST /api/portal,
//         GET|POST /api/admin, POST /api/delete-account
// Secrets: ANTHROPIC_API_KEY (required), ANTHROPIC_MODEL, APP_TIMEZONE, AI_GLOBAL_DAILY_CAP, APP_URL,
//          STRIPE_SECRET_KEY, STRIPE_PRICE_CIRCLE. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import Stripe from 'npm:stripe@16.12.0';
import { CAPS, COACH_RULES, PROVIDER_TEXT, checkPrompt, estimatePrompt, preFilter } from './guardrails.js';

const env = (k: string, d = '') => Deno.env.get(k) ?? d;
const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'content-type': 'application/json' } });
const fail = (message: string, status = 400) => json({ error: message }, status);

async function requireUser(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) throw fail('Please sign in again.', 401);
  const { data: profile } = await db.from('profiles').select('*').eq('id', data.user.id).single();
  return { user: data.user, profile: profile || {} as Record<string, any> };
}

async function bumpUsage(uid: string, kind: 'coach' | 'est', dayCap?: number) {
  const { data, error } = await db.rpc('bump_usage', {
    uid, kind, tz: env('APP_TIMEZONE', 'America/Chicago'),
    day_cap: dayCap ?? (kind === 'coach' ? CAPS.coachDay : CAPS.estDay), burst_cap: CAPS.coachBurst, burst_min: CAPS.burstMin,
    global_cap: Number(env('AI_GLOBAL_DAILY_CAP', '3000')),
  });
  if (error) { console.error('bump_usage', error); return 'Something went wrong. Try again in a minute.'; }
  if (data === 'ok') return null;
  if (data === 'burst') return 'Let’s slow down a little. Try again in a few minutes.';
  if (data === 'global') return 'The coach is resting for today. Your habits and food log still work.';
  return kind === 'coach'
    ? 'You’ve reached today’s coach limit. It resets at midnight. Your habits and food log still work.'
    : 'You’ve used today’s AI estimates. Typing foods with amounts still works, and so does the Food finder.';
}

async function claude(system: string, messages: unknown[], maxTokens = 600) {
  if (!env('ANTHROPIC_API_KEY')) throw fail('The coach isn’t set up yet.', 503);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: env('ANTHROPIC_MODEL', 'claude-haiku-5-5'), max_tokens: maxTokens, system, messages }),
  });
  if (!res.ok) { console.error('anthropic', res.status, (await res.text()).slice(0, 500)); throw fail('The AI service is busy. Try again in a minute.', 502); }
  const msg = await res.json();
  return (msg.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim();
}
function parseJson(text: string): any {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/); if (fence) { try { return JSON.parse(fence[1]); } catch { /* */ } }
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a >= 0 && a < b) { try { return JSON.parse(text.slice(a, b + 1)); } catch { /* */ } }
  return null;
}

/* ---------- routes ---------- */
async function coach(req: Request) {
  const { user, profile } = await requireUser(req);
  const body = await req.json().catch(() => ({}));
  const history = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-8).map((m: any) => ({ role: m.role, content: m.content.slice(0, 1000) }));
  while (history.length && history[0].role !== 'user') history.shift();
  const last = history[history.length - 1];
  if (!last || last.role !== 'user') return fail('Send a message first.');
  const pre = preFilter(last.content); if (pre) return json({ kind: pre.kind, text: pre.text });
  const paid = profile.circle_active || ['essentials', 'performance', 'longevity'].includes(profile.tier);
  const dayCap = paid ? CAPS.coachDay : CAPS.coachDayFree;
  const cap = await bumpUsage(user.id, 'coach', dayCap); if (cap) return json({ kind: 'limit', text: cap });

  const msgs: any[] = [];
  for (const m of history) { if (msgs.length && msgs[msgs.length - 1].role === m.role) msgs[msgs.length - 1].content += '\n' + m.content; else msgs.push({ ...m }); }
  const system = `${COACH_RULES}\n\nMember data. First name: ${(profile.first_name || 'there').slice(0, 40)}. ${String(body.context || '').slice(0, 1500)}`;
  const reply = await claude(system, msgs, 400);
  if (!reply) return json({ kind: 'provider', text: PROVIDER_TEXT });

  let ok = false, reason = 'review unavailable';
  try {
    const c = parseJson(await claude('You are a strict safety reviewer. Reply with JSON only.', [{ role: 'user', content: checkPrompt(last.content, reply) }], 80));
    ok = c?.ok === true; reason = c?.reason || reason;
  } catch (e) { if (!(e instanceof Response)) console.error(e); }
  if (!ok) {
    await db.from('flags').insert({ user_id: user.id, question: last.content.slice(0, 300), reply: reply.slice(0, 600), reason: String(reason).slice(0, 140) });
    return json({ kind: 'provider', text: PROVIDER_TEXT });
  }
  const { data: u } = await db.from('usage').select('coach').eq('user_id', user.id).order('day', { ascending: false }).limit(1).single();
  return json({ kind: 'ok', text: reply, left: Math.max(0, dayCap - (u?.coach || 0)) });
}

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
async function estimate(req: Request) {
  const { user } = await requireUser(req);
  const body = await req.json().catch(() => ({}));
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 600) : '';
  const image = typeof body.image === 'string' ? body.image : '';
  if (!text && !image) return fail('Type what you ate or add a photo first.');
  if (image && (image.length > 6_000_000 || !TYPES.includes(body.mediaType))) return fail('That photo didn’t work. Try a smaller JPG or PNG.');
  const cap = await bumpUsage(user.id, 'est'); if (cap) return json({ limit: true, note: cap, items: [] });
  const content: any[] = [];
  if (image) content.push({ type: 'image', source: { type: 'base64', media_type: body.mediaType, data: image } });
  content.push({ type: 'text', text: estimatePrompt({ hasPhoto: !!image, text }) });
  const r = parseJson(await claude('You are a careful nutrition estimator. Reply with JSON only.', [{ role: 'user', content }], 900)) || {};
  const items = (Array.isArray(r.items) ? r.items : []).filter((x: any) => x && typeof x === 'object').slice(0, 15).map((x: any) => ({
    name: String(x.name || 'Food').slice(0, 80), amount: String(x.amount || '').slice(0, 40),
    grams: Math.min(3000, Math.max(0, Number(x.grams) || 0)),
    protein: Math.min(300, Math.max(0, Number(x.protein_g) || 0)), fiber: Math.min(150, Math.max(0, Number(x.fiber_g) || 0)),
    source: 'estimate',
  }));
  return json({ items, note: String(r.note || '').slice(0, 240) });
}

function stripe() {
  if (!env('STRIPE_SECRET_KEY')) throw fail('Payments aren’t set up yet.', 503);
  return new Stripe(env('STRIPE_SECRET_KEY'), { httpClient: Stripe.createFetchHttpClient() });
}
const appUrl = (req: Request) => env('APP_URL') || req.headers.get('origin') || 'https://longevityconcierge.vercel.app';
async function checkout(req: Request) {
  const { user, profile } = await requireUser(req);
  if (!env('STRIPE_PRICE_CIRCLE')) return fail('Payments aren’t set up yet.', 503);
  const s = stripe();
  let customer = profile.stripe_customer_id;
  if (!customer) {
    customer = (await s.customers.create({ email: user.email, metadata: { user_id: user.id } })).id;
    await db.from('profiles').update({ stripe_customer_id: customer }).eq('id', user.id);
  }
  const base = appUrl(req);
  const session = await s.checkout.sessions.create({
    mode: 'subscription', customer, client_reference_id: user.id,
    line_items: [{ price: env('STRIPE_PRICE_CIRCLE'), quantity: 1 }],
    subscription_data: { metadata: { user_id: user.id } },
    success_url: `${base}/?circle=joined`, cancel_url: `${base}/?circle=cancelled`, allow_promotion_codes: true,
  });
  return json({ url: session.url });
}
async function portal(req: Request) {
  const { profile } = await requireUser(req);
  if (!profile.stripe_customer_id) return fail('No subscription found.', 404);
  const s = await stripe().billingPortal.sessions.create({ customer: profile.stripe_customer_id, return_url: `${appUrl(req)}/` });
  return json({ url: s.url });
}

// Admin: David (is_admin) sees every team; a concierge sees only their own team.
async function adminRoute(req: Request) {
  const { user, profile } = await requireUser(req);
  // Teams are optional: if the concierges table isn't set up yet, admin works as a single team.
  const cq = await db.from('concierges').select('*').eq('user_id', user.id).maybeSingle();
  const teamsOn = !cq.error, self = teamsOn ? cq.data : null;
  const all = !!profile.is_admin;
  if (!all && !self) return fail('Admins only.', 403);
  const team = all ? null : self.id;
  const inTeam = async (memberId: string) => all || (await db.from('profiles').select('concierge_id').eq('id', memberId).single()).data?.concierge_id === team;
  const groupInTeam = async (groupId: string) => all || (await db.from('groups').select('concierge_id').eq('id', groupId).single()).data?.concierge_id === team;

  if (req.method === 'GET') {
    let pq = db.from('profiles').select('*').order('created_at', { ascending: false }).limit(1000);
    let gq = db.from('groups').select('*').order('created_at');
    if (team) { pq = pq.eq('concierge_id', team); gq = gq.eq('concierge_id', team); }
    const [{ data: profiles }, { data: groups }, { data: concierges }, usersRes] = await Promise.all([
      pq, gq, !teamsOn ? Promise.resolve({ data: [] }) : all ? db.from('concierges').select('*').order('created_at') : Promise.resolve({ data: [self] }),
      db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    const ids = new Set((profiles || []).map((p: any) => p.id));
    let fq = db.from('flags').select('*').eq('reviewed', false).order('created_at', { ascending: false }).limit(100);
    const { data: flagRows } = await fq;
    const flags = (flagRows || []).filter((f: any) => all || ids.has(f.user_id));
    const emails = Object.fromEntries((usersRes.data?.users || []).map((u: any) => [u.id, u.email]));
    const counts: Record<string, number> = {}; (profiles || []).forEach((p: any) => { counts[p.concierge_id] = (counts[p.concierge_id] || 0) + 1; });
    return json({
      scope: all ? 'all' : 'team', teams: teamsOn, self: self || null,
      concierges: (concierges || []).map((c: any) => ({ ...c, members: counts[c.id] || 0, login_email: c.user_id ? emails[c.user_id] || '' : '' })),
      members: (profiles || []).map((p: any) => ({ ...p, email: emails[p.id] || '' })), groups: groups || [], flags,
    });
  }
  const b = await req.json().catch(() => ({}));
  if (b.action === 'setTier' && ['free', 'essentials', 'performance', 'longevity'].includes(b.tier)) {
    if (!(await inTeam(b.id))) return fail('Not on your team.', 403);
    await db.from('profiles').update({ tier: b.tier }).eq('id', b.id);
  } else if (b.action === 'setGroup') {
    if (!(await inTeam(b.id)) || (b.groupId && !(await groupInTeam(b.groupId)))) return fail('Not on your team.', 403);
    await db.from('profiles').update({ group_id: b.groupId || null }).eq('id', b.id);
  } else if (b.action === 'reviewFlag') {
    const { data: f } = await db.from('flags').select('user_id').eq('id', b.id).single();
    if (!f || !(await inTeam(f.user_id))) return fail('Not on your team.', 403);
    await db.from('flags').update({ reviewed: true }).eq('id', b.id);
  } else if (b.action === 'setGroupCall') {
    if (!(await groupInTeam(b.id))) return fail('Not on your team.', 403);
    const link = String(b.callLink || '').trim().slice(0, 300);
    if (link && !/^https:\/\//.test(link)) return fail('Call links must start with https://');
    await db.from('groups').update({ next_call: String(b.nextCall || '').slice(0, 80), call_link: link || null }).eq('id', b.id);
  } else if (b.action === 'setContact') {
    if (!self) return fail('Only concierges have a contact button.', 403);
    const url = String(b.contactUrl || '').trim().slice(0, 300);
    if (url && !/^(https:\/\/|sms:|tel:|mailto:)/.test(url)) return fail('Use a link starting with sms:, tel:, mailto: or https://');
    await db.from('concierges').update({ contact_url: url || null, contact_label: String(b.contactLabel || '').trim().slice(0, 40) || null }).eq('id', self.id);
  } else if (b.action === 'addConcierge') {
    if (!all) return fail('Admins only.', 403);
    const name = String(b.name || '').trim().slice(0, 60), slug = String(b.slug || '').trim().toLowerCase();
    if (!name) return fail('Add their name.');
    if (!/^[a-z0-9-]{2,30}$/.test(slug)) return fail('Link name: 2 to 30 lowercase letters, numbers or dashes.');
    const url = String(b.contactUrl || '').trim().slice(0, 300);
    if (url && !/^(https:\/\/|sms:|tel:|mailto:)/.test(url)) return fail('Contact link must start with sms:, tel:, mailto: or https://');
    let uid: string | null = null;
    if (b.email) {
      const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
      uid = (list?.users || []).find((u: any) => u.email?.toLowerCase() === String(b.email).toLowerCase())?.id || null;
      if (!uid) return fail('No account with that email yet. Have them sign up in the app first, then add them.');
    }
    const { error } = await db.from('concierges').insert({ name, slug, user_id: uid, contact_url: url || null });
    if (error) return fail(/duplicate|unique/i.test(error.message) ? 'That link name or login is already used.' : 'Couldn’t add that concierge.');
  } else return fail('Unknown action.');
  return json({ ok: true });
}

async function deleteAccount(req: Request) {
  const { user, profile } = await requireUser(req);
  if (profile.stripe_customer_id && env('STRIPE_SECRET_KEY')) {
    try { const s = stripe(); const subs = await s.subscriptions.list({ customer: profile.stripe_customer_id, status: 'active' }); for (const x of subs.data) await s.subscriptions.cancel(x.id); }
    catch (e) { console.error('cancel subs', e); }
  }
  await db.auth.admin.deleteUser(user.id);
  return json({ ok: true });
}

const ROUTES: Record<string, (r: Request) => Promise<Response>> = { coach, estimate, checkout, portal, admin: adminRoute, 'delete-account': deleteAccount };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const route = new URL(req.url).pathname.split('/').filter(Boolean).pop() || '';
  const fn = ROUTES[route];
  if (!fn) return fail('Not found.', 404);
  if (req.method !== 'POST' && !(route === 'admin' && req.method === 'GET')) return fail('Method not allowed.', 405);
  try { return await fn(req); }
  catch (e) { if (e instanceof Response) return e; console.error(e); return fail('Something went wrong. Try again.', 500); }
});

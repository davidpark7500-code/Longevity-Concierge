// Shared helpers for server functions. Files starting with "_" are not routes.
import { createClient } from '@supabase/supabase-js';

export const env = (k, d) => process.env[k] ?? d;

let _admin;
export function admin() {
  if (!_admin) _admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  return _admin;
}

export const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
export const fail = (message, status = 400, extra = {}) => json({ error: message, ...extra }, status);

// Verifies the member's Supabase session token and returns { user, profile }.
export async function requireUser(request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw fail('Please sign in again.', 401);
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data?.user) throw fail('Please sign in again.', 401);
  const { data: profile } = await admin().from('profiles').select('*').eq('id', data.user.id).single();
  return { user: data.user, profile: profile || {} };
}

// Server-side caps. Returns null when allowed, or a member-facing message.
export async function bumpUsage(uid, kind, caps) {
  const { data, error } = await admin().rpc('bump_usage', {
    uid, kind, tz: env('APP_TIMEZONE', 'America/Chicago'),
    day_cap: kind === 'coach' ? caps.coachDay : caps.estDay,
    burst_cap: caps.coachBurst, burst_min: caps.burstMin,
    global_cap: Number(env('AI_GLOBAL_DAILY_CAP', 3000)),
  });
  if (error) { console.error('bump_usage', error); return 'Something went wrong. Try again in a minute.'; }
  if (data === 'ok') return null;
  if (data === 'burst') return 'Let’s slow down a little. Try again in a few minutes.';
  if (data === 'global') return 'The coach is resting for today. Your habits and food log still work.';
  return kind === 'coach'
    ? 'You’ve reached today’s coach limit. It resets at midnight. Your habits and food log still work.'
    : 'You’ve used today’s AI estimates. Typing foods with amounts still works, and so does the Food finder.';
}

// Minimal Anthropic Messages API client (no SDK needed).
export async function claude({ system, messages, tools, maxTokens = 600 }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: env('ANTHROPIC_MODEL', 'claude-haiku-5-5'), max_tokens: maxTokens, system, messages, ...(tools ? { tools } : {}) }),
  });
  if (!res.ok) { const t = await res.text(); console.error('anthropic', res.status, t.slice(0, 500)); throw fail('The AI service is busy. Try again in a minute.', 502); }
  return res.json();
}
export const textOf = (msg) => (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();

// Tolerant JSON extraction from a model reply.
export function parseJson(text) {
  try { return JSON.parse(text); } catch {}
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/); if (fence) { try { return JSON.parse(fence[1]); } catch {} }
  const a = Math.min(...['{', '['].map(c => { const i = text.indexOf(c); return i < 0 ? Infinity : i; }));
  const b = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (a < b) { try { return JSON.parse(text.slice(a, b + 1)); } catch {} }
  return null;
}

// Wraps a handler so thrown Responses are returned and other errors become 500s.
export const handle = (fn) => async (request) => {
  try { return await fn(request); }
  catch (e) { if (e instanceof Response) return e; console.error(e); return fail('Something went wrong. Try again.', 500); }
};

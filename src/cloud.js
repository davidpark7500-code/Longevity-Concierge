// Everything that talks to Supabase or our server functions lives here.
import { createClient } from '@supabase/supabase-js';

// Public project settings. These are safe in the code: the anon key only allows what the
// database security rules allow. Override with VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY if needed.
const SB_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ptsneanksrzmzurfxvph.supabase.co';
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0c25lYW5rc3J6bXp1cmZ4dnBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyOTM4ODIsImV4cCI6MjEwNzg2OTg4Mn0.eQb5KnnkihGkN1XgVE958W_eBnIHXllmEWv-f5eMY1U';

// Demo mode (sample data in this browser only): build with VITE_DEMO=1, or open the app with ?demo
export const DEMO = import.meta.env.VITE_DEMO === '1' || (typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo'));
export const sb = DEMO ? null : createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });

// ---------- Auth ----------
export async function getSession() { return DEMO ? null : (await sb.auth.getSession()).data.session; }
export function onAuth(cb) { if (!DEMO) sb.auth.onAuthStateChange((event, session) => cb(event, session)); }
export async function sendLink(email, ref = '') {
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin, data: ref ? { ref } : undefined } });
  if (error) throw error;
}
export async function verifyCode(email, token) {
  const { data, error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
  return data.session;
}
export async function signOut() { if (!DEMO) await sb.auth.signOut(); }

// ---------- Profile + synced state ----------
export async function loadProfile(uid) {
  const { data, error } = await sb.from('profiles').select('*').eq('id', uid).single();
  if (error) throw error;
  return data;
}
export async function saveProfile(uid, patch) {
  const { error } = await sb.from('profiles').update(patch).eq('id', uid);
  if (error) throw error;
}
export async function loadState(uid) {
  const { data, error } = await sb.from('user_state').select('data, updated_at').eq('user_id', uid).maybeSingle();
  if (error) throw error;
  return data ? data.data : null;
}
let timer = null, pending = null;
export function queueSave(uid, data) {
  pending = { uid, data };
  clearTimeout(timer);
  timer = setTimeout(flushSave, 800);
}
export async function flushSave() {
  if (!pending || DEMO) return;
  const { uid, data } = pending; pending = null; clearTimeout(timer);
  const { error } = await sb.from('user_state').upsert({ user_id: uid, data, updated_at: new Date().toISOString() });
  if (error) console.error('save failed', error);
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSave(); });
}

// ---------- Server functions ----------
// Server functions run on Supabase Edge Functions: '/api/coach' -> <project>/functions/v1/api/coach
export async function api(path, body, method = 'POST') {
  const session = await getSession();
  const res = await fetch(SB_URL + '/functions/v1' + path, {
    method,
    headers: { 'content-type': 'application/json', apikey: SB_KEY, ...(session ? { authorization: `Bearer ${session.access_token}` } : {}) },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body || {}) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || 'Something went wrong. Try again.'); e.status = res.status; throw e; }
  return data;
}

// ---------- Community ----------
export async function getGroup(id) {
  if (!id) return null;
  const { data } = await sb.from('groups').select('*').eq('id', id).maybeSingle();
  return data;
}
export async function listPosts(groupId) {
  let q = sb.from('posts').select('*').order('created_at', { ascending: false }).limit(50);
  q = groupId ? q.eq('group_id', groupId) : q.is('group_id', null);
  const { data, error } = await q;
  if (error) throw error;
  const ids = (data || []).map(p => p.id);
  let mine = new Set();
  if (ids.length) {
    const { data: c } = await sb.from('cheers').select('post_id').in('post_id', ids);
    mine = new Set((c || []).map(x => x.post_id));
  }
  return (data || []).map(p => ({ ...p, cheered: mine.has(p.id) }));
}
export async function createPost({ body, win, groupId }) {
  const { error } = await sb.from('posts').insert({ body, win: win || null, group_id: groupId || null });
  if (error) throw error;
}
export async function setCheer(postId, on) {
  const q = on ? sb.from('cheers').insert({ post_id: postId }) : sb.from('cheers').delete().eq('post_id', postId);
  const { error } = await q;
  if (error && error.code !== '23505') throw error;
}
export async function deletePost(id) {
  const { error } = await sb.from('posts').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Concierge teams ----------
export async function conciergeName(slug) {
  if (DEMO || !slug) return null;
  const { data } = await sb.rpc('concierge_public', { s: slug });
  return data?.[0]?.name || null;
}
// Returns { mine: the member's concierge, self: the concierge row this user runs (if any) }
export async function loadConcierges(uid, conciergeId) {
  const { data } = await sb.from('concierges').select('id, slug, name, contact_url, contact_label, user_id');
  const rows = data || [];
  return { mine: rows.find(r => r.id === conciergeId) || null, self: rows.find(r => r.user_id === uid) || null };
}

// ---------- Pacts ----------
export async function loadPacts() {
  const [{ data: pacts, error }, { data: stats }, { data: mine }, { data: checks }] = await Promise.all([
    sb.from('pacts').select('*').order('sort'),
    sb.rpc('pact_stats'),
    sb.from('pact_members').select('pact_id, joined_on'),
    sb.from('pact_checkins').select('pact_id, day').gte('day', new Date(Date.now() - 100 * 864e5).toISOString().slice(0, 10)),
  ]);
  if (error) throw error;
  return {
    pacts: pacts || [],
    stats: Object.fromEntries((stats || []).map(r => [r.pact_id, [r.members, r.today]])),
    mine: Object.fromEntries((mine || []).map(r => [r.pact_id, r.joined_on])),
    checks: new Set((checks || []).map(r => r.pact_id + '|' + r.day)),
  };
}
export async function joinPact(id, day) { const { error } = await sb.from('pact_members').insert({ pact_id: id, joined_on: day }); if (error && error.code !== '23505') throw error; }
export async function pactCheckIn(id, day) { const { error } = await sb.from('pact_checkins').insert({ pact_id: id, day }); if (error && error.code !== '23505') throw error; }
export async function pactUndo(id, day) { const { error } = await sb.from('pact_checkins').delete().eq('pact_id', id).eq('day', day); if (error) throw error; }

// ---------- Articles (Learn) ----------
export async function loadArticles() {
  const { data, error } = await sb.from('articles').select('*').order('sort').order('created_at');
  if (error) throw error; return data || [];
}
export async function saveArticle(a) {
  const row = { title: a.title, cat: a.cat, minutes: a.minutes, icon: a.icon, summary: a.summary || null, body: a.body, sources: a.sources || null, published: !!a.published, sort: a.sort };
  const q = a.id ? sb.from('articles').update(row).eq('id', a.id).select().single() : sb.from('articles').insert(row).select().single();
  const { data, error } = await q; if (error) throw error; return data;
}
export async function deleteArticle(id) { const { error } = await sb.from('articles').delete().eq('id', id); if (error) throw error; }

// ---------- Challenges admin ----------
export async function savePact(p) {
  const row = { title: p.title, goal: p.goal, icon: p.icon, days: p.days, members_only: !!p.members_only, active: p.active !== false, sort: p.sort };
  const q = p.id ? sb.from('pacts').update(row).eq('id', p.id).select().single() : sb.from('pacts').insert(row).select().single();
  const { data, error } = await q; if (error) throw error; return data;
}

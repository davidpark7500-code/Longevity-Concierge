// Everything that talks to Supabase or our server functions lives here.
import { createClient } from '@supabase/supabase-js';

const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Demo mode: no Supabase settings -> the app runs on sample data in this browser only.
export const DEMO = !SB_URL || !SB_KEY;
export const sb = DEMO ? null : createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });

// ---------- Auth ----------
export async function getSession() { return DEMO ? null : (await sb.auth.getSession()).data.session; }
export function onAuth(cb) { if (!DEMO) sb.auth.onAuthStateChange((event, session) => cb(event, session)); }
export async function sendLink(email) {
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin } });
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
export async function api(path, body, method = 'POST') {
  const session = await getSession();
  const res = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json', ...(session ? { authorization: `Bearer ${session.access_token}` } : {}) },
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
  let q = sb.from('posts').select('id, user_id, group_id, author_name, body, win, cheer_count, created_at').order('created_at', { ascending: false }).limit(50);
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

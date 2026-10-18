// GET  /api/admin            -> members, groups, open flags   (admins only)
// POST /api/admin {action}   -> setTier | setGroup | reviewFlag | setGroupCall
import { admin, fail, handle, json, requireUser } from './_lib.js';

async function requireAdmin(request) {
  const ctx = await requireUser(request);
  if (!ctx.profile.is_admin) throw fail('Admins only.', 403);
  return ctx;
}

export const GET = handle(async (request) => {
  await requireAdmin(request);
  const db = admin();
  const [{ data: profiles }, { data: groups }, { data: flags }, usersRes] = await Promise.all([
    db.from('profiles').select('id, first_name, tier, circle_active, group_id, is_admin, created_at').order('created_at', { ascending: false }).limit(500),
    db.from('groups').select('*').order('created_at'),
    db.from('flags').select('*').eq('reviewed', false).order('created_at', { ascending: false }).limit(100),
    db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  const emails = Object.fromEntries((usersRes.data?.users || []).map(u => [u.id, u.email]));
  return json({ members: (profiles || []).map(p => ({ ...p, email: emails[p.id] || '' })), groups: groups || [], flags: flags || [] });
});

export const POST = handle(async (request) => {
  await requireAdmin(request);
  const b = await request.json().catch(() => ({}));
  const db = admin();
  if (b.action === 'setTier' && ['free', 'essentials', 'performance', 'longevity'].includes(b.tier)) {
    await db.from('profiles').update({ tier: b.tier }).eq('id', b.id);
  } else if (b.action === 'setGroup') {
    await db.from('profiles').update({ group_id: b.groupId || null }).eq('id', b.id);
  } else if (b.action === 'reviewFlag') {
    await db.from('flags').update({ reviewed: true }).eq('id', b.id);
  } else if (b.action === 'setGroupCall') {
    await db.from('groups').update({ next_call: String(b.nextCall || '').slice(0, 80), call_link: String(b.callLink || '').slice(0, 300) || null }).eq('id', b.id);
  } else return fail('Unknown action.');
  return json({ ok: true });
});

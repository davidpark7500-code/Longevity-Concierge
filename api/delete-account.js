// POST /api/delete-account  Deletes the member's account and all their data (cascades in the database).
import Stripe from 'stripe';
import { admin, env, handle, json, requireUser } from './_lib.js';

export const POST = handle(async (request) => {
  const { user, profile } = await requireUser(request);
  if (profile.stripe_customer_id && env('STRIPE_SECRET_KEY')) {
    try {
      const stripe = new Stripe(env('STRIPE_SECRET_KEY'));
      const subs = await stripe.subscriptions.list({ customer: profile.stripe_customer_id, status: 'active' });
      for (const s of subs.data) await stripe.subscriptions.cancel(s.id);
    } catch (e) { console.error('cancel subs', e); }
  }
  await admin().auth.admin.deleteUser(user.id);
  return json({ ok: true });
});

// POST /api/stripe-webhook  (Stripe calls this; add the URL in Stripe -> Developers -> Webhooks)
// Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted
import Stripe from 'stripe';
import { admin, env, fail, handle, json } from './_lib.js';

const ACTIVE = new Set(['active', 'trialing']);

export const POST = handle(async (request) => {
  const stripe = new Stripe(env('STRIPE_SECRET_KEY'));
  const raw = await request.text();
  let event;
  try { event = stripe.webhooks.constructEvent(raw, request.headers.get('stripe-signature'), env('STRIPE_WEBHOOK_SECRET')); }
  catch { return fail('Bad signature', 400); }

  const db = admin();
  if (event.type === 'checkout.session.completed') {
    const s = event.data.object;
    const uid = s.client_reference_id;
    if (uid) await db.from('profiles').update({ circle_active: true, stripe_customer_id: s.customer }).eq('id', uid);
  }
  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    const active = event.type !== 'customer.subscription.deleted' && ACTIVE.has(sub.status);
    await db.from('profiles').update({ circle_active: active }).eq('stripe_customer_id', sub.customer);
  }
  return json({ received: true });
});

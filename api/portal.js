// POST /api/portal -> { url } Stripe billing portal (update card, cancel)
import Stripe from 'stripe';
import { env, fail, handle, json, requireUser } from './_lib.js';

export const POST = handle(async (request) => {
  const { profile } = await requireUser(request);
  if (!profile.stripe_customer_id) return fail('No subscription found.', 404);
  const stripe = new Stripe(env('STRIPE_SECRET_KEY'));
  const base = env('APP_URL') || new URL(request.url).origin;
  const s = await stripe.billingPortal.sessions.create({ customer: profile.stripe_customer_id, return_url: `${base}/` });
  return json({ url: s.url });
});

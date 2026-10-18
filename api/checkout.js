// POST /api/checkout -> { url } Stripe Checkout for the Circle subscription
import Stripe from 'stripe';
import { admin, env, fail, handle, json, requireUser } from './_lib.js';

export const POST = handle(async (request) => {
  const { user, profile } = await requireUser(request);
  if (!env('STRIPE_SECRET_KEY') || !env('STRIPE_PRICE_CIRCLE')) return fail('Payments aren’t set up yet.', 503);
  const stripe = new Stripe(env('STRIPE_SECRET_KEY'));
  let customer = profile.stripe_customer_id;
  if (!customer) {
    const c = await stripe.customers.create({ email: user.email, metadata: { user_id: user.id } });
    customer = c.id;
    await admin().from('profiles').update({ stripe_customer_id: customer }).eq('id', user.id);
  }
  const base = env('APP_URL') || new URL(request.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription', customer, client_reference_id: user.id,
    line_items: [{ price: env('STRIPE_PRICE_CIRCLE'), quantity: 1 }],
    subscription_data: { metadata: { user_id: user.id } },
    success_url: `${base}/?circle=joined`, cancel_url: `${base}/?circle=cancelled`,
    allow_promotion_codes: true,
  });
  return json({ url: session.url });
});

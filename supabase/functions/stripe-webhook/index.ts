// Supabase Edge Function "stripe-webhook" (deployed with JWT verification OFF; Stripe signs requests instead).
// Stripe -> Developers -> Webhooks -> endpoint: https://<project>.supabase.co/functions/v1/stripe-webhook
// Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import Stripe from 'npm:stripe@16.12.0';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const ACTIVE = new Set(['active', 'trialing']);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', { httpClient: Stripe.createFetchHttpClient() });
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, req.headers.get('stripe-signature') || '', Deno.env.get('STRIPE_WEBHOOK_SECRET') || '', undefined, Stripe.createSubtleCryptoProvider());
  } catch { return new Response('Bad signature', { status: 400 }); }

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object as Stripe.Checkout.Session;
    if (s.client_reference_id) await db.from('profiles').update({ circle_active: true, stripe_customer_id: s.customer as string }).eq('id', s.client_reference_id);
  }
  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    const active = event.type !== 'customer.subscription.deleted' && ACTIVE.has(sub.status);
    await db.from('profiles').update({ circle_active: active }).eq('stripe_customer_id', sub.customer as string);
  }
  return new Response(JSON.stringify({ received: true }), { headers: { 'content-type': 'application/json' } });
});

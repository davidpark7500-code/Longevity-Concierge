# Longevity Concierge

Habit tracking, food log, AI habit coach, move library, and the Circle community.
A web app members open from a link and add to their home screen.

- **Frontend:** Vite + plain JavaScript (`src/`)
- **Accounts + database:** Supabase (`supabase/schema.sql`)
- **Server functions:** Vercel (`api/`): AI coach, meal estimates, Stripe, admin
- **AI:** Anthropic Claude (Haiku by default)
- **Payments:** Stripe (Circle subscription)

Without Supabase settings the app runs in **demo mode** with sample data in the browser only.

---

## Go-live checklist

### 1. Supabase: create the database
1. Supabase dashboard → your project → **SQL Editor** → **New query**.
2. Paste all of `supabase/schema.sql` → **Run**. You should see "Success. No rows returned."
3. **Authentication → URL Configuration**
   - **Site URL:** your app address (for example `https://longevity-concierge.vercel.app`, or your own domain later)
   - **Redirect URLs:** add the same address.
4. **Authentication → Email Templates → Magic Link**: replace the body with:
   ```html
   <h2>Your Longevity Concierge sign-in</h2>
   <p>Your code: <strong style="font-size:22px;letter-spacing:4px">{{ .Token }}</strong></p>
   <p>Or tap to sign in: <a href="{{ .ConfirmationURL }}">Sign in</a></p>
   ```
   The code matters: people who add the app to their home screen sign in by typing the code.
5. **Project Settings → API**: copy the **Project URL**, the **anon public** key, and the **service_role** key (keep this one secret).

### 2. Vercel: put the app online
vercel.com → **Add New → Project** → import `Longevity-Concierge` → **Deploy**. No environment variables are needed: the public Supabase address and anon key are built into `src/cloud.js`, and pushes to `main` redeploy automatically.

Optional build settings: `VITE_CIRCLE_PRICE_LABEL` (default `$25/month`), `VITE_BOOKING_URL` (Calendly link for Longevity 1:1s).

### 2b. Server functions (Supabase Edge Functions)
`supabase/functions/api` (coach, estimate, checkout, portal, admin, delete-account) and `supabase/functions/stripe-webhook`, both deployed with **Verify JWT off** (they check sign-in / Stripe signatures themselves).
Redeploy with the Supabase CLI: `supabase functions deploy api --no-verify-jwt` (same for `stripe-webhook`).

**Supabase → Edge Functions → Secrets** (Project Settings → Edge Functions):

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | required for the coach and AI estimates (console.anthropic.com) |
| `ANTHROPIC_MODEL` | optional, default `claude-haiku-5-5` |
| `APP_TIMEZONE` | optional, default `America/Chicago` |
| `AI_GLOBAL_DAILY_CAP` | optional, default `3000` |
| `APP_URL` | optional, default the request origin |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_CIRCLE`, `STRIPE_WEBHOOK_SECRET` | when Stripe is ready |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to functions automatically.

### 3. Make yourself admin
Sign up in the app with your email, then in Supabase **SQL Editor** run:
```sql
update public.profiles set is_admin = true, tier = 'longevity'
where id = (select id from auth.users where email = 'YOUR@EMAIL.COM');
```
Refresh the app → **Plan → Admin** shows members, packages, groups, and flagged coach replies.

### 4. Stripe: Circle payments (when ready)
1. Stripe → **Product catalog → Add product**: "The Circle", recurring monthly price. Copy the **price ID** (`price_...`).
2. **Developers → API keys**: copy the **secret key**.
3. **Developers → Webhooks → Add endpoint**: `https://ptsneanksrzmzurfxvph.supabase.co/functions/v1/stripe-webhook`
   Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Copy the **signing secret** (`whsec_...`).
4. **Settings → Billing → Customer portal**: turn it on (lets members cancel or update cards).
5. Add `STRIPE_SECRET_KEY`, `STRIPE_PRICE_CIRCLE`, `STRIPE_WEBHOOK_SECRET` as Supabase Edge Function secrets (no redeploy needed).
Test with Stripe test mode first (card `4242 4242 4242 4242`).

### 5. Before inviting real members
- **Email:** Supabase's built-in email is for testing and only sends a few emails per hour. Set up custom SMTP (for example Resend) under **Authentication → SMTP Settings**.
- **Vercel Pro** ($20/mo): the free plan is non-commercial only.
- **Legal:** `public/privacy.html` and `public/terms.html` are drafts. Have the healthcare attorney finalize them and review the coach rules in `supabase/functions/api/guardrails.js`.
- **Amway:** confirm the paid Circle and package language are approved.
- **Photos:** the exercise images come from free-exercise-db; their original source isn't documented. Replace with your own before a big launch.

---

## How the pieces fit

| Feature | Where | Costs money per use? |
|---|---|---|
| Habits, food log, history, favorites | browser + `user_state` table | No |
| Food finder + typed-meal matcher | `src/shared/foodsearch.js` (runs on the phone) | No |
| AI coach | `supabase/functions/api/index.ts` | Yes (Claude) |
| Photo / AI meal estimates | `supabase/functions/api/index.ts` | Yes (Claude) |
| Community | `posts`, `cheers`, `groups` tables | No |
| Circle subscription | `supabase/functions/api`, `supabase/functions/stripe-webhook` | Stripe fees |

**Guardrails** (`supabase/functions/api/guardrails.js`, enforced in `supabase/functions/api/index.ts`):
emergency and medical keyword filters before any AI call, strict coach rules, a second AI check on every reply (fails closed),
40 coach messages/day and 8 per 10 minutes per member, 15 AI meal estimates/day, a global daily AI cap, and blocked replies saved to `flags` for review.

**Circle access** = paid subscription **or** Performance/Longevity package (set by an admin). Members are placed automatically into groups of up to 20.

## Local development
```bash
npm install
npm run dev                  # talks to the live Supabase project; add ?demo to the URL for sample data
supabase functions serve     # optional: run the server functions locally
npm test
```

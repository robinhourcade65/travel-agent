# 09 — Billing & Subscription

**Goal:** users can upgrade to a paid tier via Stripe Checkout, manage their subscription, and tier-gated features actually gate.

---

## Tier design

Keep it simple in V1. Two tiers:

| | Free | Pro |
|---|---|---|
| **Price** | €0 | €9/month or €72/year (save 33%) |
| **Flight searches** | 50/hour | 500/hour |
| **AI chat messages** | 30/day | 500/hour |
| **Active alerts** | 3 | 50 |
| **Date flexibility** | ±3 days max | ±14 days |
| **Currencies** | EUR + USD | All |
| **Email frequency** | Daily digest | Real-time |
| **Future: trend data** | 7 days lookback | 12 months |

**Why €9?** It's the lowest price point where most users will see the value (cheap flight saved = paid for the year), it puts you above "noise" subscription tiers (€3-5 services get cancelled instantly), and it gives you enough margin to cover Anthropic API costs even for heavy users. Validate with your first 20 users; adjust.

> **Don't add a "team" or "enterprise" tier in V1.** Two tiers force you to make hard decisions about what's actually valuable. Three tiers always become "the one no one buys + the two everyone debates between."

---

## Stripe setup

1. Sign up at https://dashboard.stripe.com/
2. Stay in **Test mode** for now.
3. Products → Add product:
   - Name: "Travel Agent Pro"
   - Recurring: monthly, €9
   - Recurring: yearly, €72
   - Save the two `price_xxxxxxxx` IDs.
4. Developers → API keys → reveal test secret key. Copy.
5. Developers → Webhooks → Add endpoint:
   - URL: `https://your-app.vercel.app/api/stripe/webhook` (you can use a placeholder for now; update before going live).
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
   - Copy the signing secret.

Add to env:
```
STRIPE_SECRET_KEY=sk_test_xxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxx
STRIPE_PRICE_MONTHLY=price_xxxxxxxxxx
STRIPE_PRICE_YEARLY=price_xxxxxxxxxx
```

---

## Task 1 — Checkout

Tell Claude Code:

> Build the Stripe Checkout flow.
>
> Install `stripe` (server) and `@stripe/stripe-js` (client).
>
> Create `src/server/billing/stripe.ts` exporting a singleton `stripe` client.
>
> Create the following:
>
> 1. **POST `/api/billing/checkout`** — accepts `{ priceId, interval: 'monthly' | 'yearly' }`. Creates a Checkout Session for the current user:
>    - Mode: `subscription`
>    - Line item: the appropriate Stripe price ID from env
>    - `success_url`: `/billing/success?session_id={CHECKOUT_SESSION_ID}`
>    - `cancel_url`: `/billing` (the pricing page)
>    - `customer_email` set to the user's email
>    - If the user already has a `stripe_customer_id` in their profile, pass `customer` instead of `customer_email`
>    - Add metadata `userId` so we can match it back in the webhook
>    - Return `{ checkoutUrl }`.
> 2. **`/billing` page** — pricing table with two cards (Monthly / Yearly), "Upgrade" buttons calling the checkout endpoint then redirecting.
> 3. **`/billing/success` page** — confirms success, says "Activating your subscription…" — actual upgrade happens via webhook (next task).
> 4. **POST `/api/billing/portal`** — creates a Stripe Customer Portal session for the user (so they can manage payment method, cancel, etc.) and returns the URL.
> 5. **`/billing` page, when user is already Pro** — show subscription status and a "Manage subscription" button that hits the portal endpoint.
>
> Commit `feat(billing): checkout flow`.

---

## Task 2 — Webhook handler

Tell Claude Code:

> Build the Stripe webhook handler.
>
> Create `src/app/api/stripe/webhook/route.ts`. POST handler. This is critical and security-sensitive — be careful.
>
> 1. Read the raw body (Next.js App Router: use `await request.text()`, not `.json()`, because the signature is computed over the raw bytes).
> 2. Verify the signature with `stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)`. If verification fails, return 400 immediately.
> 3. Handle events:
>    - `checkout.session.completed`: pull `metadata.userId` and `customer` from the session, update `profiles` set `subscription_tier = 'pro'`, `stripe_customer_id = <customer>`.
>    - `customer.subscription.updated`: re-evaluate status. If `status` is `active` or `trialing`, ensure tier is `pro`. If `past_due` or `unpaid`, keep `pro` but record `last_payment_failed_at`. If `canceled`, downgrade to `free`.
>    - `customer.subscription.deleted`: set tier to `free`.
>    - `invoice.payment_failed`: log to console; later we'll send an email reminder.
> 4. Always return 200 quickly. Long processing should be deferred (not needed in V1 — operations are simple DB updates).
> 5. Webhook handler should be idempotent: receiving the same event twice should not break anything. Stripe retries.
>
> Test locally with the Stripe CLI:
> ```bash
> stripe listen --forward-to localhost:3000/api/stripe/webhook
> ```
> The CLI prints a local webhook signing secret — temporarily use that for local testing.
>
> Commit `feat(billing): webhook handler`.

---

## Task 3 — Enforce tier limits

You've been referencing tier limits in earlier files but not enforcing them. Now make it real.

Tell Claude Code:

> Create `src/server/billing/tiers.ts` as the single source of truth for tier limits.
>
> Export:
> ```ts
> type Tier = 'free' | 'pro';
> export const TIER_LIMITS: Record<Tier, {
>   maxActiveAlerts: number;
>   maxSearchesPerHour: number;
>   maxChatMessagesPerHour: number;
>   maxDateFlexDays: number;
>   maxAlertCheckMinutes: number;  // free = 360 (6h), pro = 60 (1h)
> }>;
>
> export async function getCurrentTier(userId: string | null): Promise<Tier>;
> export async function assertCanCreateAlert(userId: string): Promise<void>;
> export async function getRateLimit(userId: string | null, kind: 'search' | 'chat'): Promise<number>;
> ```
>
> Refactor the alert-create endpoint, search endpoint, and chat endpoint to call these helpers instead of hardcoding limits.
>
> The alert-checker job (file 07) should use `maxAlertCheckMinutes` to determine which alerts to refresh — pro users get checked hourly, free users every 6 hours.
>
> Commit `refactor(billing): centralize tier enforcement`.

---

## Test the loop

Use Stripe's test cards (https://stripe.com/docs/testing):

- **Successful payment:** `4242 4242 4242 4242`, any future expiry, any CVC.
- **Payment fails after subscription:** `4000 0000 0000 0341` — succeeds the first time, then fails on renewal.

Test:
- [ ] Free user visits `/billing`, clicks Monthly, redirects to Stripe, pays, redirects back, profile shows Pro.
- [ ] Webhook fires and `subscription_tier` is `pro` in Supabase.
- [ ] Pro user can create more than 3 alerts.
- [ ] Pro user's chat rate limit is higher.
- [ ] Pro user visits `/billing`, clicks Manage, lands in Stripe portal, cancels, webhook fires, profile reverts to Free.
- [ ] (Bonus) Use Stripe CLI to replay a `checkout.session.completed` event — the handler is idempotent and doesn't double-process.

---

## Before going live with Stripe

Before flipping to live mode (file 10):

- [ ] Update webhook URL in Stripe Dashboard to your real domain
- [ ] Switch all env vars from `_test` to `_live`
- [ ] Re-create the products in live mode (test and live data are separate)
- [ ] Update the price IDs in env vars
- [ ] Activate your Stripe account (provide tax info, bank details, identity verification — this takes 1-3 days)
- [ ] Add a Terms of Service that mentions subscription billing (template in file 10)

---

## End-of-session checklist

- [ ] `/billing` shows pricing
- [ ] Test card upgrades you to Pro
- [ ] Webhook actually updates `subscription_tier`
- [ ] Tier limits enforced in alerts / search / chat
- [ ] Customer portal works for cancellation
- [ ] Cancelling reverts to Free correctly

Next file: **`10_launch.md`**.

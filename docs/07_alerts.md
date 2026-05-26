# 07 — Price Alerts (Feature 2)

**Goal:** logged-in users can subscribe to price alerts with flexible parameters. A background job checks them every few hours and sends an email when a target hits or a large swing occurs.

---

## What an alert looks like to a user

A simple example: *"Tell me when round-trip flights from Dublin to anywhere in Japan in October drop below €600, or if the price swings down by 20% from the last check."*

Translated into our data model (file 03), that's:
```
origin: 'DUB'
destination: null
destination_country: 'JP'
earliest_depart: 2026-10-01
latest_depart: 2026-10-31
target_price_minor: 60000
swing_threshold_pct: 20
```

---

## Resend setup

Sign up at https://resend.com/, verify your sending domain (or use Resend's `onboarding@resend.dev` for dev testing), and create an API key.

Add to env:
```
RESEND_API_KEY=re_xxxxxxxxx
EMAIL_FROM=alerts@yourdomain.com
EMAIL_FROM_NAME=Travel Agent
```

> **Domain verification matters.** Until you verify a sending domain, you can only send emails to your own Resend-account email. That's fine for dev. Before launch (file 10), you'll add SPF/DKIM/DMARC DNS records — Resend's UI walks you through it.

---

## Task 1 — Alerts API + UI

Tell Claude Code:

> Build CRUD for price alerts.
>
> **API routes** (`src/app/api/alerts/`):
> - `POST /api/alerts` — create alert. Body validated with zod.
> - `GET /api/alerts` — list current user's alerts.
> - `PATCH /api/alerts/[id]` — edit (toggle active, change target price, etc.).
> - `DELETE /api/alerts/[id]` — delete.
> - All routes require auth (return 401 if no session).
> - Rely on RLS in Supabase as the second line of defense — explicitly filter by `user_id = auth.uid()` anyway in the queries (defense in depth).
>
> **Limits per tier** (enforce server-side):
> - Free tier: max 3 active alerts.
> - Pro tier: max 50 active alerts.
> Return a 402-style error message when exceeded suggesting the upgrade path.
>
> **UI:**
> - New route `/alerts` (auth-required; redirect to `/login` if not signed in).
> - List existing alerts as cards: shows route, dates, target price, status, "edit" / "delete" / "pause" actions.
> - "Create alert" button opens a modal with the alert form.
> - The form has the same shape as the data model — origin, destination (with a "Country or anywhere" mode toggle), date range, optional target price, optional swing threshold, optional name.
> - Bonus convenience: a "Create alert from current search" button on the homepage globe, which prefills the form with the current `from` / `to` / `depart` / `return`.
>
> **Design:**
> - Match the globe's visual language. Cards on a light background, soft shadows, accent color.
> - Empty state: friendly illustration (use a simple SVG, don't pull in a heavy illustration library), "No alerts yet. Create your first to be notified of price drops."
>
> Commit `feat(alerts): CRUD api + manager UI`.

---

## Task 2 — The checker job

This is the heart of the alert system.

Tell Claude Code:

> Build the alert-checking background job.
>
> **Logic** (`src/server/alerts/checker.ts`, exporting `checkAlerts()`):
>
> 1. Load all alerts where `is_active = true` AND (`last_checked_at IS NULL` OR `last_checked_at < now() - interval '6 hours'`).
> 2. For each alert, in parallel batches of 5 (don't hammer Duffel):
>    a. Build the search query from the alert's params:
>       - If `destination` is set, search that exact route.
>       - If `destination_country` is set, search the country's cheapest airport (look up via `airports.is_major`).
>    b. For the date range, sample 3 candidate departure dates (start, middle, end of the range) to keep API calls bounded. Document this trade-off in a code comment.
>    c. Call `getFlightOffers` for each candidate date.
>    d. Find the minimum price across all results.
>    e. Compare against `target_price_minor` and `last_seen_price_minor`:
>       - **Target hit:** `target_price_minor IS NOT NULL` AND `minPrice <= target_price_minor` AND we have not already notified within the last 24h.
>       - **Swing detected:** `last_seen_price_minor IS NOT NULL` AND drop percentage >= `swing_threshold_pct`.
>    f. If either condition fires:
>       - Insert a row into `notifications`.
>       - Queue the email (next step).
>       - Set `last_notified_at = now()`.
>    g. Always update `last_seen_price_minor = minPrice` and `last_checked_at = now()`.
> 3. Return a summary: `{ checked, fired, errors }`.
>
> **Cron route:**
> - `src/app/api/cron/check-alerts/route.ts`, GET, protected by `CRON_SECRET` like in file 05.
> - Schedule in `vercel.json`: `"0 */3 * * *"` (every 3 hours).
> - Add monitoring: log the summary and (optional) send a summary to a Slack webhook if `SLACK_WEBHOOK_URL` is set in env.
>
> Commit `feat(alerts): background checker`.

---

## Task 3 — Email templates and sending

Tell Claude Code:

> Build the email layer.
>
> 1. Install `resend` and `@react-email/components`.
> 2. Create `src/emails/AlertHit.tsx` — a React Email template for a triggered alert. It should include:
>    - Headline: "✈️ Your alert hit: Dublin → Japan for €587"
>    - The current price, the target, the savings amount and percentage.
>    - A "View flights" button linking to a deep link into the app (`https://yourdomain/?from=DUB&to=NRT&depart=...`).
>    - A small "Manage your alerts" link to `/alerts`.
>    - An unsubscribe link (it should `PATCH /api/alerts/[id]` to set `is_active = false` via a signed token URL — implement the token verification too).
>    - Clean, brand-consistent, single-column, mobile-responsive.
> 3. Create `src/server/email/send.ts` exporting `sendAlertEmail({ alert, currentPriceMinor, baselinePriceMinor })`. Uses Resend.
> 4. Wire `sendAlertEmail` into the checker from Task 2.
> 5. Add a `npm run preview:emails` script using `react-email`'s dev preview server so I can see emails in the browser without sending them.
>
> Commit `feat(alerts): email templates and sending`.

---

## Test the full loop

Hardest part of this whole project — test methodically:

1. Sign in to your test account.
2. Create an alert with a deliberately unreachable target (e.g. €10 from DUB to anywhere). It should NOT fire.
3. Create a second alert with a target price you know will hit (€2000 to anywhere — basically guaranteed). It SHOULD fire.
4. Manually trigger the cron endpoint:
   ```
   curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-app.vercel.app/api/cron/check-alerts
   ```
5. Check:
   - [ ] `notifications` table has a row for the second alert
   - [ ] You received the email (or it's visible in Resend's dashboard logs)
   - [ ] The unsubscribe link works and sets `is_active = false`
   - [ ] Running the cron a second time doesn't re-fire the same alert within 24h

---

## End-of-session checklist

- [ ] `/alerts` UI works for create / edit / delete
- [ ] Free tier limit enforced
- [ ] Checker job runs and updates `last_checked_at`
- [ ] Emails actually arrive
- [ ] Unsubscribe works
- [ ] Cron is in `vercel.json`

Next file: **`08_ai_chat.md`**.

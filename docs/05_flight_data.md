# 05 — Flight Data Layer

**Goal:** by the end of this session your app can fetch real flight prices from Duffel, cache them properly, and you have a working background job that refreshes the "indicative prices" the globe will render against.

This is the most important infrastructure file. Read it carefully — sloppy work here costs real money.

---

## Get your Duffel API key

1. Go to https://app.duffel.com/ and sign up.
2. Settings → Access tokens → Create a token in **Test mode**. Copy it.
3. Add to `.env.local` and to Vercel env vars:
   ```
   DUFFEL_API_KEY=duffel_test_xxxxxxxxxx
   DUFFEL_MODE=test
   ```
4. When you eventually go live, you'll add `DUFFEL_API_KEY_LIVE` and switch `DUFFEL_MODE=live`. Don't worry about that yet — test mode has fake-but-realistic data and is free.

> **Important:** Duffel test mode returns fake flights with prices that don't reflect reality. That's fine for building UI. When you go live, you'll need to apply for "live mode" access (Duffel reviews you) and they'll charge per booking. For V1, you're not booking anything — you're just showing prices and linking to OTA sites. So you may stay in test mode longer than expected, or switch to Duffel's `flights/search` offering specifically.

---

## Task 1 — Duffel client wrapper

Tell Claude Code:

> Build a typed Duffel API client wrapper. Requirements:
>
> 1. Create `src/lib/flights/duffel.ts`.
> 2. Install `@duffel/api`.
> 3. Export a singleton `duffel` instance configured from `DUFFEL_API_KEY`.
> 4. Export typed helper functions, not raw Duffel objects:
>    - `searchOffers({ origin, destination, departDate, returnDate?, passengers })` returns a normalized `FlightOffer[]`.
>    - The normalized `FlightOffer` type lives in `src/types/flights.ts` and has exactly these fields:
>      ```ts
>      type FlightOffer = {
>        id: string;
>        origin: string;           // IATA
>        destination: string;      // IATA
>        departAt: string;         // ISO datetime
>        arriveAt: string;         // ISO datetime
>        durationMinutes: number;
>        stops: number;
>        airline: string;          // marketing carrier name
>        airlineIata: string;
>        priceMinor: number;       // in cents
>        currency: string;
>        deeplink: string | null;  // booking link, if available
>      };
>      ```
> 5. Functions must handle Duffel errors gracefully: log internally, throw a typed `FlightDataError` with a friendly message.
> 6. Add a `.test.ts` file with a single integration test that asks for DUB → CDG next month and asserts the result has at least one offer with a positive price. Skip the test if `DUFFEL_API_KEY` is missing.
>
> Run the test once and show me the output. Commit `feat(flights): duffel client wrapper`.

---

## Task 2 — Cache layer

The cache is where money is saved. Tell Claude Code:

> Build the flight price cache. The cache sits between our app and Duffel. Every search first checks Postgres; only on a miss or stale entry do we hit Duffel.
>
> 1. Create `src/server/flights/cache.ts`.
> 2. Export `getFlightOffers({ origin, destination, departDate, returnDate?, maxAgeMinutes? })`. Behavior:
>    - Query `public.flight_prices` for matching origin + destination + dates where `expires_at > now()`.
>    - If 1+ rows found, return them (sorted by `price_minor` ascending). Done — no Duffel call.
>    - If empty or all expired, call `searchOffers` from `duffel.ts`.
>    - Store every returned offer in `flight_prices` with an `expires_at` computed by `computeTTL(departDate)`:
>      - departure in < 7 days → 2 hours TTL
>      - departure in 7–30 days → 6 hours TTL
>      - departure in 30–90 days → 12 hours TTL
>      - departure in > 90 days → 24 hours TTL
>    - Return the normalized offers.
> 3. Use the **admin** Supabase client for writes (bypasses RLS).
> 4. Add an in-memory request deduplication: if two concurrent calls ask for the same route+date, only one Duffel call should fire and both callers get the same result. Use a simple `Map<key, Promise>` keyed on the search params.
> 5. Log every cache hit / miss to the console with the route, date, and source. We'll add proper observability later.
>
> Commit `feat(flights): caching layer with TTL`.

After this, run a quick manual test from a Node script (Claude Code can write it for you): call `getFlightOffers` twice with the same params. The first call should log a cache miss and a Duffel call; the second should log a hit and not touch Duffel. **Verify this works before continuing — caching bugs are silent and expensive.**

---

## Task 3 — The search API route

Tell Claude Code:

> Create the public-facing search endpoint at `src/app/api/flights/search/route.ts`. Requirements:
>
> 1. GET handler. Query params: `origin`, `destination`, `departDate`, optional `returnDate`.
> 2. Validate inputs with zod. Origin and destination must be 3-letter IATA codes that exist in our `airports` table. Dates must be in the future and within 11 months (Duffel's window).
> 3. Rate limit: anonymous users 10 searches per hour per IP; logged-in free users 50/hour; logged-in pro users 500/hour. Use a simple in-memory limiter for V1 (fine for single-region Vercel deployments) and add a TODO comment about moving to Upstash Redis when scaling.
> 4. Call `getFlightOffers` and return the results as JSON, plus a `cached: boolean` flag indicating whether the response came from cache.
> 5. Add appropriate `Cache-Control` headers (no caching at the CDN level — these are personalized).
>
> Commit `feat(api): flight search endpoint with rate limiting`.

Test manually:
```
http://localhost:3000/api/flights/search?origin=DUB&destination=CDG&departDate=2026-08-15
```

You should get a JSON array of offers back.

---

## Task 4 — Indicative prices background job

This is what powers the heat-map globe. Without it, opening the globe would trigger hundreds of Duffel calls. Tell Claude Code:

> Build the indicative-prices precomputation job.
>
> 1. Create `src/server/flights/indicative.ts` exporting `refreshIndicativePrices(originIata: string)`. Behavior:
>    - For each country in our `airports` table (group airports by `country_code`):
>      - Pick the country's busiest airport (the one marked `is_major = true`, or alphabetically first as a fallback).
>      - For each of the next 3 calendar months:
>        - Call `getFlightOffers` for the cheapest one-way departing on the 15th of that month, 7-day return.
>        - Take the lowest `priceMinor` from the results.
>        - Upsert into `public.indicative_prices` (origin, destination_country, month).
>    - Sleep 250ms between Duffel calls to stay polite with rate limits.
>    - Log progress every 10 destinations.
> 2. Create the cron entry at `src/app/api/cron/refresh-indicative/route.ts`:
>    - GET handler protected by a `CRON_SECRET` env var (check `Authorization: Bearer <secret>` header).
>    - Calls `refreshIndicativePrices('DUB')` and a few other common origins from a configurable list in `src/lib/flights/origins.ts`.
>    - Returns a summary JSON.
> 3. Add `CRON_SECRET` to `.env.local` (generate a random string) and to Vercel env vars.
> 4. Create `vercel.json` at the project root with a cron schedule:
>    ```json
>    {
>      "crons": [
>        { "path": "/api/cron/refresh-indicative", "schedule": "0 */6 * * *" }
>      ]
>    }
>    ```
>    This runs every 6 hours on Vercel's free tier.
>
> Commit `feat(flights): indicative prices background job`.

After deploying, you can manually trigger the cron from a terminal to test:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-app.vercel.app/api/cron/refresh-indicative
```

Run it once, then check Supabase → `indicative_prices` table — you should see ~50-100 rows for `origin = 'DUB'`.

---

## Task 5 — Public indicative-prices endpoint

The globe will hit this. Tell Claude Code:

> Create `src/app/api/flights/heatmap/route.ts`. GET handler:
> - Required param: `origin` (IATA).
> - Optional param: `month` (YYYY-MM, defaults to next month).
> - Returns `{ countryCode, priceMinor, currency, cheapestIata }[]` from the `indicative_prices` table.
> - This endpoint IS safe to cache at the CDN edge — set `Cache-Control: public, max-age=300, s-maxage=300` (5 minutes).
> - No auth required; this is public data.
>
> Commit `feat(api): heatmap endpoint`.

---

## End-of-session checklist

- [ ] `npm run dev` and a manual `/api/flights/search` request returns offers
- [ ] Second identical request shows a cache hit in the logs
- [ ] Indicative prices job ran successfully (manually triggered)
- [ ] `indicative_prices` table has data
- [ ] `/api/flights/heatmap?origin=DUB` returns a JSON array
- [ ] Cron schedule is in `vercel.json` and deployed
- [ ] No API keys leaked into git — re-check `.env.local` is gitignored

Next file: **`06_globe_v2.md`** — the fun part.

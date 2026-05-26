# 02 — Architecture

**This is a read file, not a build file.** Spend 30 minutes here before continuing. Understanding *why* the system is shaped this way will save you weeks of bad decisions later.

---

## The architecture in one diagram

```
┌─────────────────────────────────────────────────────────┐
│                   USER'S BROWSER                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Next.js Frontend                                │  │
│  │  - Globe (D3 + WebGL upgrade)                    │  │
│  │  - AI Chat panel                                 │  │
│  │  - Alert manager                                 │  │
│  └─────────────┬────────────────────────────────────┘  │
└────────────────┼────────────────────────────────────────┘
                 │ HTTPS
                 ▼
┌─────────────────────────────────────────────────────────┐
│            VERCEL (your Next.js server)                 │
│  ┌─────────────────────────────────────────────────┐   │
│  │  API Routes                                     │   │
│  │  /api/flights/search                            │   │
│  │  /api/alerts/*                                  │   │
│  │  /api/chat (streams from Anthropic)             │   │
│  │  /api/auth/* (Supabase auth helpers)            │   │
│  └─────┬────────────────┬────────────────┬─────────┘   │
│        │                │                │             │
│        ▼                ▼                ▼             │
└────────┼────────────────┼────────────────┼─────────────┘
         │                │                │
         ▼                ▼                ▼
   ┌──────────┐    ┌──────────────┐  ┌──────────────┐
   │ Supabase │    │   Duffel     │  │  Anthropic   │
   │ Postgres │    │ (flight API) │  │ (Claude API) │
   │ + Auth   │    └──────────────┘  └──────────────┘
   └──────────┘
         ▲
         │ scheduled cron job (every 6h)
         │
   ┌─────┴────────┐
   │  Vercel Cron │  → checks all active alerts, sends emails
   └──────────────┘
```

**That's it.** No Kubernetes, no microservices, no message queues. You can run this whole stack for under $50/month until you have hundreds of paying users.

---

## Key decisions and why

### 1. Next.js full-stack instead of separate frontend + backend

You're one non-technical person. Splitting frontend and backend means two deployments, two codebases, CORS headaches, and twice the cognitive load. Next.js lets you write API routes alongside your pages — same repo, same deploy, same language (TypeScript). When you grow, you can extract services. Until then, don't.

### 2. Supabase for database + auth instead of rolling your own

Auth is harder than it looks. Password hashing, session management, email verification, password reset, social login, JWT rotation — each of these is a place to introduce security bugs. Supabase handles all of it and gives you a Postgres database with the same login. Free tier covers V1 with room to spare.

### 3. Duffel for flight data — but with aggressive caching

This is the most important architectural decision and the one most likely to wreck your costs if you ignore it.

**The naive approach** (what your prototype suggests): user opens the globe → frontend asks the API for "cheapest flight from JFK to every country" → API charges you per call → globe shows 200 prices → user changes the date → 200 more calls → bankruptcy.

**The right approach:**

- **Frontend never calls Duffel directly.** All flight requests go through your `/api/flights/*` route handlers.
- **Every flight search result is cached in Postgres** with a TTL (time to live) of 6–24 hours, depending on departure date proximity. (Tomorrow's flight prices change hourly; flights 3 months out barely move.)
- **The globe loads from a precomputed "indicative prices" table** that you refresh in the background via a cron job, not on user request. So opening the globe = 1 query against your own database, not 200 API calls.
- **Live, exact prices are fetched only when the user clicks a specific destination** and wants to see actual flight options.
- **Anonymous (logged-out) users get cached-only data.** Live searches are a paid-tier feature.

This pattern alone is the difference between a $30/month infrastructure bill and a $3000/month one.

### 4. The AI agent is a tool-using Claude agent, not a chatbot

Feature 6 ("plan a trip for X pax max budget") is not a chatbot. It's an agent. The difference:

- **Chatbot:** sends user text to Claude, displays Claude's text response. Useless for travel because it can't look at real prices.
- **Agent:** Claude is given tools — `searchFlights(origin, dest, dates)`, `setAlert(params)`, `getUserAlerts()` — and decides when to call them. It can answer "plan a 4-person trip to Asia under €3000" by actually searching real flights, picking the cheapest viable destinations, and presenting them.

This is what makes the product feel magical. File `08_ai_chat.md` walks through it.

### 5. Email-only alerts in V1 (no SMS, no push)

SMS costs money per message. Push notifications require native apps or fragile web-push setup. Email is free, universal, and asynchronous — which matches the use case (a price alert isn't urgent enough to interrupt you). Add SMS later if customers ask.

---

## Cost projection for V1

Assuming 100 active users, 10 paying, 50 alerts checked daily:

| Service | V1 monthly cost |
|---|---|
| Vercel (hosting) | $0 (hobby tier — upgrade to $20 Pro if you hit limits) |
| Supabase | $0 (free tier) |
| Duffel | $0 sandbox, ~$25 once live (estimate; varies by call volume) |
| Anthropic (Claude) | $5–20 (depends on chat usage) |
| Resend (email) | $0 (3000 emails free) |
| Stripe | $0 fixed (% of revenue only) |
| Domain | ~$1/month amortized |
| **Total** | **~$30–50/month** |

You need 3–5 paying users at $10/month to break even on infrastructure. Plan accordingly when designing your subscription tiers (`09_billing.md`).

---

## Performance budgets

These are targets you should hold Claude Code to. Anything slower is a bug.

| Metric | Target | Why |
|---|---|---|
| Globe initial paint | < 2.0s on a fast connection | Anything slower and users bounce |
| Globe destination prices load | < 500ms (cached) | Should feel instant |
| Live flight search | < 4s | Acceptable; show a loading state |
| AI chat first token | < 1.5s | Critical for the "alive" feel |
| Alert email delivery | < 5 min from price change | Fresh enough to act on |

---

## Security and privacy non-negotiables

- **Never store flight provider API keys in client-side code.** Only in `.env.local` (dev) and Vercel env vars (production). Claude Code knows this, but verify in every PR.
- **Use Supabase Row-Level Security (RLS)** on every table that contains user data. RLS means "user A literally cannot read user B's alerts at the database level, even if your API has a bug." File `03_data_model.md` shows the exact policies.
- **Never log user emails or passwords.** Standard, but worth saying.
- **Be GDPR-aware.** If you have any EU user (you will), you need: a privacy policy, the ability to delete a user's data on request, and clear consent for marketing emails. `10_launch.md` covers the policy templates.

---

## What this architecture deliberately does NOT support

Worth being explicit:

- **Real-time collaborative editing** (group trip planning, Feature 7). Adding this means WebSockets, presence, conflict resolution. Not in V1.
- **Mobile apps.** The web app will be mobile-responsive but there is no iOS/Android binary. PWA is enough for V1.
- **Multi-region deployment.** Vercel handles edge automatically for static assets; for database, you're single-region (pick whichever Supabase region is closest to your main user base).
- **Internationalization (multiple languages).** English only in V1. Add later with `next-intl` if needed.

---

Next file: **`03_data_model.md`** — the database schema.

# Travel Agent — Project Plan

This folder contains the complete plan for building **Travel Agent**, an AI-powered flight discovery and alerting platform. The scope of V1 is intentionally tight: a beautiful interactive globe for flight prices, a price-alert system, and an AI chat assistant.

You are **non-technical**, and **Claude Code** will write all the code. These `.md` files exist so you can feed Claude Code small, well-scoped tasks one at a time — that is the right way to use it. Trying to ship the whole product in one prompt produces a slow, broken mess.

---

## How to use this plan

1. **Read these files in order** (`00` → `10`). Each is short. You don't need to understand every technical word — you need to understand *what is being built* and *why*.
2. **Open Claude Code in a fresh empty folder on your computer.** (Install instructions in `01_setup.md`.)
3. **Start with `01_setup.md`.** Paste its contents into Claude Code and let it execute. When done, move to `02`.
4. **One file = one work session.** Don't skip ahead. Each file builds on the previous one.
5. **After each session, test what was built.** If something is broken, ask Claude Code to fix it before moving on. Compounding bugs is how projects die.

---

## File index

| # | File | What gets built | Approx. session length |
|---|---|---|---|
| 00 | `00_README.md` | This file. Orientation only. | — |
| 01 | `01_setup.md` | Project skeleton, tooling, env, repo, deployment target | 1 evening |
| 02 | `02_architecture.md` | The technical decisions — read but don't execute | 30 min read |
| 03 | `03_data_model.md` | Database schema (users, alerts, searches, flights cache) | 1 evening |
| 04 | `04_auth.md` | Sign up, log in, sessions, password reset | 1 evening |
| 05 | `05_flight_data.md` | The flight price provider integration + caching layer | 1-2 evenings |
| 06 | `06_globe_v2.md` | The interactive 3D globe (Feature 1) — upgrades your prototype | 2-3 evenings |
| 07 | `07_alerts.md` | Price alerts subscription engine (Feature 2) | 2 evenings |
| 08 | `08_ai_chat.md` | The natural-language AI agent (Feature 6) | 2 evenings |
| 09 | `09_billing.md` | Stripe subscription, free / paid tiers | 1 evening |
| 10 | `10_launch.md` | Domain, analytics, legal pages, soft launch checklist | 1 evening |

**Realistic total: 4–8 weeks of evenings/weekends for a non-technical founder using Claude Code.** People who promise "weekend MVPs" are either lying or building toys. This is a real product.

---

## What's IN the MVP (V1)

- **Feature 1** — Interactive 3D globe with live flight prices, country drill-down, advanced filters
- **Feature 2** — Price alerts with custom params, email notifications on target hit or large swings
- **Feature 6** — AI chat agent ("plan a trip for 4 people, 10 days in Asia, budget €3000")
- **Foundations** — auth, database, payments, deployment, basic analytics

## What's NOT in V1 (deferred to V2+)

| Feature | Why deferred | Estimated cost to add |
|---|---|---|
| 3 — Price trends / historical data | Needs months of accumulated data first | Medium — add 4 weeks once data exists |
| 4 — Multi-modal A→B transport | Each provider (Trainline, Uber, etc.) is its own integration nightmare | Large — 6-8 weeks |
| 5 — Hotel integration | Booking.com / Airbnb partner APIs require business approval, weeks of paperwork | Large — 8 weeks + legal |
| 7 — Friends/group planning | Pure UX/social feature, only valuable once you have users | Medium — 3 weeks |
| 8 — Historical portfolio | Trivial once auth + bookings exist | Small — 1 week |
| 9 — Flight resale exchange | **Legal minefield.** Most jurisdictions ban name-change on tickets. Don't touch this until you have a lawyer on retainer. | Unknown — likely not viable |

**Do not let scope creep back in.** Every feature added before launch delays your first paying customer by weeks.

---

## The honest constraints you need to accept

Three things will surprise you, so I'm putting them up front:

**1. Flight data is expensive and rate-limited.** The major aggregator APIs (Amadeus, Duffel, Kiwi, Skyscanner) all charge per call or require revenue-share deals. A naive "show prices for every country on a globe" implementation will burn through your free tier in minutes and cost hundreds of dollars per month. The architecture in `02_architecture.md` is built around aggressive caching to keep costs manageable — read that file carefully.

**2. You cannot legally sell flights yourself without being an IATA-accredited travel agent.** This takes months and significant capital. Your business model in V1 is **affiliate revenue** (you send users to airline/OTA sites and earn a commission) or **subscription** (users pay you for alerts and AI features). `09_billing.md` covers subscription. Affiliate setup is in `10_launch.md`.

**3. "AI travel agent" is a crowded space.** Hopper, Kayak Explore, Google Flights Explore, Skyscanner Everywhere all do pieces of this. Your edge is the *combination*: the gorgeous globe + the personal AI agent + the alert system, all in one tool. Stay focused on making *that* exceptional. Don't try to out-feature Kayak.

---

## Working with Claude Code — practical tips

- **Be specific.** "Build the globe" fails. "In `src/components/Globe.tsx`, add a country-level click handler that calls `onCountrySelect(countryCode)` and zooms the camera to lat/lon over 800ms" works.
- **Ask it to plan before it codes** on any task longer than 30 lines. Say: *"Before writing code, list the files you'll create or modify and the function signatures."*
- **Commit after every working step.** When something works, `git commit`. When the next change breaks it, you can roll back. Claude Code can do the commits for you — just ask.
- **Don't let it install packages without explaining what they do.** A single rogue dependency can add 200 MB and three security vulnerabilities. Ask: *"What does this package do and is there a lighter alternative?"*
- **Test in your browser after every meaningful change.** Don't trust "it should work" — verify.

---

Next file: **`01_setup.md`** — getting your environment ready.

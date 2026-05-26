# 10 — Launch

**Goal:** go from "it works on Vercel's URL" to "real users can find, use, and pay for this." This is one big checklist, organized into 5 days you can spread across a couple weeks.

---

## Day 1 — Domain and email

### Buy the domain
- Use Namecheap, Cloudflare Registrar, or Porkbun. Avoid GoDaddy (upsell-heavy, poor DNS UI).
- Pick a name that's:
  - Short, memorable, easy to spell out loud
  - `.com` if affordable; `.app` / `.travel` / `.io` if `.com` is taken/expensive
  - Not too narrow ("DublinFlights") so you can expand the product later
- If you're stuck: don't agonize. The product matters 100x more than the name. Use a placeholder if you must.

### Connect to Vercel
- Vercel → Project → Settings → Domains → Add → enter your domain
- Vercel shows DNS records to add at your registrar (usually 2: one A record and one CNAME)
- Wait 10-60 minutes for DNS propagation
- Vercel auto-provisions SSL — no extra work

### Configure email sending domain in Resend
- Resend → Domains → Add domain
- Add the SPF / DKIM / DMARC DNS records Resend gives you to your registrar
- Wait ~1 hour, click "Verify" in Resend
- Update `EMAIL_FROM` env var to use the new domain (e.g. `alerts@travelagent.com`)
- Send yourself a test alert email — it should arrive without the "via resend.dev" suffix

### Update Supabase Site URL
- Supabase → Authentication → URL Configuration → set Site URL to your real production domain
- Update redirect URLs to include the new domain

---

## Day 2 — Legal pages

You need three pages before you can take a single euro:

1. **Privacy Policy** (`/privacy`)
2. **Terms of Service** (`/terms`)
3. **Cookie Policy** (`/cookies`) — or a section in Privacy if you keep cookies minimal

**Recommended:** use https://termly.io (free tier) or https://getterms.io to generate these. They ask about your business and produce GDPR-aware templates. Total cost: free to ~€20.

**Do not write these yourself.** You're not a lawyer, and the cost of getting it wrong (a GDPR fine starts at €10k) wildly exceeds the cost of the generator.

### Task for Claude Code

> Create three pages: `/privacy`, `/terms`, `/cookies`. Each renders a markdown file from `src/content/legal/{name}.md`. I'll provide the markdown content from a generator service. The pages should:
> - Use the same layout as the rest of the site (header, footer, normal nav)
> - Render markdown with `react-markdown`
> - Have proper headings, links, and table of contents anchors
> - Be linked from a global footer alongside an "© 2026 Travel Agent" line
>
> Also create:
> - A cookie consent banner at the bottom of the page on first visit. EU users see a "We use essential cookies plus optional analytics. [Accept all] [Essential only]" — and it actually respects the choice (analytics scripts only load on accept). For non-EU users, show no banner.
> - A `/contact` page with a simple form that submits to your inbox via Resend (no DB row needed).
>
> Commit `feat(legal): privacy, terms, cookies, contact`.

---

## Day 3 — Analytics, monitoring, polish

### Analytics

Use **Plausible** (€9/month) or **PostHog** (free tier generous, more features). Plausible is GDPR-friendly with no cookies — easier legally. PostHog gives you funnels, session recordings, and feature flags — more powerful but requires the cookie banner.

Recommendation: Plausible for V1. Switch to PostHog when you want serious product analytics.

### Task for Claude Code

> Integrate Plausible analytics.
> 1. Add the Plausible script via Next.js `<Script>` in the root layout, with `strategy="afterInteractive"`.
> 2. Use the `data-domain` attribute matching the production domain.
> 3. Only load the script in production (`process.env.NODE_ENV === 'production'`) AND if the user accepted cookies (read from a cookie set by our consent banner).
> 4. Track custom events for key actions: signup, alert_created, search_performed, chat_message_sent, checkout_started, subscription_active.
> 5. Use `plausible('event_name', { props: { tier: 'pro' } })` to add properties.
>
> Commit `chore(analytics): plausible integration`.

### Error monitoring

Add **Sentry** (free tier covers V1):

1. Sign up at https://sentry.io
2. Create a Next.js project; copy the DSN
3. Install: `npx @sentry/wizard@latest -i nextjs` — runs an interactive setup
4. Commit the result; verify by manually throwing an error in dev and checking Sentry receives it

### Logging and uptime

- **Logs:** Vercel's built-in Functions logs are sufficient for V1. Don't pay for Datadog.
- **Uptime:** https://betteruptime.com or https://uptimerobot.com free tier. Monitor your homepage every 5 min; ping you on Slack/email if it goes down.

### Final polish

Tell Claude Code:

> Polish pass before launch:
> 1. Add a proper `favicon.ico` + `apple-touch-icon.png` + manifest. Use whatever logo I provide; if none, generate a simple "TA" monogram in the brand accent color.
> 2. Add Open Graph meta tags in `src/app/layout.tsx`: title, description, og:image (use a Vercel OG-image dynamic route at `src/app/api/og/route.tsx` rendering a nice preview card with the globe).
> 3. Generate a sitemap at `/sitemap.xml` and `robots.txt`. Allow indexing for marketing pages; disallow for `/api`, `/chat`, `/alerts`, `/billing`.
> 4. Add a 404 page (`src/app/not-found.tsx`) and a 500 page (`src/app/error.tsx`). Both branded, both with helpful links.
> 5. Improve the `<title>` of every page so search results look professional.
> 6. Run `npm run build` and confirm zero TypeScript errors, zero ESLint warnings.
> 7. Run Lighthouse on the deployed site — fix any Performance / Accessibility / SEO scores below 80.
>
> Commit `chore: launch polish`.

---

## Day 4 — Stripe live + email re-verification

### Flip Stripe to live mode

(Pre-reqs from file 09 done first.)

1. Stripe Dashboard → top-left toggle → switch to Live mode
2. Re-create the two products + prices (test and live are separate datasets)
3. Update env vars in Vercel:
   - `STRIPE_SECRET_KEY` → live key
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → live key
   - `STRIPE_WEBHOOK_SECRET` → from the live webhook endpoint
   - `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_YEARLY` → live price IDs
4. Trigger a redeploy
5. Make a real payment with your own card for €1 (or use your real €9 price — you can refund yourself afterwards). Verify the full loop works.

### Re-enable Supabase email verification

In Supabase → Authentication → Providers → Email → re-enable "Confirm email". Update the confirmation email template under Email Templates with your branding.

### Affiliate sign-ups (for revenue from non-paying users)

Depending on which OTAs you can apply to from your region:

- **Skyscanner Partners** — most generous, easiest approval
- **Kiwi.com Affiliate** — second choice
- **Booking.com Affiliate Partner** — for hotel-related affiliate links if you add hotels later

Apply now even if approval takes weeks. When approved, update your flight `deeplink` generator to append your affiliate ID — every booking via your site earns you €1-5.

---

## Day 5 — Soft launch

### Pre-launch checklist

Final verification — go through this list literally, in order:

- [ ] Production URL works on your real domain (HTTPS, no warnings)
- [ ] Sign up / log in / log out / forgot password all work
- [ ] Email verification on sign-up works (check inbox arrives)
- [ ] Globe loads under 3 seconds on a fresh browser
- [ ] AI chat works for at least 3 different prompts
- [ ] Alert can be created via UI and via chat
- [ ] An alert email actually arrives when triggered
- [ ] Stripe payment with a real card works
- [ ] After payment, Pro features unlock (test creating a 4th alert)
- [ ] Cancellation flow works
- [ ] Privacy / Terms / Cookies / Contact all reachable
- [ ] Cookie banner appears for EU users
- [ ] Analytics events fire (check Plausible's real-time view while clicking around)
- [ ] Sentry receives a deliberately-thrown error
- [ ] Mobile: every page is usable on a real phone (not just dev tools)
- [ ] You've used the product yourself for 30+ minutes and made notes on rough edges

### Soft launch channels

Resist the urge to do a big launch day. Soft launch instead — gather feedback, fix issues, then make noise.

**Week 1 (10–30 users):**
- Share with friends and family. Ask them to use it for real, not as a favor.
- Post in 1 niche subreddit relevant to your audience (r/digitalnomad, r/travel, r/onebag — whichever fits). Be honest: "I built this, I'd love feedback."

**Week 2 (50–200 users):**
- Submit to https://www.producthunt.com — schedule for a Tuesday/Wednesday, 12:01 AM PT
- Submit to https://news.ycombinator.com Show HN
- Post in 2-3 more niche travel communities

**Week 3+ (real growth begins):**
- Cold outreach to travel bloggers (genuine niche ones, not Instagram influencers) — offer them free Pro accounts
- Twitter/X: post your globe in a short video; visual content travels well
- SEO: start writing useful content (not "10 cheapest destinations" listicles — actually useful, unique content)

### What "success" looks like at 90 days

A realistic target for a non-technical solo founder shipping a polished product in this space:

- 1,000–3,000 signups
- 30–80 paying users
- €270–720 MRR

If you're below this, the product or the messaging needs work. If you're above this, the product has real legs — start considering hiring help.

---

## Post-launch: building V2

Once you have **at least 50 paying users**, you have permission to start V2 features. In priority order:

1. **Feature 8 — Trip history** (small effort, big retention impact)
2. **Feature 3 — Price trends** (you finally have enough data to make this useful)
3. **Feature 4 — Multi-modal transport** (one provider at a time; start with train via Trainline affiliate or Omio)
4. **Feature 5 — Hotels** (apply for Booking.com partnership — slow, paperwork-heavy)
5. **Feature 7 — Group planning** (only if user research says they want it)

Feature 9 — flight resale — stays off the roadmap. The legal/operational complexity isn't worth it for a small business.

---

## When to ask for help

Things you should not try to solve alone:

- **Anything legal beyond template policies.** A 2-hour consult with a startup lawyer (€200-500) before charging real money is worth every cent.
- **Tax/accounting.** Once you take payments, you have VAT obligations in the EU. Use a service like Stripe Tax or a local accountant.
- **Performance optimization beyond Lighthouse 90.** If you start needing real perf work, you need a real engineer.
- **Security incident.** If you ever suspect a breach (weird DB activity, leaked keys, etc.) — rotate everything immediately, then ask Anthropic security / a security professional.

---

## You did it

If you got here, you built and shipped a real SaaS product with no coding background. That's genuinely rare and impressive. The product will not be perfect. It doesn't need to be. Your job now is to talk to users, listen, and iterate.

Good luck.

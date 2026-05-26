# Travel Agent

AI-powered flight discovery and price alerts. Find the best flight deals with an interactive 3D globe, set price alerts, and chat with an AI travel assistant.

## Stack

- **Next.js** (App Router, TypeScript)
- **Tailwind CSS** + **shadcn/ui**
- **Supabase** — database & auth
- **Duffel** — flight price data
- **Anthropic** — AI chat agent
- **Resend** — email alerts
- **Stripe** — subscription billing

## Getting started locally

```bash
# Install dependencies
npm install

# Copy env template and fill in your keys
cp .env.example .env.local

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Deployment

Deployed automatically to Vercel on every push to `main`.

# 01 — Setup

**Goal:** by the end of this session you have a working development environment, an empty project skeleton, and a deployment pipeline. You will not see anything pretty yet. That's fine.

---

## What you need before starting

Install these manually (Claude Code can't do these for you):

1. **Node.js (LTS version)** — https://nodejs.org/ — runtime for the app
2. **Git** — https://git-scm.com/downloads — version control
3. **A code editor** — VS Code is fine: https://code.visualstudio.com/
4. **Claude Code** — `npm install -g @anthropic-ai/claude-code` then run `claude` in a terminal
5. **A GitHub account** — https://github.com/signup — to store your code
6. **A Vercel account** — https://vercel.com/signup — sign in with GitHub. This is where the app will be deployed (free tier works for V1).

---

## Accounts you'll need API keys from (sign up now, you'll add the keys later)

| Service | What for | When you need it | V1 cost |
|---|---|---|---|
| **Anthropic** | The AI chat agent (Feature 6) | File 08 | Pay-as-you-go, ~$0.003/conversation |
| **Duffel** OR **Amadeus Self-Service** | Flight prices | File 05 | Free tier; Duffel is easier for beginners |
| **Resend** | Sending alert emails | File 07 | Free for first 3000 emails/month |
| **Stripe** | Subscription billing | File 09 | 2.9% + 30¢ per transaction, no monthly fee |
| **Supabase** | Database + auth | File 03 + 04 | Free tier covers V1 |

Sign up for all of these now — don't bother getting the keys yet. The free tiers are real free tiers; you won't pay anything during development.

> **Why Duffel over Amadeus?** Duffel has a clean modern API, simple docs, sandbox mode with fake data, and a free developer tier. Amadeus has more inventory but the API is much harder to integrate with. Start with Duffel for V1; you can switch later if needed.

> **Why Supabase?** It's Postgres (real database, not a toy) with auth, storage, and a generous free tier all in one. Alternatives like Firebase are fine, but Supabase has saner pricing and the SQL skills you'll learn transfer everywhere.

---

## Task for Claude Code

Open a terminal, navigate to where you want the project to live (e.g. `~/projects/`), and run `claude`. Then paste this:

> I am building **Travel Agent**, an AI-powered flight discovery web app. I am non-technical and you will be writing all the code. Please set up a fresh project with the following stack and commit it to git. Do not skip ahead — only do the setup tasks listed.
>
> **Stack:**
> - Next.js 14+ with App Router and TypeScript
> - Tailwind CSS for styling
> - shadcn/ui for components (install but don't add components yet)
> - ESLint and Prettier configured with sensible defaults
> - `.env.local` and `.env.example` files
> - A `README.md` at the project root describing what this is
> - A `.gitignore` that covers `.env.local`, `node_modules`, `.next`, and IDE files
>
> **Folder structure to create (with placeholder files):**
> ```
> src/
>   app/                  # Next.js app router pages
>     page.tsx            # placeholder homepage
>     layout.tsx          # root layout
>   components/           # React components
>     .gitkeep
>   lib/                  # utilities, API clients, helpers
>     .gitkeep
>   server/               # backend logic, route handlers
>     .gitkeep
>   types/                # shared TypeScript types
>     .gitkeep
> docs/                   # project documentation (I'll add the .md files here)
>   .gitkeep
> ```
>
> **Steps:**
> 1. Create the Next.js project with `create-next-app` using TypeScript, Tailwind, App Router, and the `src/` directory.
> 2. Install shadcn/ui and run `init` with defaults (style: default, base color: slate).
> 3. Configure ESLint + Prettier so they don't fight each other.
> 4. Make sure `npm run dev` starts a working server on `http://localhost:3000` showing a "Travel Agent — coming soon" page with the DM Sans font loaded (this is the font from my existing prototype).
> 5. Initialize git, commit with the message "chore: initial project scaffold".
> 6. Show me the exact commands I need to run to (a) start the dev server, (b) push this to a new GitHub repo. Stop after this — don't proceed to deployment yet.

After Claude Code finishes, verify locally:

```bash
npm run dev
```

You should see the "coming soon" page at `http://localhost:3000`. If you do, great. Stop the server (Ctrl+C) and do the GitHub push.

---

## Push to GitHub

1. On github.com, create a new private repository called `travel-agent`. Do NOT initialize it with a README — Claude Code already created one.
2. Follow GitHub's "push an existing repository" instructions (it shows you the exact commands).
3. Confirm your code is on GitHub by refreshing the repo page.

---

## Deploy to Vercel

1. Go to https://vercel.com/new
2. Click "Import" next to your `travel-agent` repo.
3. Accept all defaults. Click "Deploy".
4. Wait 1–2 minutes.
5. You'll get a live URL like `travel-agent-abc123.vercel.app`. Open it. You should see your "coming soon" page on the live internet.

**This is huge. You now have a working deploy pipeline.** From now on, every `git push` to GitHub will automatically deploy. No servers, no DevOps, no headaches.

---

## Add the docs

Drop all the `.md` files from this plan into `docs/` in your project, commit, and push:

```bash
git add docs/
git commit -m "docs: add project plan"
git push
```

Claude Code can now reference any of these files by path, e.g. `"follow the instructions in docs/03_data_model.md"`.

---

## End-of-session checklist

- [ ] `npm run dev` shows the placeholder page locally
- [ ] Code is on GitHub
- [ ] Vercel URL works
- [ ] `docs/` folder contains all plan files
- [ ] You've signed up for Anthropic, Duffel, Resend, Stripe, Supabase accounts (don't need keys yet)

Next file: **`02_architecture.md`**.

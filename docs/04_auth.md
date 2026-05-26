# 04 — Authentication

**Goal:** users can sign up with email + password, log in, log out, and reset a forgotten password. Pages are protected when needed.

---

## Configure Supabase Auth

Do this manually in Supabase first:

1. **Authentication → Providers** — Email should already be on. Disable "Confirm email" temporarily during dev (re-enable before launch). For Magic Link / OAuth: skip in V1, keep it simple.
2. **Authentication → URL Configuration:**
   - Site URL: your Vercel production URL (e.g. `https://travel-agent.vercel.app`). You can change this later when you have a real domain.
   - Redirect URLs: add `http://localhost:3000/**` and `https://*.vercel.app/**` so password reset emails work in all environments.
3. **Authentication → Email Templates** — leave defaults for now. You'll polish copy in file 10.

---

## Task for Claude Code

> Build the authentication flow for Travel Agent. Use Supabase Auth via the clients in `src/lib/supabase/`. The flow must include sign-up, sign-in, sign-out, password reset request, and password reset confirmation.
>
> **Pages to create (all under `src/app/`):**
>
> 1. `(auth)/login/page.tsx` — email + password form, "Forgot password?" link, link to sign-up.
> 2. `(auth)/signup/page.tsx` — email + password + confirm password, link to login.
> 3. `(auth)/forgot-password/page.tsx` — single email field, triggers reset email.
> 4. `(auth)/reset-password/page.tsx` — new password + confirm, called from the reset email link.
> 5. `(auth)/layout.tsx` — a centered card layout shared by all auth pages.
>
> **Server logic:**
>
> - All auth actions should be Server Actions (the `'use server'` directive), not API routes.
> - On successful sign-up, redirect to `/onboarding` (a placeholder page for now — just say "Welcome").
> - On successful sign-in, redirect to `/` (the homepage / globe).
> - Sign-out should be available as a Server Action callable from anywhere.
>
> **Middleware:**
>
> - Create `src/middleware.ts` that refreshes the Supabase session cookie on every request, following Supabase's official Next.js SSR pattern.
> - The middleware should NOT protect routes yet — we'll add protection rules per-route. The default is public.
>
> **Helper hook:**
>
> - Create `src/lib/auth/use-user.ts` — a client hook returning `{ user, isLoading }` so client components can read the auth state.
>
> **Design:**
>
> - Use shadcn/ui components: `Button`, `Input`, `Label`, `Card`, `Alert`. Install them via `npx shadcn@latest add button input label card alert`.
> - Match the visual style of the existing prototype: white surfaces, soft shadows, DM Sans font, accent color `#2B5BE0`. Configure these as Tailwind theme tokens in `tailwind.config.ts`.
> - Error messages should be friendly and specific. "Invalid email or password" is fine; "AuthApiError: unrecognized credentials" is not.
>
> **Validation:**
>
> - Use `zod` for form schema validation on both client and server. Install if not present.
> - Passwords: minimum 10 characters. No other requirements (length beats complexity for security; over-restrictive rules just push users to "Password123!").
>
> **Edge cases to handle:**
>
> - Already-signed-in user visiting `/login` → redirect to `/`.
> - Sign-up with an existing email → friendly error: "An account with that email already exists. Try signing in."
> - Network error / Supabase down → friendly message: "Something went wrong. Please try again."
>
> **Do NOT:**
>
> - Build social login (Google, Apple) — defer to V2.
> - Build email verification — we've disabled it in Supabase for dev. We'll turn it back on before launch.
> - Add a profile/settings page — that comes later.
>
> When done, walk me through testing each flow manually in the browser. Commit with `feat(auth): email/password auth flow`.

---

## Testing checklist after Claude Code finishes

Test each of these in your browser at `localhost:3000`:

- [ ] `/signup` — create account with a test email like `you+test1@yourdomain.com`. Lands on `/onboarding`.
- [ ] Refresh the page — you're still logged in.
- [ ] Sign out (you may need to add a temporary "Sign out" button to the homepage — ask Claude Code).
- [ ] `/login` — log back in with the same credentials. Lands on `/`.
- [ ] `/login` while logged in — redirects to `/`.
- [ ] `/forgot-password` — submit your email. Check Supabase → Authentication → Logs that the email was sent (during dev, you might need to copy the reset link from the logs rather than checking your inbox).
- [ ] Open the reset link, set a new password, log in with it.

If all six work, you have a real auth system. Don't underestimate this — most projects get stuck here for days.

---

## One thing to verify before moving on

In Supabase → Table Editor → `profiles`, you should see a row for every test user you created. The auto-create trigger from `03_data_model.md` is what makes this happen. If you see auth users in the `auth.users` table but no rows in `public.profiles`, the trigger isn't firing — re-run that SQL.

---

Next file: **`05_flight_data.md`**.

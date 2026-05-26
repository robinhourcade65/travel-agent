# 03 — Data Model

**Goal:** by the end of this session you have a Supabase project, a database connected to your app, and all V1 tables created with security policies.

---

## 1. Create the Supabase project

Do this manually on supabase.com:

1. Go to https://supabase.com/dashboard and click "New project".
2. Name: `travel-agent-prod`.
3. Database password: generate a strong one, **save it in a password manager**.
4. Region: pick the one closest to your main user base (e.g. `eu-west-2` for European users).
5. Pricing: Free tier.
6. Click "Create project". Wait ~2 minutes.

Once it's ready, go to **Project Settings → API** and copy these three values somewhere safe:

- `Project URL` (looks like `https://abc123.supabase.co`)
- `anon public` key (safe to expose to the browser)
- `service_role` key (**server-side only — never expose this to the browser**)

---

## 2. Task for Claude Code — install Supabase client

> Add the Supabase client to the project and create the two helper files needed to use it from server code and from the browser. Follow these requirements:
>
> 1. Install `@supabase/supabase-js` and `@supabase/ssr`.
> 2. Add three new env vars to `.env.local` and `.env.example`:
>    - `NEXT_PUBLIC_SUPABASE_URL`
>    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
>    - `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix — server only)
> 3. Create `src/lib/supabase/client.ts` that exports a `createBrowserClient()` for use in client components.
> 4. Create `src/lib/supabase/server.ts` that exports a `createServerClient()` for use in server components and route handlers, reading the session from cookies.
> 5. Create `src/lib/supabase/admin.ts` that exports a `createAdminClient()` using the service role key. Add a JSDoc comment warning that this client bypasses Row-Level Security and must only be used in trusted server code.
> 6. Do not yet add a sign-up page or any UI — auth UI comes in file 04.
> 7. Commit with message: `feat(db): add supabase clients`.

After Claude Code finishes:

1. Fill in the three values from Supabase's API page into your local `.env.local`.
2. Also add them to **Vercel → your project → Settings → Environment Variables**. Add them for all three environments (Production, Preview, Development).
3. Trigger a redeploy on Vercel to confirm it still builds.

---

## 3. Create the schema

In Supabase → **SQL Editor** → New query, paste the following SQL block. Run it. This creates every table you need for V1.

```sql
-- =========================================================
-- Travel Agent — V1 schema
-- =========================================================

-- USERS: Supabase already provides auth.users. We add a public profiles table.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  home_airport text,         -- IATA code, e.g. "DUB"
  currency text default 'EUR',
  subscription_tier text default 'free' check (subscription_tier in ('free','pro')),
  stripe_customer_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Trigger that creates a profile row whenever a new auth user signs up
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- AIRPORTS: static reference data
create table public.airports (
  iata text primary key,        -- e.g. "JFK"
  city text not null,
  country text not null,
  country_code text not null,   -- ISO-3166 alpha-2, e.g. "US"
  lat double precision not null,
  lon double precision not null,
  is_major boolean default false  -- for the globe's first render
);

create index airports_country_idx on public.airports(country_code);

-- FLIGHT PRICE CACHE: every search result we receive gets stored here
create table public.flight_prices (
  id bigserial primary key,
  origin text not null references public.airports(iata),
  destination text not null references public.airports(iata),
  depart_date date not null,
  return_date date,                          -- null = one-way
  price_minor int not null,                  -- price in minor units (cents)
  currency text not null default 'EUR',
  airline text,                              -- e.g. "Aer Lingus"
  airline_iata text,                         -- e.g. "EI"
  stops smallint default 0,
  duration_minutes int,
  deeplink text,                             -- URL to book the flight
  source text not null,                      -- "duffel", "amadeus", etc.
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null            -- when to refetch
);

create index flight_prices_route_idx on public.flight_prices(origin, destination, depart_date);
create index flight_prices_expires_idx on public.flight_prices(expires_at);

-- INDICATIVE PRICES: precomputed "cheapest price from X to country Y this month"
-- This is what the globe renders against — NOT live searches
create table public.indicative_prices (
  origin text not null references public.airports(iata),
  destination_country text not null,         -- ISO-3166 alpha-2
  cheapest_iata text,                        -- which airport in the country
  price_minor int not null,
  currency text not null default 'EUR',
  month date not null,                       -- first day of the month
  computed_at timestamptz not null default now(),
  primary key (origin, destination_country, month)
);

-- ALERTS: user subscriptions to price changes
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text,                                 -- user-facing label
  origin text not null references public.airports(iata),
  destination text references public.airports(iata),   -- nullable: country/anywhere
  destination_country text,                  -- e.g. "JP" for "anywhere in Japan"
  earliest_depart date,
  latest_depart date,
  min_nights int,
  max_nights int,
  target_price_minor int,                    -- alert when below this
  swing_threshold_pct int default 20,        -- or alert on a swing of N%
  last_seen_price_minor int,                 -- baseline for swing detection
  is_active boolean default true,
  created_at timestamptz default now(),
  last_checked_at timestamptz,
  last_notified_at timestamptz
);

create index alerts_active_idx on public.alerts(is_active, last_checked_at) where is_active = true;
create index alerts_user_idx on public.alerts(user_id);

-- NOTIFICATIONS: log of alerts that fired
create table public.notifications (
  id bigserial primary key,
  alert_id uuid not null references public.alerts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  triggered_price_minor int not null,
  baseline_price_minor int,
  notified_via text not null default 'email',
  delivered_at timestamptz,
  created_at timestamptz default now()
);

-- CHAT THREADS: AI agent conversation history
create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.chat_messages (
  id bigserial primary key,
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  role text not null check (role in ('user','assistant','tool')),
  content jsonb not null,                    -- supports tool calls + text blocks
  created_at timestamptz default now()
);

create index chat_messages_thread_idx on public.chat_messages(thread_id, created_at);

-- =========================================================
-- Row-Level Security
-- =========================================================

alter table public.profiles enable row level security;
alter table public.alerts enable row level security;
alter table public.notifications enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;

-- Profiles: a user can read and update their own profile
create policy "Users read own profile"   on public.profiles for select using (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id);

-- Alerts: full CRUD on own alerts only
create policy "Users CRUD own alerts" on public.alerts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Notifications: read-only on own notifications
create policy "Users read own notifications" on public.notifications
  for select using (auth.uid() = user_id);

-- Chat threads: full CRUD on own
create policy "Users CRUD own threads" on public.chat_threads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Chat messages: full CRUD on messages in own threads
create policy "Users CRUD own messages" on public.chat_messages
  for all using (
    exists (select 1 from public.chat_threads t where t.id = thread_id and t.user_id = auth.uid())
  );

-- airports, flight_prices, indicative_prices are public-readable, server-only-writable
alter table public.airports enable row level security;
create policy "Anyone read airports" on public.airports for select using (true);

alter table public.flight_prices enable row level security;
create policy "Anyone read flight_prices" on public.flight_prices for select using (true);

alter table public.indicative_prices enable row level security;
create policy "Anyone read indicative_prices" on public.indicative_prices for select using (true);
-- Writes to these three tables happen via the service role key only, bypassing RLS.
```

After running, check Supabase → **Table Editor** — you should see all the tables listed.

---

## 4. Seed airport data

You already have ~120 airports in your prototype. Reuse them.

### Task for Claude Code

> Create `scripts/seed-airports.ts`. The script should:
>
> 1. Read the `AIRPORTS` array from my existing prototype (I'll paste it). It contains objects like `{iata, city, country, lat, lon}`.
> 2. For each airport, add a `country_code` (ISO-3166 alpha-2) and an `is_major` boolean (true for the top 50 busiest worldwide — guess sensibly).
> 3. Connect to Supabase using the service-role admin client.
> 4. Upsert all airports into the `public.airports` table.
> 5. Print a summary at the end: how many inserted, how many updated.
>
> Also add a script entry in `package.json` so I can run it with `npm run seed:airports`.
>
> Stop after this and show me the output of running it once.

After it runs, verify in Supabase → Table Editor → `airports` that you have ~120 rows.

---

## 5. End-of-session checklist

- [ ] Supabase project exists
- [ ] Three Supabase clients in `src/lib/supabase/`
- [ ] Env vars set locally AND in Vercel
- [ ] Schema SQL ran without errors
- [ ] All tables visible in Supabase
- [ ] `npm run seed:airports` populated the airports table
- [ ] App still deploys to Vercel
- [ ] Git committed and pushed

Next file: **`04_auth.md`**.

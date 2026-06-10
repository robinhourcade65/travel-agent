-- Per-airport indicative prices: one row per (origin, destination airport, month).
-- Sibling to indicative_prices, which stays per-COUNTRY and drives the country heatmap.
-- This table drives the within-country city-pin color gradient (cheapest gateway = blue).
create table public.airport_indicative_prices (
  origin text not null references public.airports(iata),
  dest_iata text not null references public.airports(iata),
  month date not null,                        -- first day of the month
  price_minor int not null,
  currency text not null default 'EUR',
  computed_at timestamptz not null default now(),
  primary key (origin, dest_iata, month)
);

-- Fast lookup for the city-pins query (origin + airport, freshest first).
create index if not exists airport_indicative_prices_lookup_idx
  on public.airport_indicative_prices (origin, dest_iata, computed_at desc);

-- Public read (non-sensitive cached prices); writes happen via the service role
-- key only, bypassing RLS — same posture as indicative_prices.
alter table public.airport_indicative_prices enable row level security;
create policy "Anyone read airport_indicative_prices"
  on public.airport_indicative_prices for select using (true);

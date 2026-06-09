alter table public.flight_prices
  add column if not exists depart_at timestamptz,
  add column if not exists arrive_at  timestamptz;

-- Phase C — passenger-aware price cache.
--
-- flight_prices was keyed on origin/destination/depart_date/return_date only.
-- Duffel's total_amount is for ALL passengers, so a row cached for 1 adult must
-- never be served to a 2-adult search. We add a passenger signature
-- ("<adults>-<children>-<infants>", e.g. "2-1-0") and include it in the cache
-- lookup + key.
--
-- Existing rows were all produced by Phase B's single-adult search assumption,
-- so the default '1-0-0' backfills them correctly — no clear-out needed here.

alter table public.flight_prices
  add column if not exists pax_sig text not null default '1-0-0';

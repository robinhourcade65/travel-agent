-- Phase C — return-leg time-of-day filtering.
--
-- The cache only stored the outbound leg's depart/arrive. To let users filter by
-- when the return flight leaves ("home for dinner"), we capture the return
-- slice's first-segment departure. Nullable: one-way searches have no return leg.
--
-- Existing rows predate this column, so clear the cache once: the next searches
-- repopulate every row with return_depart_at. flight_prices is a pure cache, so
-- deleting it only forces fresh Duffel fetches — no data is lost.

alter table public.flight_prices
  add column if not exists return_depart_at timestamptz;

delete from public.flight_prices;

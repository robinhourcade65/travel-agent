-- Composite index for the city-pins query: country_code + duffel_supported + is_major
-- Needed by searchAirportsByCountry() which filters on all three columns.
-- The partial form (WHERE duffel_supported = true) keeps the index small since ~95%
-- of rows are duffel_supported; the full form covers the fallback (no is_major filter).
create index if not exists airports_country_duffel_major_idx
  on public.airports (country_code, is_major)
  where duffel_supported = true;

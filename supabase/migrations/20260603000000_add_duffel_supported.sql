alter table public.airports add column duffel_supported boolean not null default true;
create index airports_duffel_supported_idx on public.airports(duffel_supported) where duffel_supported = true;

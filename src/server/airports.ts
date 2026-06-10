'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { COUNTRY_HUBS } from '@/lib/flights/country-hubs'

export type AirportResult = {
  iata: string
  city: string
  country: string
  country_code: string
}

export async function searchAirports(query: string): Promise<AirportResult[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const admin = createAdminClient()
  const search = `%${q}%`

  const { data: primary } = await admin
    .from('airports')
    .select('iata, city, country, country_code')
    .eq('duffel_supported', true)
    .eq('is_major', true)
    .or(`iata.ilike.${search},city.ilike.${search},country.ilike.${search}`)
    .order('iata', { ascending: true })
    .limit(8)

  if (primary && primary.length > 0) return primary

  const { data: fallback } = await admin
    .from('airports')
    .select('iata, city, country, country_code')
    .eq('duffel_supported', true)
    .or(`iata.ilike.${search},city.ilike.${search},country.ilike.${search}`)
    .order('iata', { ascending: true })
    .limit(8)

  return fallback ?? []
}

export type CountryAirport = {
  iata: string
  city: string
  lat: number
  lon: number
}

export async function searchAirportsByCountry(countryCode: string): Promise<CountryAirport[]> {
  const admin = createAdminClient()
  console.time(`city-pins-fetch:${countryCode}`)

  const hubIata = COUNTRY_HUBS[countryCode]

  // If the country has a known hub, fetch it first then fill up to 4 more.
  if (hubIata) {
    const [{ data: hubRows }, { data: restRows }] = await Promise.all([
      admin
        .from('airports')
        .select('iata, city, lat, lon')
        .eq('iata', hubIata)
        .eq('duffel_supported', true)
        .limit(1),
      admin
        .from('airports')
        .select('iata, city, lat, lon')
        .eq('country_code', countryCode)
        .eq('duffel_supported', true)
        .neq('iata', hubIata)
        .order('is_major', { ascending: false })
        .order('iata', { ascending: true })
        .limit(4),
    ])

    console.timeEnd(`city-pins-fetch:${countryCode}`)
    return [...(hubRows ?? []), ...(restRows ?? [])] as CountryAirport[]
  }

  // No hub entry: fall back to is_major DESC ranking.
  const { data } = await admin
    .from('airports')
    .select('iata, city, lat, lon')
    .eq('country_code', countryCode)
    .eq('duffel_supported', true)
    .order('is_major', { ascending: false })
    .order('iata', { ascending: true })
    .limit(5)

  console.timeEnd(`city-pins-fetch:${countryCode}`)
  return (data ?? []) as CountryAirport[]
}

export type CountryAirportPrice = CountryAirport & {
  priceMinor: number | null
  currency: string | null
}

// City pins for a country, each annotated with its indicative price for `month`.
// Reuses searchAirportsByCountry for the curated 5-airport ranking, then left-joins
// airport_indicative_prices (origin + month) in memory so the pins shown stay exactly
// the same 5 we render today — airports with no seeded price get priceMinor: null.
//
// `month` MUST be a first-of-month YYYY-MM-DD key (same format the seeder writes to
// airport_indicative_prices.month). A mismatch silently yields zero price rows, so we
// log a warning when a country with pins comes back with no prices at all.
export async function searchAirportPricesByCountry(
  origin: string,
  countryCode: string,
  month: string,
): Promise<CountryAirportPrice[]> {
  const airports = await searchAirportsByCountry(countryCode)
  if (airports.length === 0) return []

  const admin = createAdminClient()
  const { data: priceRows } = await admin
    .from('airport_indicative_prices')
    .select('dest_iata, price_minor, currency')
    .eq('origin', origin)
    .eq('month', month)
    .in('dest_iata', airports.map((a) => a.iata))

  const priceByIata = new Map(
    (priceRows ?? []).map((r) => [r.dest_iata, { priceMinor: r.price_minor, currency: r.currency }]),
  )

  if (priceByIata.size === 0) {
    console.warn(
      `[airports] No airport prices for ${origin}→${countryCode} month=${month} ` +
        `(${airports.length} pins). If the seed has run, check the month key format ` +
        `matches airport_indicative_prices.month (first-of-month YYYY-MM-DD).`,
    )
  }

  return airports.map((a) => {
    const price = priceByIata.get(a.iata)
    return {
      ...a,
      priceMinor: price?.priceMinor ?? null,
      currency: price?.currency ?? null,
    }
  })
}

export async function getAirportInfo(iata: string): Promise<{ iata: string; city: string } | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('airports')
    .select('iata, city')
    .eq('iata', iata)
    .maybeSingle()
  return data as { iata: string; city: string } | null
}

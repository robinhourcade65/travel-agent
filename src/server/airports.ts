'use server'

import { createAdminClient } from '@/lib/supabase/admin'

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

  // Single query: major airports ranked first, capped at 5 pins per country.
  // No two-query fallback needed — is_major DESC naturally surfaces majors first.
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

export async function getAirportInfo(iata: string): Promise<{ iata: string; city: string } | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('airports')
    .select('iata, city')
    .eq('iata', iata)
    .maybeSingle()
  return data as { iata: string; city: string } | null
}

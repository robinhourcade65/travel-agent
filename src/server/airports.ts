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

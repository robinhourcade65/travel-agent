'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { FlightOffer } from '@/types/flights'

// ---------------------------------------------------------------------------
// Phase C — flight search filters.
//
// All filter state lives in URL params for shareability. This hook is the
// single source of truth: it parses the URL into a typed `Filters` snapshot,
// writes changes back (applying "drop defaults" hygiene), and exposes the two
// halves of the filter pipeline:
//   • serverParams  → passed through to /api/flights/search (stops, passengers)
//   • applyClientFilters → run on the returned offers (duration, time, airline)
//
// Reused by both the desktop right-panel filter section and the mobile sheet.
// ---------------------------------------------------------------------------

export type StopsOption = 'any' | 'max1' | 'max2'
export type TimeSlot = 'morning' | 'afternoon'

export type Filters = {
  direct: boolean
  stops: StopsOption
  durMax: number | null // minutes; null = Any
  adults: number // 1-9
  children: number // 0-9
  infants: number // 0-9 (on lap)
  depTime: Set<TimeSlot> // outbound departure; full set = no filter
  retTime: Set<TimeSlot> // return-leg departure; full set = no filter
  airlines: Set<string> // IATA codes; empty = all airlines
}

// Only passengers reach the search API: they change Duffel's total_amount and
// therefore the cache key. Stops/duration/time/airline are all client-side, so
// changing them never triggers a re-fetch (instant + rate-limit friendly).
export type ServerFilterParams = {
  adults: number
  children: number
  infants: number
}

export type AirlineCount = { iata: string; name: string; count: number }

const ALL_SLOTS: TimeSlot[] = ['morning', 'afternoon']

// --- parsing helpers -------------------------------------------------------

function clampInt(raw: string | null, min: number, max: number, fallback: number): number {
  if (raw === null) return fallback
  const n = parseInt(raw, 10)
  if (Number.isNaN(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function parseStops(raw: string | null): StopsOption {
  return raw === 'max1' || raw === 'max2' ? raw : 'any'
}

// CSV of time slots. Absent param → full set (no filter). Present but with no
// valid tokens (e.g. "none") → empty set (deliberately filters everything out).
function parseSlots(raw: string | null): Set<TimeSlot> {
  if (raw === null) return new Set(ALL_SLOTS)
  const slots = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is TimeSlot => s === 'morning' || s === 'afternoon')
  return new Set(slots)
}

function parseAirlines(raw: string | null): Set<string> {
  if (raw === null) return new Set()
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
  )
}

// Morning = 05:00–11:59, Afternoon = everything else (afternoon/evening/night).
// Parse the hour straight from the ISO string so we use the airport-local time
// Duffel returns, not the browser's timezone.
function timeSlot(iso: string): TimeSlot {
  const hour = parseInt(iso.slice(11, 13), 10)
  return hour >= 5 && hour < 12 ? 'morning' : 'afternoon'
}

// --- hook ------------------------------------------------------------------

export function useFlightFilters() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const sp = searchParams.toString()
  const isRoundTrip = searchParams.get('return') !== null

  const filters = useMemo<Filters>(() => {
    const params = new URLSearchParams(sp)
    return {
      direct: params.get('direct') === '1',
      stops: parseStops(params.get('stops')),
      durMax: params.has('durMax') ? clampInt(params.get('durMax'), 1, 100_000, 0) || null : null,
      adults: clampInt(params.get('adults'), 1, 9, 1),
      children: clampInt(params.get('children'), 0, 9, 0),
      infants: clampInt(params.get('infants'), 0, 9, 0),
      depTime: parseSlots(params.get('depTime')),
      retTime: parseSlots(params.get('retTime')),
      airlines: parseAirlines(params.get('airlines')),
    }
  }, [sp])

  // Serialize a (partial) filter change back to the URL, dropping any filter at
  // its default value so links stay clean and the active-count stays honest.
  const setFilter = useCallback(
    (patch: Partial<Filters>) => {
      const next: Filters = { ...filters, ...patch }
      const params = new URLSearchParams(sp)

      // Stops / direct — mutually exclusive.
      if (next.direct) {
        params.set('direct', '1')
        params.delete('stops')
      } else {
        params.delete('direct')
        if (next.stops !== 'any') params.set('stops', next.stops)
        else params.delete('stops')
      }

      if (next.durMax !== null) params.set('durMax', String(next.durMax))
      else params.delete('durMax')

      // Passengers.
      if (next.adults !== 1) params.set('adults', String(next.adults))
      else params.delete('adults')
      if (next.children !== 0) params.set('children', String(next.children))
      else params.delete('children')
      if (next.infants !== 0) params.set('infants', String(next.infants))
      else params.delete('infants')

      // Time-of-day — store CSV only when narrowed; "none" encodes the empty set.
      writeSlots(params, 'depTime', next.depTime)
      writeSlots(params, 'retTime', next.retTime)

      if (next.airlines.size > 0) {
        params.set('airlines', [...next.airlines].sort().join(','))
      } else {
        params.delete('airlines')
      }

      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [filters, sp, router, pathname],
  )

  // Params that change the actual Duffel search (re-fetch on change).
  const serverParams = useMemo<ServerFilterParams>(
    () => ({ adults: filters.adults, children: filters.children, infants: filters.infants }),
    [filters],
  )

  // Pure client-side narrowing applied after results return: duration,
  // time-of-day (both legs), and airline. Stops/passengers are already handled
  // server-side, but we also honour the stop limit here so cached rows with
  // extra connections are filtered consistently.
  const applyClientFilters = useCallback(
    (offers: FlightOffer[]): FlightOffer[] => {
      return offers.filter((o) => {
        if (filters.direct && o.stops > 0) return false
        if (!filters.direct) {
          if (filters.stops === 'max1' && o.stops > 1) return false
          if (filters.stops === 'max2' && o.stops > 2) return false
        }
        if (filters.durMax !== null && o.durationMinutes > filters.durMax) return false
        if (filters.depTime.size < 2 && !filters.depTime.has(timeSlot(o.departAt))) return false
        if (
          isRoundTrip &&
          filters.retTime.size < 2 &&
          o.returnDepartAt !== null &&
          !filters.retTime.has(timeSlot(o.returnDepartAt))
        ) {
          return false
        }
        if (filters.airlines.size > 0 && !filters.airlines.has(o.airlineIata)) return false
        return true
      })
    },
    [filters, isRoundTrip],
  )

  // Top-5 airlines by count in the current result set, for the airline chips.
  // Returns [] when fewer than 2 distinct airlines (UI hides the filter then).
  const topAirlines = useCallback((offers: FlightOffer[]): AirlineCount[] => {
    const counts = new Map<string, AirlineCount>()
    for (const o of offers) {
      if (!o.airlineIata) continue
      const entry = counts.get(o.airlineIata)
      if (entry) entry.count++
      else counts.set(o.airlineIata, { iata: o.airlineIata, name: o.airline, count: 1 })
    }
    if (counts.size < 2) return []
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 5)
  }, [])

  // Number of distinct filters narrowing the results, for the collapsed badge.
  const activeCount = useMemo(() => {
    let n = 0
    if (filters.direct) n++
    else if (filters.stops !== 'any') n++
    if (filters.durMax !== null) n++
    if (filters.adults !== 1 || filters.children !== 0 || filters.infants !== 0) n++
    if (filters.depTime.size < 2) n++
    if (isRoundTrip && filters.retTime.size < 2) n++
    if (filters.airlines.size > 0) n++
    return n
  }, [filters, isRoundTrip])

  return {
    filters,
    setFilter,
    serverParams,
    applyClientFilters,
    topAirlines,
    activeCount,
    isRoundTrip,
  }
}

function writeSlots(params: URLSearchParams, key: string, slots: Set<TimeSlot>) {
  if (slots.size >= 2) {
    params.delete(key)
  } else if (slots.size === 0) {
    params.set(key, 'none')
  } else {
    params.set(key, [...slots].sort().join(','))
  }
}

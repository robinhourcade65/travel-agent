'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useEffect, useState, useCallback, useRef } from 'react'
import type { FlightOffer } from '@/types/flights'
import { getAirportInfo } from '@/server/airports'
import { getCountryName } from '@/lib/country-names'
import { useFlightFilters } from '@/lib/flights/use-flight-filters'
import FlightList from './FlightList'
import FiltersPanel from './FiltersPanel'
import FlexStrip from './FlexStrip'

type FlightLoadState =
  | { status: 'no-date' }
  | { status: 'loading' }
  | { status: 'loaded'; offers: FlightOffer[] }
  | { status: 'empty' }
  | { status: 'filtered-empty' }
  | { status: 'error'; onRetry: () => void }
  | { status: 'rate-limited'; retryAfterMinutes: number }

function Breadcrumb({
  countryCode,
  countryName,
  cityIata,
  cityName,
  onAllCountries,
  onCountry,
}: {
  countryCode: string
  countryName: string
  cityIata: string | null
  cityName: string | null
  onAllCountries: () => void
  onCountry: () => void
}) {
  return (
    <div className="flex items-center gap-1 px-4 py-3 border-b border-[#F3F4F6] flex-shrink-0 min-w-0">
      <button
        onClick={onAllCountries}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#2B5BE0] transition flex-shrink-0"
        aria-label="Back to all countries"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        All countries
      </button>

      <span className="text-gray-300 text-xs flex-shrink-0">/</span>

      {cityIata ? (
        <button
          onClick={onCountry}
          className="text-xs text-gray-400 hover:text-[#2B5BE0] transition truncate"
        >
          {countryName}
        </button>
      ) : (
        <span className="text-xs font-medium text-gray-700 truncate">{countryName}</span>
      )}

      {cityIata && cityName && (
        <>
          <span className="text-gray-300 text-xs flex-shrink-0">/</span>
          <span className="text-xs font-medium text-gray-700 truncate">
            {cityName} ({cityIata})
          </span>
        </>
      )}
    </div>
  )
}

export default function RightPanel() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const toCountry = searchParams.get('toCountry')
  const to = searchParams.get('to')
  const toCity = searchParams.get('toCity')
  const toDefault = searchParams.get('toDefault')
  const depart = searchParams.get('depart')
  const returnDate = searchParams.get('return')
  const from = searchParams.get('from') ?? 'DUB'

  const [flightState, setFlightState] = useState<FlightLoadState>({ status: 'no-date' })
  const [cityName, setCityName] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const fetchVersion = useRef(0)

  const { applyClientFilters, activeCount, serverParams } = useFlightFilters()
  const { adults, children, infants } = serverParams

  // Resolve city name for breadcrumb when a city pin is selected
  useEffect(() => {
    if (!toCity) {
      setCityName(null)
      return
    }
    getAirportInfo(toCity)
      .then((info) => { if (info) setCityName(info.city) })
      .catch(() => setCityName(null))
  }, [toCity])

  const doFetch = useCallback(() => {
    if (!to) return
    if (!depart) {
      setFlightState({ status: 'no-date' })
      return
    }

    const version = ++fetchVersion.current
    setFlightState({ status: 'loading' })

    const params = new URLSearchParams({
      origin: from,
      destination: to,
      departDate: depart,
    })
    if (returnDate) params.set('returnDate', returnDate)
    if (adults !== 1) params.set('adults', String(adults))
    if (children !== 0) params.set('children', String(children))
    if (infants !== 0) params.set('infants', String(infants))

    fetch(`/api/flights/search?${params.toString()}`)
      .then(async (res) => {
        if (version !== fetchVersion.current) return
        if (res.status === 429) {
          const retryAfterSecs = parseInt(res.headers.get('Retry-After') ?? '3600', 10)
          setFlightState({ status: 'rate-limited', retryAfterMinutes: Math.ceil(retryAfterSecs / 60) })
          return
        }
        if (!res.ok) {
          setFlightState({ status: 'error', onRetry: doFetch })
          return
        }
        const data = await res.json() as { results: FlightOffer[]; count: number }
        if (version !== fetchVersion.current) return
        if (data.count === 0) {
          setFlightState({ status: 'empty' })
        } else {
          setFlightState({ status: 'loaded', offers: data.results })
        }
      })
      .catch(() => {
        if (version !== fetchVersion.current) return
        setFlightState({ status: 'error', onRetry: doFetch })
      })
  }, [from, to, depart, returnDate, adults, children, infants])

  useEffect(() => {
    if (!to) return
    doFetch()
  }, [to, depart, returnDate, doFetch])

  const clearSelection = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('toCountry')
    params.delete('to')
    params.delete('toDefault')
    params.delete('toCity')
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [searchParams, pathname, router])

  const goToCountry = useCallback(() => {
    if (!toDefault) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('to', toDefault)
    params.delete('toCity')
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [toDefault, searchParams, pathname, router])

  // No country selected — placeholder state
  if (!toCountry) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9CA3AF"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-600">Select a country to see flights</p>
        <p className="text-xs text-gray-400 max-w-[180px] leading-relaxed">
          Hover the globe to explore prices, then click a country to drill in.
        </p>
      </div>
    )
  }

  const countryName = getCountryName(toCountry)

  // Raw offers from the server feed the airline list; the displayed list is the
  // result of client-side filtering (duration / stops / time / airline).
  // Computed inline (not useMemo) because it sits below the early returns above.
  const rawOffers = flightState.status === 'loaded' ? flightState.offers : []
  let displayState: FlightLoadState = flightState
  if (flightState.status === 'loaded') {
    const filtered = applyClientFilters(flightState.offers)
    displayState = filtered.length === 0 ? { status: 'filtered-empty' } : { status: 'loaded', offers: filtered }
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <Breadcrumb
        countryCode={toCountry}
        countryName={countryName}
        cityIata={toCity}
        cityName={cityName}
        onAllCountries={clearSelection}
        onCountry={goToCountry}
      />

      {/* Collapsible filters */}
      <div className="flex-shrink-0 border-b border-[#F3F4F6]">
        <button
          onClick={() => setFiltersOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition"
          aria-expanded={filtersOpen}
        >
          <span className="flex items-center gap-2 text-[13px] font-medium text-gray-700">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M6 12h12M10 20h4" />
            </svg>
            Filters
            {activeCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#2B5BE0] text-white text-[10px] font-semibold">
                {activeCount}
              </span>
            )}
          </span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {filtersOpen && <FiltersPanel offers={rawOffers} />}
      </div>

      <FlexStrip />

      <FlightList state={displayState} />
    </div>
  )
}

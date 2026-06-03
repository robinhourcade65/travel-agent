'use client'

import { useRef, useState, useCallback, useEffect, useTransition } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import DatePicker from 'react-datepicker'
import { searchAirports, type AirportResult } from '@/server/airports'

type TripType = 'round' | 'one'

const FLEX_OPTIONS = [
  { label: 'Exact', value: '0' },
  { label: '±1', value: '1' },
  { label: '±3', value: '3' },
  { label: '±7', value: '7' },
]

function parseDate(s: string | null): Date | null {
  if (!s) return null
  const d = new Date(s + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}

function formatDate(d: Date | null): string | null {
  if (!d) return null
  return d.toISOString().slice(0, 10)
}

export default function LeftPanel() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  // Read current URL param values
  const fromParam = searchParams.get('from') ?? 'DUB'
  const departParam = parseDate(searchParams.get('depart'))
  const returnParam = parseDate(searchParams.get('return'))
  const flexParam = searchParams.get('flex') ?? '0'
  const typeParam = (searchParams.get('type') as TripType | null) ?? 'round'

  // Local state
  const [query, setQuery] = useState(fromParam)
  const [results, setResults] = useState<AirportResult[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync query input when URL changes externally
  useEffect(() => {
    setQuery(fromParam)
  }, [fromParam])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const updateParam = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, val] of Object.entries(updates)) {
        if (val === null) params.delete(key)
        else params.set(key, val)
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value
      setQuery(q)
      setDropdownOpen(false)
      if (searchTimer.current) clearTimeout(searchTimer.current)
      if (q.trim().length < 2) {
        setResults([])
        return
      }
      searchTimer.current = setTimeout(() => {
        startTransition(async () => {
          const res = await searchAirports(q)
          setResults(res)
          setDropdownOpen(res.length > 0)
        })
      }, 200)
    },
    [startTransition],
  )

  const handleSelectAirport = useCallback(
    (airport: AirportResult) => {
      setQuery(`${airport.city} (${airport.iata})`)
      setDropdownOpen(false)
      setResults([])
      updateParam({ from: airport.iata })
    },
    [updateParam],
  )

  const handleDepartChange = useCallback(
    (date: Date | null) => updateParam({ depart: formatDate(date) }),
    [updateParam],
  )

  const handleReturnChange = useCallback(
    (date: Date | null) => updateParam({ return: formatDate(date) }),
    [updateParam],
  )

  const handleTripTypeChange = useCallback(
    (type: TripType) => {
      updateParam({ type, ...(type === 'one' ? { return: null } : {}) })
    },
    [updateParam],
  )

  const handleFlexChange = useCallback(
    (value: string) => updateParam({ flex: value }),
    [updateParam],
  )

  return (
    <>
      {/* ── Desktop left panel ── */}
      <div className="hidden md:flex flex-col h-full w-full">
        <div className="p-5 border-b border-[#E5E7EB]">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Search
          </p>

          {/* Origin autocomplete */}
          <div className="relative mb-4" ref={dropdownRef}>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">From</label>
            <input
              type="text"
              value={query}
              onChange={handleQueryChange}
              onFocus={() => results.length > 0 && setDropdownOpen(true)}
              placeholder="City or airport (e.g. Dublin)"
              className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5E7EB] bg-white placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2B5BE0]/30 focus:border-[#2B5BE0] transition"
            />
            {isPending && (
              <div className="absolute right-3 top-8 w-3.5 h-3.5 border-[2px] border-[#2B5BE0] border-t-transparent rounded-full animate-spin" />
            )}
            {dropdownOpen && results.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-30 overflow-hidden">
                {results.map((ap) => (
                  <button
                    key={ap.iata}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleSelectAirport(ap)
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition text-left"
                  >
                    <span className="text-[11px] font-mono font-semibold text-[#2B5BE0] bg-blue-50 px-1.5 py-0.5 rounded flex-shrink-0">
                      {ap.iata}
                    </span>
                    <span className="text-sm text-gray-700 truncate">
                      {ap.city}
                      <span className="text-gray-400 ml-1 text-xs">{ap.country}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Trip type toggle */}
          <div className="flex rounded-lg border border-[#E5E7EB] overflow-hidden mb-4 text-sm">
            {(['round', 'one'] as TripType[]).map((t) => (
              <button
                key={t}
                onClick={() => handleTripTypeChange(t)}
                className={`flex-1 py-2 text-center text-sm transition font-medium ${
                  typeParam === t
                    ? 'bg-[#2B5BE0] text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                {t === 'round' ? 'Round trip' : 'One way'}
              </button>
            ))}
          </div>

          {/* Date pickers */}
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Depart</label>
              <DatePicker
                selected={departParam}
                onChange={handleDepartChange}
                dateFormat="d MMM yyyy"
                placeholderText="Select date"
                minDate={new Date()}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5E7EB] bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2B5BE0]/30 focus:border-[#2B5BE0] transition cursor-pointer"
                wrapperClassName="w-full"
                popperPlacement="bottom-start"
              />
            </div>
            {typeParam === 'round' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Return</label>
                <DatePicker
                  selected={returnParam}
                  onChange={handleReturnChange}
                  dateFormat="d MMM yyyy"
                  placeholderText="Select date"
                  minDate={departParam ?? new Date()}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5E7EB] bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2B5BE0]/30 focus:border-[#2B5BE0] transition cursor-pointer"
                  wrapperClassName="w-full"
                  popperPlacement="bottom-start"
                />
              </div>
            )}
          </div>

          {/* Flexibility chips */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Flexibility</label>
            <div className="flex gap-2 flex-wrap">
              {FLEX_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleFlexChange(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    flexParam === opt.value
                      ? 'bg-[#2B5BE0] border-[#2B5BE0] text-white'
                      : 'bg-white border-[#E5E7EB] text-gray-600 hover:border-[#2B5BE0] hover:text-[#2B5BE0]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 p-5">
          <p className="text-xs text-gray-400 leading-relaxed">
            Showing indicative prices for{' '}
            <span className="font-semibold text-gray-600">{fromParam}</span>. Tap a country to
            explore flights.
          </p>
        </div>
      </div>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden w-full flex items-center gap-2 px-4 py-3 bg-white border-b border-[#E5E7EB]">
        <div className="relative flex-1" ref={dropdownRef}>
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            onFocus={() => results.length > 0 && setDropdownOpen(true)}
            placeholder="From…"
            className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5E7EB] bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2B5BE0]/30 focus:border-[#2B5BE0]"
          />
          {dropdownOpen && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-30 overflow-hidden">
              {results.map((ap) => (
                <button
                  key={ap.iata}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleSelectAirport(ap)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left"
                >
                  <span className="text-[11px] font-mono font-semibold text-[#2B5BE0]">
                    {ap.iata}
                  </span>
                  <span className="text-sm text-gray-700 truncate">{ap.city}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <DatePicker
          selected={departParam}
          onChange={handleDepartChange}
          dateFormat="d MMM"
          placeholderText="Depart"
          minDate={new Date()}
          className="w-28 px-3 py-2 text-sm rounded-lg border border-[#E5E7EB] bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2B5BE0]/30 focus:border-[#2B5BE0] cursor-pointer"
          wrapperClassName="w-28"
          popperPlacement="bottom-start"
        />
      </div>
    </>
  )
}

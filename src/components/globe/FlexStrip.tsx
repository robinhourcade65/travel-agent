'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useFlightFilters } from '@/lib/flights/use-flight-filters'

type DayCell =
  | { date: string; priceMinor: number; currency: string }
  | { date: string; status: 'empty' | 'error' | 'unavailable' }

type StripState =
  | { status: 'idle' }
  | { status: 'loading'; count: number }
  | { status: 'loaded'; days: DayCell[] }
  | { status: 'error' }

function hasPrice(d: DayCell): d is { date: string; priceMinor: number; currency: string } {
  return 'priceMinor' in d
}

function dayName(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IE', { weekday: 'short' })
}

function dayNum(date: string): string {
  return String(new Date(`${date}T00:00:00`).getDate())
}

function formatPrice(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100)
}

export default function FlexStrip() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const from = searchParams.get('from') ?? 'DUB'
  const to = searchParams.get('to')
  const depart = searchParams.get('depart')
  const returnDate = searchParams.get('return')
  const flex = searchParams.get('flex') ?? '0'

  const { serverParams } = useFlightFilters()
  const { adults, children, infants } = serverParams

  const [state, setState] = useState<StripState>({ status: 'idle' })
  const fetchVersion = useRef(0)

  const active = flex !== '0' && !!to && !!depart

  useEffect(() => {
    if (!active || !to || !depart) {
      setState({ status: 'idle' })
      return
    }

    const version = ++fetchVersion.current
    const count = Number(flex) * 2 + 1
    setState({ status: 'loading', count })

    const params = new URLSearchParams({ origin: from, destination: to, depart, flex })
    if (returnDate) params.set('returnDate', returnDate)
    if (adults !== 1) params.set('adults', String(adults))
    if (children !== 0) params.set('children', String(children))
    if (infants !== 0) params.set('infants', String(infants))

    fetch(`/api/flights/flex?${params.toString()}`)
      .then(async (res) => {
        if (version !== fetchVersion.current) return
        if (!res.ok) {
          setState({ status: 'error' })
          return
        }
        const data = (await res.json()) as { days: DayCell[] }
        if (version !== fetchVersion.current) return
        setState({ status: 'loaded', days: data.days })
      })
      .catch(() => {
        if (version !== fetchVersion.current) return
        setState({ status: 'error' })
      })
  }, [active, from, to, depart, returnDate, flex, adults, children, infants])

  const selectDate = useCallback(
    (date: string) => {
      if (date === depart) return
      const params = new URLSearchParams(searchParams.toString())
      params.set('depart', date)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [depart, searchParams, pathname, router],
  )

  if (!active) return null

  // Cheapest priced day → light-blue highlight.
  const cheapest =
    state.status === 'loaded'
      ? state.days.reduce<number | null>(
          (min, d) => (hasPrice(d) && (min === null || d.priceMinor < min) ? d.priceMinor : min),
          null,
        )
      : null

  return (
    <div className="flex-shrink-0 border-b border-[#F3F4F6] px-3 py-2.5 overflow-x-auto">
      <div className="flex gap-1.5 min-w-min">
        {state.status === 'loading' &&
          Array.from({ length: state.count }).map((_, i) => (
            <div key={i} className="w-[58px] h-[58px] rounded-lg bg-gray-100 animate-pulse flex-shrink-0" />
          ))}

        {state.status === 'error' && (
          <p className="text-xs text-gray-400 py-3 px-1">Couldn&apos;t load nearby dates.</p>
        )}

        {state.status === 'loaded' &&
          state.days.map((d) => {
            const selected = d.date === depart
            const priced = hasPrice(d)
            const isCheapest = priced && cheapest !== null && d.priceMinor === cheapest
            const disabled = !priced

            return (
              <button
                key={d.date}
                type="button"
                onClick={() => selectDate(d.date)}
                disabled={disabled}
                className={`w-[58px] flex-shrink-0 flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg border text-center transition ${
                  selected
                    ? 'bg-[#2B5BE0] border-[#2B5BE0] text-white'
                    : isCheapest
                      ? 'bg-[#EAF1FF] border-[#C7DAFF] text-gray-800 hover:border-[#2B5BE0]'
                      : disabled
                        ? 'bg-white border-[#F3F4F6] text-gray-300 cursor-default'
                        : 'bg-white border-[#E5E7EB] text-gray-700 hover:border-[#2B5BE0]'
                }`}
              >
                <span className={`text-[10px] ${selected ? 'text-white/80' : 'text-gray-400'}`}>
                  {dayName(d.date)}
                </span>
                <span className="text-sm font-semibold tabular-nums leading-none">{dayNum(d.date)}</span>
                <span className={`text-[10px] tabular-nums ${selected ? 'text-white' : 'text-gray-500'}`}>
                  {priced ? formatPrice(d.priceMinor, d.currency) : '—'}
                </span>
              </button>
            )
          })}
      </div>
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { FlightOffer } from '@/types/flights'
import FlightCard from './FlightCard'

type SortKey = 'price' | 'duration' | 'departure'

type LoadState =
  | { status: 'no-date' }
  | { status: 'loading' }
  | { status: 'loaded'; offers: FlightOffer[] }
  | { status: 'empty' }
  | { status: 'filtered-empty' }
  | { status: 'error'; onRetry: () => void }
  | { status: 'rate-limited'; retryAfterMinutes: number }

type Props = {
  state: LoadState
}

function SkeletonCard() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#F3F4F6]">
      <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-gray-200 animate-pulse rounded w-32" />
        <div className="h-3 bg-gray-100 animate-pulse rounded w-44" />
      </div>
      <div className="space-y-1.5 text-right">
        <div className="h-3.5 bg-gray-200 animate-pulse rounded w-14" />
        <div className="h-2.5 bg-gray-100 animate-pulse rounded w-8 ml-auto" />
      </div>
    </div>
  )
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'price', label: 'Price' },
  { key: 'duration', label: 'Duration' },
  { key: 'departure', label: 'Departure' },
]

export default function FlightList({ state }: Props) {
  const [sort, setSort] = useState<SortKey>('price')

  const sorted = useMemo(() => {
    if (state.status !== 'loaded') return []
    if (sort === 'price') {
      return [...state.offers].sort((a, b) => a.priceMinor - b.priceMinor)
    }
    if (sort === 'duration') {
      return [...state.offers].sort((a, b) => a.durationMinutes - b.durationMinutes)
    }
    if (sort === 'departure') {
      return [...state.offers].sort(
        (a, b) => new Date(a.departAt).getTime() - new Date(b.departAt).getTime(),
      )
    }
    return state.offers
  }, [state, sort])

  return (
    <div className="flex flex-col h-full">
      {/* Sort toggle */}
      <div className="flex items-center gap-1 px-4 py-2.5 border-b border-[#F3F4F6] flex-shrink-0">
        <span className="text-[11px] text-gray-400 mr-1">Sort:</span>
        {SORT_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSort(key)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
              sort === key
                ? 'bg-[#2B5BE0] text-white'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {state.status === 'loading' && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {state.status === 'loaded' && (
          sorted.map((offer) => <FlightCard key={offer.id} offer={offer} />)
        )}

        {state.status === 'empty' && (
          <div className="flex flex-col items-center justify-center h-full gap-2 px-6 py-12 text-center">
            <p className="text-sm font-medium text-gray-700">No flights found for these dates.</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              Try a nearby date from the flexibility strip above.
            </p>
          </div>
        )}

        {state.status === 'filtered-empty' && (
          <div className="flex flex-col items-center justify-center h-full gap-2 px-6 py-12 text-center">
            <p className="text-sm font-medium text-gray-700">No flights match your filters.</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              Loosen the filters above to see more options.
            </p>
          </div>
        )}

        {state.status === 'error' && (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 py-12 text-center">
            <p className="text-sm font-medium text-gray-700">Couldn&apos;t load flights.</p>
            <button
              onClick={state.onRetry}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#2B5BE0] rounded-lg hover:bg-[#2348C0] transition"
            >
              Retry
            </button>
          </div>
        )}

        {state.status === 'rate-limited' && (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 py-12 text-center">
            <p className="text-sm font-medium text-gray-700">Too many searches.</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              Try again in {state.retryAfterMinutes}{' '}
              {state.retryAfterMinutes === 1 ? 'minute' : 'minutes'}, or{' '}
              <Link
                href="/signup"
                className="font-semibold text-[#2B5BE0] hover:underline"
              >
                sign up
              </Link>{' '}
              for more capacity.
            </p>
          </div>
        )}

        {state.status === 'no-date' && (
          <div className="flex flex-col items-center justify-center h-full gap-2 px-6 py-12 text-center">
            <p className="text-sm font-medium text-gray-700">Pick a departure date to see flights.</p>
          </div>
        )}
      </div>
    </div>
  )
}

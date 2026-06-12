'use client'

import type { FlightOffer } from '@/types/flights'
import { useFlightFilters, type StopsOption } from '@/lib/flights/use-flight-filters'

// Duration slider marks. The final mark (null) means "Any" — no limit.
const DURATION_MARKS: { label: string; value: number | null }[] = [
  { label: '4h', value: 240 },
  { label: '8h', value: 480 },
  { label: '12h', value: 720 },
  { label: '24h', value: 1440 },
  { label: 'Any', value: null },
]

const STOPS_OPTIONS: { value: StopsOption; label: string }[] = [
  { value: 'any', label: 'Any stops' },
  { value: 'max1', label: 'Max 1 stop' },
  { value: 'max2', label: 'Max 2 stops' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-b border-[#F3F4F6] last:border-b-0">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2.5">{title}</p>
      {children}
    </div>
  )
}

function Counter({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <span className="text-sm text-gray-700">{label}</span>
        {hint && <span className="text-xs text-gray-400 ml-1.5">{hint}</span>}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
          className="w-7 h-7 rounded-full border border-[#E5E7EB] flex items-center justify-center text-gray-600 hover:border-[#2B5BE0] hover:text-[#2B5BE0] disabled:opacity-30 disabled:hover:border-[#E5E7EB] disabled:hover:text-gray-600 transition"
        >
          –
        </button>
        <span className="w-4 text-center text-sm font-medium tabular-nums text-gray-900">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`Increase ${label}`}
          className="w-7 h-7 rounded-full border border-[#E5E7EB] flex items-center justify-center text-gray-600 hover:border-[#2B5BE0] hover:text-[#2B5BE0] disabled:opacity-30 disabled:hover:border-[#E5E7EB] disabled:hover:text-gray-600 transition"
        >
          +
        </button>
      </div>
    </div>
  )
}

type Props = {
  // Raw (unfiltered) offers from the current search — drives the airline list.
  // Unused until the airline section ships; accepted now to keep the API stable.
  offers: FlightOffer[]
}

export default function FiltersPanel({ offers: _offers }: Props) {
  const { filters, setFilter } = useFlightFilters()

  // Map the slider index (0..4) to a duration cap; index 4 = Any (null).
  const durIndex = filters.durMax === null
    ? DURATION_MARKS.length - 1
    : DURATION_MARKS.findIndex((m) => m.value === filters.durMax)
  const safeDurIndex = durIndex === -1 ? DURATION_MARKS.length - 1 : durIndex

  return (
    <div className="bg-white">
      {/* Stops */}
      <Section title="Stops">
        <label className="flex items-center justify-between cursor-pointer mb-2.5">
          <span className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            Direct only
          </span>
          <span className="relative inline-block">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={filters.direct}
              onChange={(e) => setFilter({ direct: e.target.checked })}
            />
            <span className="block w-9 h-5 rounded-full bg-gray-200 peer-checked:bg-[#2B5BE0] transition" />
            <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition peer-checked:translate-x-4" />
          </span>
        </label>

        <select
          value={filters.stops}
          disabled={filters.direct}
          onChange={(e) => setFilter({ stops: e.target.value as StopsOption })}
          className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5E7EB] bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2B5BE0]/30 focus:border-[#2B5BE0] disabled:bg-gray-50 disabled:text-gray-400 transition"
        >
          {STOPS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Section>

      {/* Max duration */}
      <Section title="Max duration">
        <input
          type="range"
          min={0}
          max={DURATION_MARKS.length - 1}
          step={1}
          value={safeDurIndex}
          onChange={(e) => setFilter({ durMax: DURATION_MARKS[Number(e.target.value)].value })}
          className="w-full accent-[#2B5BE0] cursor-pointer"
          aria-label="Maximum flight duration"
        />
        <div className="flex justify-between mt-1.5">
          {DURATION_MARKS.map((m, i) => (
            <span
              key={m.label}
              className={`text-[10px] ${i === safeDurIndex ? 'text-[#2B5BE0] font-semibold' : 'text-gray-400'}`}
            >
              {m.label}
            </span>
          ))}
        </div>
      </Section>

      {/* Passengers */}
      <Section title="Passengers">
        <Counter label="Adults" value={filters.adults} min={1} max={9} onChange={(v) => setFilter({ adults: v })} />
        <Counter label="Children" value={filters.children} min={0} max={9} onChange={(v) => setFilter({ children: v })} />
        <Counter
          label="Infants"
          hint="on lap"
          value={filters.infants}
          min={0}
          max={9}
          onChange={(v) => setFilter({ infants: v })}
        />
      </Section>
    </div>
  )
}

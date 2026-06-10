'use client'

import { CONTINENT_META } from '@/lib/continents'

type Props = {
  // continent key → number of countries with heatmap data
  counts: Record<string, number>
  // currently active continent keys, e.g. ['eu'] or ['eu','as'] or ['world']
  selected: string[]
  onSelect: (key: string) => void
}

export default function ContinentFilter({ counts, selected, onSelect }: Props) {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0)

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex flex-wrap justify-center gap-1.5 max-w-[90%]">
      {CONTINENT_META.map(({ key, label }) => {
        const active = selected.includes(key)
        const count = key === 'world' ? total : (counts[key] ?? 0)
        return (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors duration-200 backdrop-blur-sm select-none ${
              active
                ? 'bg-[#2B5BE0] border-[#2B5BE0] text-white'
                : 'bg-white/80 border-[#E5E7EB] text-gray-600 hover:border-[#2B5BE0] hover:text-[#2B5BE0]'
            }`}
          >
            {label}
            <span className={active ? 'text-white/70 ml-1' : 'text-gray-400 ml-1'}>
              ({count})
            </span>
          </button>
        )
      })}
    </div>
  )
}

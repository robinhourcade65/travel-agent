'use client'

export type TooltipData = {
  countryName: string
  priceMinor: number | null
  currency: string
  iata: string | null
}

type Props = {
  data: TooltipData | null
  x: number
  y: number
}

export default function Tooltip({ data, x, y }: Props) {
  if (!data) return null

  const formattedPrice =
    data.priceMinor !== null
      ? new Intl.NumberFormat('en-IE', {
          style: 'currency',
          currency: data.currency || 'EUR',
          maximumFractionDigits: 0,
        }).format(data.priceMinor / 100)
      : null

  return (
    <div
      style={{
        position: 'fixed',
        left: x + 14,
        top: y + 14,
        pointerEvents: 'none',
        zIndex: 50,
        transform: 'translateZ(0)',
      }}
      className="bg-white rounded-xl shadow-lg border border-[#E5E7EB] px-3.5 py-2.5 min-w-[140px]"
    >
      <p className="font-semibold text-[13px] text-gray-900 leading-tight">{data.countryName}</p>
      {formattedPrice && data.iata ? (
        <p className="text-gray-500 text-[12px] mt-1 leading-tight">
          From{' '}
          <span className="text-gray-900 font-semibold">{formattedPrice}</span>
          <span className="ml-1.5 text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono tracking-wide">
            {data.iata}
          </span>
        </p>
      ) : (
        <p className="text-gray-400 text-[11px] mt-0.5">No price data</p>
      )}
    </div>
  )
}

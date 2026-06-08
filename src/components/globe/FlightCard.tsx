'use client'

import { useState } from 'react'
import type { FlightOffer } from '@/types/flights'

type Props = {
  offer: FlightOffer
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function stopsLabel(stops: number): string {
  if (stops === 0) return 'Direct'
  if (stops === 1) return '1 stop'
  return `${stops} stops`
}

function formatPrice(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100)
}

// Deterministic color from airline IATA code for the logo fallback circle
function airlineColor(iata: string): string {
  const colors = [
    '#2B5BE0', '#0EA5E9', '#7C3AED', '#059669', '#D97706',
    '#DC2626', '#9333EA', '#0891B2', '#65A30D', '#C2410C',
  ]
  let hash = 0
  for (let i = 0; i < iata.length; i++) hash = (hash * 31 + iata.charCodeAt(i)) & 0xffffffff
  return colors[Math.abs(hash) % colors.length]
}

function AirlineLogo({ iata }: { iata: string }) {
  const [errored, setErrored] = useState(false)
  if (errored) {
    return (
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
        style={{ backgroundColor: airlineColor(iata) }}
      >
        {iata.slice(0, 2)}
      </div>
    )
  }
  return (
    <img
      src={`https://content.airhex.com/content/logos/airlines_${iata}_50_50_s.png`}
      alt={iata}
      width={40}
      height={40}
      className="w-10 h-10 rounded-full object-contain flex-shrink-0 bg-gray-50"
      onError={() => setErrored(true)}
    />
  )
}

export default function FlightCard({ offer }: Props) {
  const href = offer.deeplink ?? `/flight/${offer.id}`
  const isExternal = !!offer.deeplink

  return (
    <a
      href={href}
      target={isExternal ? '_blank' : '_self'}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors border-b border-[#F3F4F6] last:border-b-0 cursor-pointer group"
    >
      <AirlineLogo iata={offer.airlineIata} />

      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900 tabular-nums">
          {formatTime(offer.departAt)} → {formatTime(offer.arriveAt)}
        </div>
        <div className="text-xs text-gray-500 mt-0.5 truncate">
          {formatDuration(offer.durationMinutes)} · {stopsLabel(offer.stops)} · {offer.airline}
        </div>
      </div>

      <div className="flex-shrink-0 text-right flex items-center gap-1.5">
        <div>
          <div className="text-sm font-bold text-gray-900">
            {formatPrice(offer.priceMinor, offer.currency)}
          </div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wide">{offer.currency}</div>
        </div>
        <svg
          className="w-4 h-4 text-gray-300 group-hover:text-[#2B5BE0] transition-colors flex-shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </a>
  )
}

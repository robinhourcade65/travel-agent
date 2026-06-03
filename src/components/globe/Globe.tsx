'use client'

import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import GlobeGL, { type GlobeMethods } from 'react-globe.gl'
import { MeshPhongMaterial, Color, AmbientLight, DirectionalLight } from 'three'
import Tooltip, { type TooltipData } from './Tooltip'

type HeatmapEntry = {
  countryCode: string
  cheapestIata: string
  priceMinor: number
  currency: string
}

type HeatmapData = {
  origin: string
  results: HeatmapEntry[]
  count: number
  computedAt: string | null
}

type GeoFeature = {
  type: 'Feature'
  properties: Record<string, string>
  geometry: { type: string; coordinates: unknown }
}

type Props = {
  origin: string
}

const NO_DATA_COLOR = '#E5E7EB'
const STROKE_COLOR = '#D1D5DB'
const HOVER_ALTITUDE = 0.018
const BASE_ALTITUDE = 0.006

function lerpRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

const BLUE: [number, number, number] = [59, 130, 246]
const YELLOW: [number, number, number] = [251, 191, 36]
const RED: [number, number, number] = [239, 68, 68]

function priceToColor(t: number): string {
  const c = Math.max(0, Math.min(1, t))
  const [r, g, b] =
    c <= 0.5 ? lerpRgb(BLUE, YELLOW, c * 2) : lerpRgb(YELLOW, RED, (c - 0.5) * 2)
  return `rgb(${r},${g},${b})`
}

function resolveIso(props: Record<string, string>): string | null {
  const a2 = props.ISO_A2
  if (a2 && a2 !== '-99') return a2
  const eh = props.ISO_A2_EH
  if (eh && eh !== '-99') return eh
  return null
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const diffMins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const h = Math.floor(diffMins / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function Globe({ origin }: Props) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [geoFeatures, setGeoFeatures] = useState<GeoFeature[] | null>(null)
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [hoveredFeature, setHoveredFeature] = useState<GeoFeature | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [tick, setTick] = useState(0)

  const globeMaterial = useMemo(
    () =>
      new MeshPhongMaterial({
        color: new Color('#F0F4F8'),
        shininess: 6,
        specular: new Color('#FFFFFF'),
      }),
    [],
  )

  // Container resize observer — passes explicit dimensions to WebGL canvas
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height })
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // GeoJSON — loaded once, never again
  useEffect(() => {
    fetch('/ne_110m_admin_0_countries.geojson')
      .then((r) => r.json())
      .then((json) => setGeoFeatures(json.features as GeoFeature[]))
      .catch(() => setLoadError(true))
  }, [])

  // Heatmap — re-fetched only when origin changes; result cached in state
  useEffect(() => {
    setHeatmap(null)
    fetch(`/api/flights/heatmap?origin=${encodeURIComponent(origin)}`)
      .then((r) => r.json())
      .then((data: HeatmapData) => setHeatmap(data))
      .catch(() => setLoadError(true))
  }, [origin])

  // Color map: countryCode → hex — rebuilt only when heatmap results change
  const colorMap = useMemo(() => {
    const map = new Map<string, string>()
    if (!heatmap || heatmap.results.length === 0) return map
    const prices = heatmap.results.map((r) => r.priceMinor)
    const minP = Math.min(...prices)
    const range = Math.max(...prices) - minP || 1
    for (const entry of heatmap.results) {
      map.set(entry.countryCode, priceToColor((entry.priceMinor - minP) / range))
    }
    return map
  }, [heatmap])

  // Inactivity timer — stops auto-rotate on interaction, resumes after 5s idle
  const resetInactivity = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    if (globeRef.current) globeRef.current.controls().autoRotate = false
    inactivityTimer.current = setTimeout(() => {
      if (globeRef.current) globeRef.current.controls().autoRotate = true
    }, 5000)
  }, [])

  // Global mouse tracking for tooltip position + inactivity detection
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY })
      resetInactivity()
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [resetInactivity])

  // Cleanup inactivity timer on unmount
  useEffect(() => {
    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    }
  }, [])

  // Tick every 30s to refresh "Updated X ago" label
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(id)
  }, [])

  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current
    if (!globe) return
    globe.lights([
      new AmbientLight(0xffffff, 0.85),
      (() => {
        const d = new DirectionalLight(0xffffff, 0.45)
        d.position.set(0, 8, 4)
        return d
      })(),
    ])
    globe.controls().autoRotate = true
    globe.controls().autoRotateSpeed = 0.3
    globe.controls().enableDamping = true
  }, [])

  const getPolygonColor = useCallback(
    (feat: object) => {
      const code = resolveIso((feat as GeoFeature).properties)
      return code ? (colorMap.get(code) ?? NO_DATA_COLOR) : NO_DATA_COLOR
    },
    [colorMap],
  )

  const getPolygonAltitude = useCallback(
    (feat: object) => (feat === hoveredFeature ? HOVER_ALTITUDE : BASE_ALTITUDE),
    [hoveredFeature],
  )

  const handlePolygonHover = useCallback((feat: object | null) => {
    setHoveredFeature((feat as GeoFeature | null))
  }, [])

  const handlePolygonClick = useCallback((feat: object) => {
    const code = resolveIso((feat as GeoFeature).properties)
    if (code) console.log('[globe] country selected:', code)
  }, [])

  const tooltipData = useMemo((): TooltipData | null => {
    if (!hoveredFeature || !heatmap) return null
    const code = resolveIso(hoveredFeature.properties)
    const entry = code ? heatmap.results.find((r) => r.countryCode === code) : undefined
    const name =
      hoveredFeature.properties.ADMIN ||
      hoveredFeature.properties.NAME ||
      hoveredFeature.properties.NAME_LONG ||
      'Unknown'
    return {
      countryName: name,
      priceMinor: entry?.priceMinor ?? null,
      currency: entry?.currency ?? 'EUR',
      iata: entry?.cheapestIata ?? null,
    }
  }, [hoveredFeature, heatmap])

  const isLoading = !geoFeatures || !heatmap
  const isEmpty = !isLoading && heatmap.count === 0

  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#FAFAFA]">
        <p className="text-gray-400 text-sm">Failed to load map data.</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="w-full h-full relative bg-[#FAFAFA] overflow-hidden">
      {/* Loading skeleton */}
      {isLoading ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 pointer-events-none">
          <div className="w-10 h-10 border-[3px] border-[#2B5BE0] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading flight prices…</p>
        </div>
      ) : null}

      {/* Empty state */}
      {isEmpty ? (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl px-6 py-5 shadow-md border border-[#E5E7EB] max-w-xs text-center">
            <p className="text-sm font-medium text-gray-700 leading-snug">
              Indicative prices are still computing for this origin.
            </p>
            <p className="text-xs text-gray-400 mt-1.5">Try DUB, LHR, or CDG in the meantime.</p>
          </div>
        </div>
      ) : null}

      {/* Globe canvas — only mount when container has measured dimensions */}
      {dimensions.width > 0 && dimensions.height > 0 ? (
        <GlobeGL
          ref={globeRef as React.MutableRefObject<GlobeMethods | undefined>}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl={null}
          globeMaterial={globeMaterial}
          showAtmosphere={false}
          showGraticules={false}
          polygonsData={geoFeatures ?? []}
          polygonCapColor={getPolygonColor}
          polygonSideColor={getPolygonColor}
          polygonStrokeColor={() => STROKE_COLOR}
          polygonAltitude={getPolygonAltitude}
          polygonsTransitionDuration={200}
          onPolygonHover={handlePolygonHover}
          onPolygonClick={handlePolygonClick}
          onGlobeReady={handleGlobeReady}
          showPointerCursor
        />
      ) : null}

      {/* Live pulse */}
      {heatmap ? (
        <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-white/80 backdrop-blur-sm border border-[#E5E7EB] rounded-full px-3 py-1.5 text-[11px] text-gray-500 select-none pointer-events-none">
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E]" />
          </span>
          {/* key={tick} forces re-render so relativeTime updates */}
          <span key={tick}>Updated {relativeTime(heatmap.computedAt)}</span>
        </div>
      ) : null}

      {/* Hover tooltip — fixed position follows cursor */}
      <Tooltip data={hoveredFeature ? tooltipData : null} x={mousePos.x} y={mousePos.y} />
    </div>
  )
}

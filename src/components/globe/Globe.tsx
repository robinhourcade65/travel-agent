'use client'

import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import GlobeGL, { type GlobeMethods } from 'react-globe.gl'
import { MeshPhongMaterial, Color, AmbientLight, DirectionalLight } from 'three'
import Tooltip, { type TooltipData } from './Tooltip'
import ContinentFilter from './ContinentFilter'
import { searchAirportPricesByCountry, type CountryAirportPrice } from '@/server/airports'
import {
  continentOf,
  resolveContinentSelection,
  CONTINENT_CENTERS,
} from '@/lib/continents'

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
  selectedCountryCode: string | null
  selectedIata: string | null
  selectedContinents: string[]
}

const NO_DATA_COLOR = '#F5F5F4'
const STROKE_COLOR = '#D1D5DB'
const HOVER_ALTITUDE = 0.018
const BASE_ALTITUDE = 0.006
// Background of the globe canvas — non-selected countries blend toward this to read as ~30% opacity.
const BACKGROUND_RGB: [number, number, number] = [250, 250, 250] // #FAFAFA
const FADE_AMOUNT = 0.7 // blend 70% toward background ≈ 30% opacity

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

function priceToRgb(t: number): [number, number, number] {
  const c = Math.max(0, Math.min(1, t))
  return c <= 0.5 ? lerpRgb(BLUE, YELLOW, c * 2) : lerpRgb(YELLOW, RED, (c - 0.5) * 2)
}

function rgbString([r, g, b]: [number, number, number]): string {
  return `rgb(${r},${g},${b})`
}

function priceToColor(t: number): string {
  return rgbString(priceToRgb(t))
}

// Blend a color toward the canvas background so faded (non-selected) countries read as ~30% opacity
// without relying on WebGL alpha (react-globe.gl polygon cap meshes drop the alpha channel).
function fadeToBackground(rgb: [number, number, number]): string {
  return rgbString(lerpRgb(rgb, BACKGROUND_RGB, FADE_AMOUNT))
}

function resolveIso(props: Record<string, string>): string | null {
  const a2 = props.ISO_A2
  if (a2 && a2 !== '-99') return a2
  const eh = props.ISO_A2_EH
  if (eh && eh !== '-99') return eh
  return null
}

function formatPrice(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100)
}

// First day of next month as YYYY-MM-DD (UTC). MUST match the format the seeder
// writes to airport_indicative_prices.month — see refreshIndicativePrices /
// nextThreeMonths (offset 1) and the heatmap route's defaultMonthKey. A mismatch
// makes searchAirportPricesByCountry return no prices and every pin shows as no-data.
function nextMonthKey(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 10)
}

const PIN_DEFAULT_COLOR = '#2B5BE0'

// Within-country pin colors: rescale the blue→yellow→red gradient across only this
// country's seeded prices, so the cheapest gateway reads as deep blue and the priciest
// as red regardless of the global scale. Airports with no price are omitted (callers
// fall back to PIN_DEFAULT_COLOR). When all priced airports share one price (range 0),
// they render at the gradient midpoint rather than collapsing to an extreme.
function buildPinColorMap(airports: CountryAirportPrice[]): Map<string, string> {
  const map = new Map<string, string>()
  const priced = airports.filter((a) => a.priceMinor != null)
  if (priced.length === 0) return map

  const prices = priced.map((a) => a.priceMinor as number)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min

  for (const a of priced) {
    const t = range === 0 ? 0.5 : ((a.priceMinor as number) - min) / range
    map.set(a.iata, priceToColor(t))
  }
  return map
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

type Bounds = { minLat: number; maxLat: number; minLng: number; maxLng: number; area: number }

function ringsBounds(rings: [number, number][][]): Bounds {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
      if (lng < minLng) minLng = lng
      if (lng > maxLng) maxLng = lng
    }
  }
  return { minLat, maxLat, minLng, maxLng, area: (maxLat - minLat) * (maxLng - minLng) }
}

function getFeatureBounds(geometry: { type: string; coordinates: unknown }): {
  lat: number; lng: number; area: number
} {
  let best: Bounds

  if (geometry.type === 'Polygon') {
    best = ringsBounds(geometry.coordinates as [number, number][][])
  } else if (geometry.type === 'MultiPolygon') {
    // Use only the largest individual polygon — prevents overseas territories (French Guiana,
    // Falklands, Hawaii, Greenland, etc.) from inflating the bounding box and breaking the zoom.
    best = { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0, area: 0 }
    for (const poly of geometry.coordinates as [number, number][][][]) {
      const b = ringsBounds(poly)
      if (b.area > best.area) best = b
    }
  } else {
    return { lat: 0, lng: 0, area: 1 }
  }

  return {
    lat: (best.minLat + best.maxLat) / 2,
    lng: (best.minLng + best.maxLng) / 2,
    area: best.area,
  }
}

// Altitude at altitude 0.5 = very close (small country fills view); 1.5 = zoomed out (Russia/USA)
function altitudeForArea(area: number): number {
  return Math.max(0.5, Math.min(1.5, Math.sqrt(area) / 30))
}

export default function Globe({
  origin,
  selectedCountryCode,
  selectedIata,
  selectedContinents,
}: Props) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Ref keeps selectedCountryCode accessible inside timeout callbacks without stale closures
  const selectedCountryCodeRef = useRef(selectedCountryCode)

  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [geoFeatures, setGeoFeatures] = useState<GeoFeature[] | null>(null)
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [hoveredFeature, setHoveredFeature] = useState<GeoFeature | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [tick, setTick] = useState(0)
  const [countryAirports, setCountryAirports] = useState<CountryAirportPrice[]>([])
  const [globeReady, setGlobeReady] = useState(false)

  // Month whose prices the city pins reflect — the same default month the heatmap uses.
  const monthKey = useMemo(nextMonthKey, [])

  const globeMaterial = useMemo(
    () =>
      new MeshPhongMaterial({
        color: new Color('#9CA3AF'),
        shininess: 6,
        specular: new Color('#FFFFFF'),
      }),
    [],
  )

  // Stable dependency key for the (newly-created-each-render) selectedContinents array.
  const continentKey = selectedContinents.join(',')
  const isWorldView = selectedContinents.includes('world')

  useEffect(() => {
    selectedCountryCodeRef.current = selectedCountryCode
  }, [selectedCountryCode])

  // Container resize observer
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

  // Heatmap — re-fetched only when origin changes
  useEffect(() => {
    setHeatmap(null)
    fetch(`/api/flights/heatmap?origin=${encodeURIComponent(origin)}`)
      .then((r) => r.json())
      .then((data: HeatmapData) => setHeatmap(data))
      .catch(() => setLoadError(true))
  }, [origin])

  // Effect A — country focus: zoom to the clicked country + fetch its city pins.
  // Owns the camera while a country is selected; clears pins when none is.
  useEffect(() => {
    if (!globeReady || !globeRef.current) return

    if (!selectedCountryCode) {
      setCountryAirports([])
      return
    }

    const feature = geoFeatures?.find((f) => resolveIso(f.properties) === selectedCountryCode)
    if (feature) {
      const { lat, lng, area } = getFeatureBounds(feature.geometry)
      globeRef.current.pointOfView({ lat, lng, altitude: altitudeForArea(area) }, 1200)
    }
    globeRef.current.controls().autoRotate = false

    let cancelled = false
    searchAirportPricesByCountry(origin, selectedCountryCode, monthKey)
      .then((airports) => { if (!cancelled) setCountryAirports(airports) })
      .catch(console.error)
    return () => { cancelled = true }
  }, [selectedCountryCode, geoFeatures, globeReady, origin, monthKey])

  // Effect B — continent zoom: focus a single continent, or zoom back out to world for
  // multi-select / World. Skipped entirely while a country is drilled into, so the filter never
  // yanks the camera away from a focused country (it re-fires when that country is deselected).
  useEffect(() => {
    if (!globeReady || !globeRef.current) return
    if (selectedCountryCode) return

    const focusKey =
      selectedContinents.length === 1 && selectedContinents[0] !== 'world'
        ? selectedContinents[0]
        : 'world'
    const target = CONTINENT_CENTERS[focusKey] ?? CONTINENT_CENTERS.world

    globeRef.current.pointOfView(target, 1200)
    globeRef.current.controls().autoRotate = false
    const id = setTimeout(() => {
      if (globeRef.current && !selectedCountryCodeRef.current) {
        globeRef.current.controls().autoRotate = true
      }
    }, 1200)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continentKey, globeReady, selectedCountryCode])

  // ESC key → return to world view
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !selectedCountryCode) return
      const params = new URLSearchParams(searchParams.toString())
      params.delete('toCountry')
      params.delete('to')
      params.delete('toDefault')
      params.delete('toCity')
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedCountryCode, searchParams, pathname, router])

  // Country count with heatmap data per continent — drives the chip labels, e.g. Europe (45).
  const continentCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    if (!heatmap) return counts
    for (const r of heatmap.results) {
      const cont = continentOf(r.countryCode)
      if (cont) counts[cont] = (counts[cont] ?? 0) + 1
    }
    return counts
  }, [heatmap])

  // Color map: countryCode → color string.
  // World view → global min/max gradient. Continent-filtered → gradient stretched across only the
  // selected continents' prices; countries outside the selection keep their world-scale color but
  // blended toward the background so they read as faded-but-visible (~30% opacity).
  const colorMap = useMemo(() => {
    const map = new Map<string, string>()
    if (!heatmap || heatmap.results.length === 0) return map

    const allPrices = heatmap.results.map((r) => r.priceMinor)
    const worldMin = Math.min(...allPrices)
    const worldRange = Math.max(...allPrices) - worldMin || 1

    let selMin = worldMin
    let selRange = worldRange
    if (!isWorldView) {
      const selPrices = heatmap.results
        .filter((r) => {
          const cont = continentOf(r.countryCode)
          return cont != null && selectedContinents.includes(cont)
        })
        .map((r) => r.priceMinor)
      if (selPrices.length > 0) {
        selMin = Math.min(...selPrices)
        selRange = Math.max(...selPrices) - selMin || 1
      }
    }

    for (const entry of heatmap.results) {
      const cont = continentOf(entry.countryCode)
      const inSelection = isWorldView || (cont != null && selectedContinents.includes(cont))
      if (inSelection) {
        const t = isWorldView
          ? (entry.priceMinor - worldMin) / worldRange
          : (entry.priceMinor - selMin) / selRange
        map.set(entry.countryCode, priceToColor(t))
      } else {
        const worldRgb = priceToRgb((entry.priceMinor - worldMin) / worldRange)
        map.set(entry.countryCode, fadeToBackground(worldRgb))
      }
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heatmap, continentKey, isWorldView])

  // Legend reflects whichever scale is in use — global, or just the selected continents.
  const legendData = useMemo(() => {
    if (!heatmap || heatmap.results.length === 0) return null
    const filtered = isWorldView
      ? heatmap.results
      : heatmap.results.filter((r) => {
          const cont = continentOf(r.countryCode)
          return cont != null && selectedContinents.includes(cont)
        })
    const source = filtered.length > 0 ? filtered : heatmap.results
    const sorted = [...source].sort((a, b) => a.priceMinor - b.priceMinor)
    const mid = Math.floor(sorted.length / 2)
    const medianMinor =
      sorted.length % 2 !== 0
        ? sorted[mid].priceMinor
        : Math.round((sorted[mid - 1].priceMinor + sorted[mid].priceMinor) / 2)
    const currency = sorted[0].currency
    return {
      min: formatPrice(sorted[0].priceMinor, currency),
      median: formatPrice(medianMinor, currency),
      max: formatPrice(sorted[sorted.length - 1].priceMinor, currency),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heatmap, continentKey, isWorldView])

  // Pin colors rescaled within the selected country's pool (cheapest = blue, priciest = red).
  const pinColorMap = useMemo(() => buildPinColorMap(countryAirports), [countryAirports])

  const resetInactivity = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    if (globeRef.current) globeRef.current.controls().autoRotate = false
    inactivityTimer.current = setTimeout(() => {
      if (globeRef.current && !selectedCountryCodeRef.current) {
        globeRef.current.controls().autoRotate = true
      }
    }, 5000)
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY })
      resetInactivity()
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [resetInactivity])

  useEffect(() => {
    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    }
  }, [])

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
    setGlobeReady(true)
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
    setHoveredFeature(feat as GeoFeature | null)
  }, [])

  const handlePolygonClick = useCallback(
    (feat: object) => {
      const feature = feat as GeoFeature
      const code = resolveIso(feature.properties)
      if (!code || !heatmap) return
      const entry = heatmap.results.find((r) => r.countryCode === code)
      if (!entry) return // no heatmap data = no-op
      const params = new URLSearchParams(searchParams.toString())
      params.set('toCountry', code)
      params.set('to', entry.cheapestIata)
      params.set('toDefault', entry.cheapestIata)
      params.delete('toCity')
      router.push(`${pathname}?${params.toString()}`)
    },
    [heatmap, searchParams, pathname, router],
  )

  // Continent chip click → apply toggle rules and write the `continents` URL param.
  // World (the default) is represented by an absent param to keep clean URLs.
  const handleContinentSelect = useCallback(
    (key: string) => {
      const next = resolveContinentSelection(selectedContinents, key)
      const params = new URLSearchParams(searchParams.toString())
      if (next.length === 1 && next[0] === 'world') {
        params.delete('continents')
      } else {
        params.set('continents', next.join(','))
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [selectedContinents, searchParams, pathname, router],
  )

  // Ocean click → return to world view
  const handleGlobeClick = useCallback(() => {
    if (!selectedCountryCode || hoveredFeature) return
    const params = new URLSearchParams(searchParams.toString())
    params.delete('toCountry')
    params.delete('to')
    params.delete('toDefault')
    params.delete('toCity')
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [selectedCountryCode, hoveredFeature, searchParams, pathname, router])

  const handlePointClick = useCallback(
    (point: object) => {
      const airport = point as CountryAirportPrice
      const params = new URLSearchParams(searchParams.toString())
      params.set('to', airport.iata)
      params.set('toCity', airport.iata)
      router.push(`${pathname}?${params.toString()}`)
    },
    [searchParams, pathname, router],
  )

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
    <div
      ref={containerRef}
      className="w-full h-full relative bg-[#FAFAFA] overflow-hidden"
      onMouseLeave={() => setHoveredFeature(null)}
    >
      {isLoading ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 pointer-events-none">
          <div className="w-10 h-10 border-[3px] border-[#2B5BE0] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading flight prices…</p>
        </div>
      ) : null}

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

      {!isLoading && !isEmpty ? (
        <ContinentFilter
          counts={continentCounts}
          selected={selectedContinents}
          onSelect={handleContinentSelect}
        />
      ) : null}

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
          polygonsTransitionDuration={400}
          onPolygonHover={handlePolygonHover}
          onPolygonClick={handlePolygonClick}
          onGlobeClick={handleGlobeClick}
          onGlobeReady={handleGlobeReady}
          showPointerCursor
          pointsData={countryAirports}
          pointLat={(p) => (p as CountryAirportPrice).lat}
          pointLng={(p) => (p as CountryAirportPrice).lon}
          pointAltitude={0.02}
          pointRadius={(p) => (p as CountryAirportPrice).iata === selectedIata ? 0.85 : 0.6}
          pointColor={(p) => pinColorMap.get((p as CountryAirportPrice).iata) ?? PIN_DEFAULT_COLOR}
          pointLabel={(p) => {
            const ap = p as CountryAirportPrice
            const priceLine =
              ap.priceMinor != null
                ? `<div style="margin-top:1px;font-size:11px;font-weight:600;animation:tooltip-city-fade 0.3s ease 0.3s both">${formatPrice(ap.priceMinor, ap.currency ?? 'EUR')}</div>`
                : ''
            return `<div style="display:inline-block;background:rgba(15,23,42,0.92);padding:3px 6px;border-radius:3px;color:#fff;font-size:11px;font-weight:500;font-family:system-ui,sans-serif;white-space:nowrap;pointer-events:none">${ap.iata}<span style="animation:tooltip-city-fade 0.3s ease 0.3s both"> · ${ap.city}</span>${priceLine}</div>`
          }}
          onPointClick={handlePointClick}
          pointsTransitionDuration={400}
          htmlElementsData={countryAirports}
          htmlLat={(d) => (d as CountryAirportPrice).lat}
          htmlLng={(d) => (d as CountryAirportPrice).lon}
          htmlAltitude={0.021}
          htmlTransitionDuration={400}
          htmlElement={(d) => {
            const ap = d as CountryAirportPrice
            const el = document.createElement('div')
            el.textContent = ap.iata
            el.style.cssText = 'color:#fff;font-size:9px;font-weight:700;font-family:system-ui,sans-serif;transform:translate(-50%,-50%);pointer-events:none;white-space:nowrap;user-select:none;'
            return el
          }}
        />
      ) : null}

      {heatmap ? (
        <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-white/80 backdrop-blur-sm border border-[#E5E7EB] rounded-full px-3 py-1.5 text-[11px] text-gray-500 select-none pointer-events-none">
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E]" />
          </span>
          <span key={tick}>Updated {relativeTime(heatmap.computedAt)}</span>
        </div>
      ) : null}

      {legendData ? (
        <div className="absolute bottom-4 right-4 pointer-events-none select-none">
          <div
            className="h-2 rounded-full mb-1.5"
            style={{
              width: 200,
              background: 'linear-gradient(to right, #3B82F6 0%, #FBBF24 50%, #EF4444 100%)',
            }}
          />
          <div className="flex justify-between text-[10px] font-medium text-gray-500" style={{ width: 200 }}>
            <span>{legendData.min}</span>
            <span>{legendData.median}</span>
            <span>{legendData.max}</span>
          </div>
        </div>
      ) : null}

      <Tooltip data={hoveredFeature ? tooltipData : null} x={mousePos.x} y={mousePos.y} />
    </div>
  )
}

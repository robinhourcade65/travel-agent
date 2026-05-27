import { createClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse/sync'
import countries from 'i18n-iso-countries'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// eslint-disable-next-line @typescript-eslint/no-require-imports
countries.registerLocale(require('i18n-iso-countries/langs/en.json'))

const CSV_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv'
const CACHE_DIR = join(process.cwd(), 'scripts/data')
const CACHE_PATH = join(CACHE_DIR, 'airports-cache.csv')
const CHUNK_SIZE = 500

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    // No-op transport prevents WebSocketFactory.getWebSocketConstructor() from
    // throwing on Node < 22. This script only uses the REST/PostgREST layer.
    realtime: { transport: class {} as unknown as typeof WebSocket },
  }
)

async function getCSV(): Promise<string> {
  if (existsSync(CACHE_PATH)) {
    console.log(`Using cached CSV: ${CACHE_PATH}`)
    return readFileSync(CACHE_PATH, 'utf-8')
  }
  console.log(`Downloading airports CSV…`)
  const res = await fetch(CSV_URL)
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status} ${res.statusText}`)
  const text = await res.text()
  mkdirSync(CACHE_DIR, { recursive: true })
  writeFileSync(CACHE_PATH, text, 'utf-8')
  console.log(`Cached to ${CACHE_PATH}`)
  return text
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function main() {
  const csv = await getCSV()

  type RawRow = {
    iata_code: string
    type: string
    scheduled_service: string
    municipality: string
    name: string
    iso_country: string
    latitude_deg: string
    longitude_deg: string
  }

  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as RawRow[]

  const filtered = rows.filter(
    (r) =>
      r.iata_code &&
      (r.type === 'large_airport' || r.type === 'medium_airport') &&
      r.scheduled_service === 'yes'
  )

  const airports = filtered.map((r) => ({
    iata: r.iata_code,
    city: r.municipality || r.name,
    country: countries.getName(r.iso_country, 'en') ?? r.iso_country,
    country_code: r.iso_country,
    lat: parseFloat(r.latitude_deg),
    lon: parseFloat(r.longitude_deg),
    is_major: r.type === 'large_airport',
  }))

  const largeCount = airports.filter((a) => a.is_major).length
  const mediumCount = airports.length - largeCount

  console.log(`\nFiltered: ${airports.length} airports (${largeCount} large, ${mediumCount} medium)`)
  console.log(`Upserting in batches of ${CHUNK_SIZE}…\n`)

  const batches = chunk(airports, CHUNK_SIZE)
  let upserted = 0

  for (let i = 0; i < batches.length; i++) {
    const { error } = await supabase
      .from('airports')
      .upsert(batches[i], { onConflict: 'iata' })

    if (error) throw new Error(`Batch ${i + 1}/${batches.length} failed: ${error.message}`)

    upserted += batches[i].length
    console.log(`  Batch ${i + 1}/${batches.length} — ${upserted}/${airports.length} rows done`)
  }

  // Per-country breakdown
  const byCountry: Record<string, number> = {}
  for (const a of airports) {
    byCountry[a.country] = (byCountry[a.country] ?? 0) + 1
  }
  const sorted = Object.entries(byCountry).sort(([, a], [, b]) => b - a)

  console.log('\n══════════════════════════════')
  console.log('  Seed complete')
  console.log('══════════════════════════════')
  console.log(`  Total upserted  : ${upserted}`)
  console.log(`  Large airports  : ${largeCount}`)
  console.log(`  Medium airports : ${mediumCount}`)
  console.log(`  Countries       : ${sorted.length}`)
  console.log('\n  Top 25 countries by airport count:')
  sorted.slice(0, 25).forEach(([country, count]) => {
    console.log(`    ${count.toString().padStart(4)}  ${country}`)
  })
}

main().catch((err) => {
  console.error('\nSeed failed:', err.message ?? err)
  process.exit(1)
})

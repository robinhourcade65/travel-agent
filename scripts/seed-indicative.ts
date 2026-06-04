/**
 * Seed indicative prices for a single origin airport.
 *
 * Usage:
 *   npm run seed:indicative -- LHR
 *   npm run seed:indicative -- CDG
 *   npm run seed:indicative -- LHR --force   # bypass the 1000-call guardrail
 *
 * The script reuses refreshIndicativePrices directly, so it respects the same
 * 4-hour freshness check — re-running is always safe (already-fresh rows skip).
 * Pass --force only when adding a brand-new origin for the first time.
 *
 * Runs with no time budget (budgetMs = 0), so it completes the full sweep.
 * Expect ~3–10 minutes per origin depending on Duffel rate limits.
 */

import { refreshIndicativePrices } from '../src/server/flights/indicative'

const origin = process.argv[2]?.toUpperCase()
const force = process.argv.includes('--force')

if (!origin || !/^[A-Z]{3}$/.test(origin)) {
  console.error('Usage: npm run seed:indicative -- <IATA> [--force]')
  console.error('Example: npm run seed:indicative -- LHR')
  process.exit(1)
}

console.log(`\n══════════════════════════════`)
console.log(`  Seeding indicative prices`)
console.log(`  Origin : ${origin}`)
console.log(`  Force  : ${force}`)
console.log(`══════════════════════════════\n`)

refreshIndicativePrices(origin, { force, budgetMs: 0 })
  .then((result) => {
    console.log('\n══════════════════════════════')
    console.log(`  Done — ${origin}`)
    console.log('══════════════════════════════')
    console.log(`  Stored   : ${result.pricesStored}`)
    console.log(`  Skipped  : ${result.skipped}`)
    console.log(`  Errors   : ${result.errors}`)
    console.log(`  Duration : ${Math.round(result.durationMs / 1000)}s`)
    if (result.timedOut) {
      console.log('\n  ⚠ Timed out — re-run to continue from where it stopped.')
    }
  })
  .catch((err: unknown) => {
    console.error('\nSeed failed:', err instanceof Error ? err.message : err)
    process.exit(1)
  })

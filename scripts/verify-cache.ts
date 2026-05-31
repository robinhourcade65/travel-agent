/**
 * Cache verification script.
 * Run with: npm run verify:cache
 *
 * Tests:
 *   1. Sequential: two calls with same params → only 1 Duffel call fires
 *   2. Concurrent: three simultaneous calls with same params → dedup → only 1 Duffel call fires
 */

import { getFlightOffers } from '../src/server/flights/cache.ts';

// --- Log interceptor to count actual Duffel API calls ---
let duffelCallCount = 0;
const rawLog = console.log.bind(console);

console.log = (...args: unknown[]) => {
  if (String(args[0] ?? '').includes('[cache] duffel')) duffelCallCount++;
  rawLog(...args);
};

function resetCounter() {
  duffelCallCount = 0;
}

// --- Assertion helpers ---
let passed = 0;
let failed = 0;

function check(condition: boolean, label: string) {
  if (condition) {
    rawLog(`  ✓ ${label}`);
    passed++;
  } else {
    rawLog(`  ✗ ${label}`);
    failed++;
  }
}

async function main() {
  // =============================================================
  // TEST 1 — Sequential hit / miss
  // =============================================================
  rawLog('\n══════════════════════════════════════════');
  rawLog('TEST 1 — Sequential: miss then hit');
  rawLog('══════════════════════════════════════════');

  const SEQ = { origin: 'DUB', destination: 'CDG', departDate: '2026-09-15' };
  resetCounter();

  rawLog('\nCall 1 (expect: cache miss → Duffel API call)');
  const { offers: r1, cached: r1Cached } = await getFlightOffers(SEQ);

  rawLog('\nCall 2 (expect: cache hit → no Duffel call)');
  const { offers: r2, cached: r2Cached } = await getFlightOffers(SEQ);

  rawLog('\n--- Assertions ---');
  check(duffelCallCount === 1, `Exactly 1 Duffel call across 2 sequential calls (got ${duffelCallCount})`);
  check(!r1Cached, `Call 1 reported cached=false (live from Duffel)`);
  check(r2Cached, `Call 2 reported cached=true (from DB)`);
  check(r1.length > 0, `Call 1 returned offers (got ${r1.length})`);
  check(r2.length > 0, `Call 2 returned offers from cache (got ${r2.length})`);
  check(
    r1[0].priceMinor === r2[0].priceMinor,
    `Cheapest price identical between live and cached (${r1[0].priceMinor} ${r1[0].currency})`,
  );

  // =============================================================
  // TEST 2 — Concurrent dedup
  // =============================================================
  rawLog('\n══════════════════════════════════════════');
  rawLog('TEST 2 — Concurrent: 3× same params → dedup');
  rawLog('══════════════════════════════════════════');

  // Different route — guaranteed cold cache for this test
  const CONC = { origin: 'DUB', destination: 'AMS', departDate: '2026-09-15' };
  resetCounter();

  rawLog('\nCalling getFlightOffers 3× concurrently…');
  const [{ offers: c1 }, { offers: c2 }, { offers: c3 }] = await Promise.all([
    getFlightOffers(CONC),
    getFlightOffers(CONC),
    getFlightOffers(CONC),
  ]);

  rawLog('\n--- Assertions ---');
  check(duffelCallCount === 1, `Exactly 1 Duffel call across 3 concurrent calls (got ${duffelCallCount})`);
  check(c1.length > 0 && c2.length > 0 && c3.length > 0, `All 3 callers received offers`);
  check(
    c1[0].priceMinor === c2[0].priceMinor && c2[0].priceMinor === c3[0].priceMinor,
    `All 3 callers got identical cheapest price (${c1[0].priceMinor} ${c1[0].currency})`,
  );

  // =============================================================
  // Summary
  // =============================================================
  rawLog('\n══════════════════════════════════════════');
  rawLog(`RESULT: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    rawLog('✅  ALL TESTS PASSED');
  } else {
    rawLog('❌  SOME TESTS FAILED');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});

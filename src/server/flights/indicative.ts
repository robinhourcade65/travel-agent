import { DuffelError } from '@duffel/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { getFlightOffers } from '@/server/flights/cache';
import { FlightDataError } from '@/types/flights';
import { COUNTRY_HUBS } from '@/lib/flights/country-hubs';

const FRESH_MS = 4 * 60 * 60 * 1000; // 4 hours — skip rows computed more recently than this
const CALL_GUARD = 1000; // refuse to run if estimate exceeds this without force=true
const LOG_EVERY = 25; // log progress every N countries
const SLEEP_MS = 500; // inter-call delay — conservative for live-mode rate limits

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// Returns the 15th of each of the next 3 calendar months (UTC), plus the
// corresponding return date (+7 days) and the month's first day for storage.
function nextThreeMonths(): Array<{ departDate: string; returnDate: string; monthKey: string }> {
  const now = new Date();
  return [1, 2, 3].map((offset) => {
    const depart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 15));
    const ret = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 22));
    const monthFirst = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    return {
      departDate: depart.toISOString().slice(0, 10),
      returnDate: ret.toISOString().slice(0, 10),
      monthKey: monthFirst.toISOString().slice(0, 10),
    };
  });
}

// A Duffel HTTP 422 means the IATA code is not recognised by their airline
// partners (not a transient error). FlightDataError wraps the original
// DuffelError in its .cause field.
//
// We duck-type instead of using `instanceof DuffelError` because Next.js can
// resolve the ESM and CJS bundles of @duffel/api to different objects, making
// instanceof unreliable across module boundaries.
function isDuffelInvalidIata(err: unknown): boolean {
  const cause = err instanceof FlightDataError ? err.cause : err;
  if (typeof cause !== 'object' || cause === null) return false;
  const c = cause as { meta?: { status?: number }; errors?: Array<{ code?: string }> };
  return c.meta?.status === 422 && c.errors?.[0]?.code === 'invalid_iata_code';
}

async function markAirportUnsupported(
  admin: ReturnType<typeof createAdminClient>,
  iata: string,
): Promise<void> {
  const { error } = await admin
    .from('airports')
    .update({ duffel_supported: false })
    .eq('iata', iata);
  if (error) {
    console.error(`[indicative] Failed to mark ${iata} duffel_supported=false:`, error.message);
  } else {
    console.log(`[indicative] ${iata} marked duffel_supported=false (Duffel 422 — will skip on future runs)`);
  }
}

export type IndicativeResult = {
  pricesStored: number;
  errors: number;
  skipped: number;
  durationMs: number;
  timedOut: boolean;
};

export type RefreshOptions = {
  force?: boolean;
  budgetMs?: number; // soft time ceiling; 0 = no limit
  startTime?: number; // pass from caller to share budget across multiple origins
};

export async function refreshIndicativePrices(
  originIata: string,
  opts: RefreshOptions = {},
): Promise<IndicativeResult> {
  const { force = false, budgetMs = 55_000, startTime = Date.now() } = opts;
  const budget = budgetMs === 0 ? Infinity : budgetMs;

  const admin = createAdminClient();

  // 1 — Resolve origin country so we can exclude it from destinations
  const { data: originRow } = await admin
    .from('airports')
    .select('country_code')
    .eq('iata', originIata)
    .maybeSingle();

  const originCountry = originRow?.country_code ?? null;

  // 2 — Load all airports with duffel_supported=true (excluding origin country).
  //     Preference order for representative airport per country:
  //       1. duffel_supported = true  (guaranteed by this filter)
  //       2. is_major = true
  //       3. alphabetically first IATA
  let apQuery = admin
    .from('airports')
    .select('iata, country_code, is_major')
    .eq('duffel_supported', true);
  if (originCountry) apQuery = apQuery.neq('country_code', originCountry);

  const { data: airportRows, error: apError } = await apQuery;
  if (apError || !airportRows) {
    throw new Error(`[indicative] Failed to load airports: ${apError?.message}`);
  }

  // Build country → representative airport map
  const repByCountry = new Map<string, string>();
  for (const row of airportRows) {
    const existing = repByCountry.get(row.country_code);
    if (!existing) {
      repByCountry.set(row.country_code, row.iata);
    } else if (row.is_major) {
      // Prefer is_major; among multiple majors keep alphabetically first
      const existingIsMajor = airportRows.find((r) => r.iata === existing)?.is_major ?? false;
      if (!existingIsMajor || row.iata < existing) {
        repByCountry.set(row.country_code, row.iata);
      }
    }
  }

  // Override with curated hubs. We query hub airports separately — without the
  // duffel_supported filter — so the override always wins even if a hub was
  // previously marked duffel_supported=false by an earlier failed run. If the
  // hub is still broken, the 422 handler below will re-mark it and move on.
  const hubIatas = Object.values(COUNTRY_HUBS);
  const { data: hubRows } = await admin
    .from('airports')
    .select('iata')
    .in('iata', hubIatas);
  const hubIataSet = new Set((hubRows ?? []).map((r) => r.iata));
  for (const [countryCode, hubIata] of Object.entries(COUNTRY_HUBS)) {
    if (hubIataSet.has(hubIata)) {
      repByCountry.set(countryCode, hubIata);
    }
  }

  const countries = Array.from(repByCountry.entries()); // [countryCode, repIata]
  const months = nextThreeMonths();
  const estimate = countries.length * months.length;

  // 3 — Estimate + guardrail
  console.log(
    `[indicative] Will make ~${estimate} Duffel calls for origin ${originIata} across ${months.length} months`,
  );
  if (estimate > CALL_GUARD && !force) {
    throw new Error(
      `[indicative] Estimate (${estimate}) exceeds guardrail (${CALL_GUARD}). ` +
        `Pass ?force=true to proceed.`,
    );
  }

  let pricesStored = 0;
  let errors = 0;
  let skipped = 0;
  let timedOut = false;
  let countriesProcessed = 0;

  // 4 — Main loop: country × month
  outer: for (const [countryCode, repIata] of countries) {
    let airportMarkedUnsupported = false;

    for (const { departDate, returnDate, monthKey } of months) {
      // Soft time limit — checked before each Duffel call
      if (Date.now() - startTime > budget) {
        console.log(
          `[indicative] Budget exceeded (${Math.round((Date.now() - startTime) / 1000)}s). ` +
            `Stopping early — resumable on next run.`,
        );
        timedOut = true;
        break outer;
      }

      // Freshness check — skip if already computed recently
      const { data: fresh } = await admin
        .from('indicative_prices')
        .select('computed_at')
        .eq('origin', originIata)
        .eq('destination_country', countryCode)
        .eq('month', monthKey)
        .maybeSingle();

      if (fresh && Date.now() - new Date(fresh.computed_at).getTime() < FRESH_MS) {
        skipped++;
        continue;
      }

      // Fetch (cache-first via getFlightOffers)
      try {
        const { offers } = await getFlightOffers({
          origin: originIata,
          destination: repIata,
          departDate,
          returnDate,
        });

        if (offers.length === 0) {
          // No offers for this route — skip without error
          await sleep(SLEEP_MS);
          continue;
        }

        const cheapest = offers[0]; // already sorted ascending by price

        const { error: upsertError } = await admin.from('indicative_prices').upsert(
          {
            origin: originIata,
            destination_country: countryCode,
            cheapest_iata: repIata,
            price_minor: cheapest.priceMinor,
            currency: cheapest.currency,
            month: monthKey,
            computed_at: new Date().toISOString(),
          },
          { onConflict: 'origin,destination_country,month' },
        );

        if (upsertError) {
          console.error(
            `[indicative] upsert error ${originIata}→${countryCode} ${monthKey}:`,
            upsertError.message,
          );
          errors++;
        } else {
          pricesStored++;
        }
      } catch (err) {
        errors++;

        if (isDuffelInvalidIata(err)) {
          // Confirmed Duffel 422 — airport not recognised by any airline partner.
          // Mark once then break: all months will fail for the same dead airport.
          console.error(
            `[indicative] fetch error ${originIata}→${repIata} (${countryCode}) ${departDate} [Duffel 422 — invalid IATA]:`,
            err instanceof Error ? err.message : err,
          );
          if (!airportMarkedUnsupported) {
            await markAirportUnsupported(admin, repIata);
            airportMarkedUnsupported = true;
          }
          break;
        }

        // Any other error (network, 5xx, unexpected shape): log and continue.
        // Never re-throw here — one bad route must not abort the whole seed run.
        console.error(
          `[indicative] fetch error ${originIata}→${repIata} (${countryCode}) ${departDate}:`,
          err instanceof Error ? err.message : err,
        );
      }

      await sleep(SLEEP_MS);
    }

    countriesProcessed++;

    if (countriesProcessed % LOG_EVERY === 0) {
      console.log(
        `[indicative] ${originIata} → ${countriesProcessed}/${countries.length} countries done, ` +
          `${pricesStored} prices stored, ${errors} errors`,
      );
    }
  }

  const durationMs = Date.now() - startTime;

  console.log(
    `[indicative] ${originIata} done — ${pricesStored} stored, ${skipped} skipped, ` +
      `${errors} errors in ${Math.round(durationMs / 1000)}s` +
      (timedOut ? ' (timed out — resume on next run)' : ''),
  );

  return { pricesStored, errors, skipped, durationMs, timedOut };
}

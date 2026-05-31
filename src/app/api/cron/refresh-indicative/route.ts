// Cron endpoint — refreshes indicative prices for all configured origins.
//
// Scheduled via vercel.json: runs twice daily (06:00 and 18:00 UTC).
// Default soft time limit: 55s (Vercel hobby cron timeout is 60s).
//
// Manual / seed usage — override the budget with ?budget=<ms>:
//   ?budget=55000   — default, Vercel-safe
//   ?budget=300000  — 5 minutes, for seeding a new origin from terminal:
//                     curl -H "Authorization: Bearer $CRON_SECRET" \
//                          "https://your-app.vercel.app/api/cron/refresh-indicative?budget=300000"
//   ?budget=0       — no limit, for local batch runs (careful on live mode)
//
// The job is idempotent: rows computed within the last 4 hours are skipped,
// so re-triggering is always safe. Use ?force=true to bypass the 1000-call
// guardrail if you add many new origins at once.

import { type NextRequest } from 'next/server';
import { ORIGINS } from '@/lib/flights/origins';
import { refreshIndicativePrices } from '@/server/flights/indicative';

export async function GET(request: NextRequest) {
  // 1 — Auth
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token || token !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2 — Parse options from query params
  const { searchParams } = request.nextUrl;
  const force = searchParams.get('force') === 'true';
  const budgetParam = searchParams.get('budget');
  const budgetMs = budgetParam !== null ? parseInt(budgetParam, 10) : 55_000;

  if (isNaN(budgetMs) || budgetMs < 0) {
    return Response.json({ error: 'Invalid budget param — must be a non-negative integer (ms)' }, { status: 400 });
  }

  // 3 — Run origins sequentially, sharing one clock against the budget
  const startTime = Date.now();
  const results: Array<{ iata: string; pricesStored: number; errors: number; skipped: number; timedOut: boolean }> = [];

  for (const iata of ORIGINS) {
    try {
      const result = await refreshIndicativePrices(iata, { force, budgetMs, startTime });
      results.push({ iata, ...result });

      // If budget was exhausted during this origin, don't start the next one
      if (result.timedOut) break;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[cron] refreshIndicativePrices(${iata}) threw:`, message);
      results.push({ iata, pricesStored: 0, errors: 1, skipped: 0, timedOut: false });
    }
  }

  const total_duration_ms = Date.now() - startTime;

  return Response.json({
    origins: results.map(({ iata, pricesStored, errors, skipped, timedOut }) => ({
      iata,
      prices_stored: pricesStored,
      errors,
      skipped,
      timed_out: timedOut,
    })),
    total_duration_ms,
  });
}

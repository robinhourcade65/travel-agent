import { type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const MONTH_RE = /^\d{4}-\d{2}$/;

function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

// Returns the first day of next month as a YYYY-MM-DD string (UTC).
function defaultMonthKey(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 10);
}

// Parses and validates a YYYY-MM string, returns the first-of-month YYYY-MM-DD
// key used in the indicative_prices table, or null on any validation failure.
function parseMonthParam(
  raw: string,
): { monthKey: string } | { error: string } {
  if (!MONTH_RE.test(raw)) {
    return { error: 'month must be YYYY-MM (e.g. 2026-08)' };
  }

  const year = parseInt(raw.slice(0, 4), 10);
  const month = parseInt(raw.slice(5, 7), 10);

  if (month < 1 || month > 12) {
    return { error: 'month must be a valid month number (01–12)' };
  }

  const now = new Date();
  const inputMs = Date.UTC(year, month - 1, 1);
  const minMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1); // start of current month
  const maxMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 12, 1);

  if (inputMs < minMs || inputMs > maxMs) {
    return { error: 'month must be within the next 12 months' };
  }

  return { monthKey: new Date(inputMs).toISOString().slice(0, 10) };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // 1 — Origin param
  const rawOrigin = searchParams.get('origin');
  if (!rawOrigin) {
    return badRequest('origin is required (3-letter IATA code)');
  }
  const origin = rawOrigin.toUpperCase();
  if (!/^[A-Z]{3}$/.test(origin)) {
    return badRequest('origin must be a 3-letter IATA code');
  }

  // 2 — Month param (default: next month)
  let monthKey: string;
  const rawMonth = searchParams.get('month');
  if (rawMonth) {
    const result = parseMonthParam(rawMonth);
    if ('error' in result) return badRequest(result.error);
    monthKey = result.monthKey;
  } else {
    monthKey = defaultMonthKey();
  }

  const admin = createAdminClient();

  // 3 — Validate origin exists in airports table
  const { data: airportRow } = await admin
    .from('airports')
    .select('iata')
    .eq('iata', origin)
    .maybeSingle();

  if (!airportRow) {
    return badRequest(`Unknown airport code: ${origin}`);
  }

  // 4 — Query indicative_prices
  const { data, error } = await admin
    .from('indicative_prices')
    .select('destination_country, cheapest_iata, price_minor, currency, computed_at')
    .eq('origin', origin)
    .eq('month', monthKey)
    .order('price_minor', { ascending: true });

  if (error) {
    console.error('[heatmap] DB error:', error.message);
    return Response.json({ error: 'Failed to query heatmap data' }, { status: 500 });
  }

  // 5 — Find the freshest computed_at across rows (used by UI to show data age)
  const computedAt =
    data && data.length > 0
      ? data.reduce(
          (max, row) => (row.computed_at > max ? row.computed_at : max),
          data[0].computed_at,
        )
      : null;

  return Response.json(
    {
      origin,
      month: monthKey,
      results: (data ?? []).map((row) => ({
        countryCode: row.destination_country,
        cheapestIata: row.cheapest_iata,
        priceMinor: row.price_minor,
        currency: row.currency,
      })),
      count: data?.length ?? 0,
      computedAt,
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
      },
    },
  );
}

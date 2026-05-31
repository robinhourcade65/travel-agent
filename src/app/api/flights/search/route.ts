import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerClient } from '@/lib/supabase/server';
import { getFlightOffers } from '@/server/flights/cache';
import { FlightDataError } from '@/types/flights';

// ---------------------------------------------------------------------------
// Rate limiter — in-memory, per-process.
// TODO(09_billing): replace with getRateLimit(userId) backed by Upstash Redis
//   once subscription tiers exist. See docs/09_billing.md for wiring details.
// ---------------------------------------------------------------------------
type RateLimitEntry = { count: number; resetAt: number };
const rateLimitStore = new Map<string, RateLimitEntry>();

function getLimit(userId?: string): number {
  if (!userId) return 10;   // anonymous
  return 50;                // authenticated free (pro → 500, added in 09_billing.md)
}

function checkRateLimit(key: string, limitPerHour: number): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + 3_600_000 });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= limitPerHour) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count++;
  return { allowed: true, retryAfterSeconds: 0 };
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------
const IATA_RE = /^[A-Z]{3}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/; // strict YYYY-MM-DD only (rejects ISO datetimes)

const searchSchema = z.object({
  origin: z.string().regex(IATA_RE, 'Must be a 3-letter uppercase IATA code'),
  destination: z.string().regex(IATA_RE, 'Must be a 3-letter uppercase IATA code'),
  departDate: z.string().regex(DATE_RE, 'Must be YYYY-MM-DD'),
  returnDate: z.string().regex(DATE_RE, 'Must be YYYY-MM-DD').optional(),
});

function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

function err(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

// ---------------------------------------------------------------------------
// Airport existence check
// ---------------------------------------------------------------------------
async function airportExists(iata: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('airports')
    .select('iata')
    .eq('iata', iata)
    .maybeSingle();
  if (error) console.error('[search] airport lookup error:', error.message);
  return data !== null;
}

// ---------------------------------------------------------------------------
// GET /api/flights/search
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  // 1 — Parse and validate query params
  const { searchParams } = request.nextUrl;
  const raw = {
    origin: searchParams.get('origin')?.toUpperCase(),
    destination: searchParams.get('destination')?.toUpperCase(),
    departDate: searchParams.get('departDate'),
    returnDate: searchParams.get('returnDate') ?? undefined,
  };

  const parsed = searchSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return badRequest(`${String(first.path[0] ?? 'field')}: ${first.message}`);
  }

  const { origin, destination, departDate, returnDate } = parsed.data;

  // 2 — Date range validation (UTC-aware)
  const todayUtc = new Date().toISOString().slice(0, 10);
  const maxDate = new Date(Date.now() + 330 * 86_400_000).toISOString().slice(0, 10);

  if (departDate < todayUtc) {
    return badRequest('departDate must be today or in the future');
  }
  if (departDate > maxDate) {
    return badRequest('departDate must be within 330 days from today');
  }
  if (returnDate !== undefined && returnDate <= departDate) {
    return badRequest('returnDate must be after departDate');
  }

  // 3 — IATA existence check against airports table
  const [originExists, destinationExists] = await Promise.all([
    airportExists(origin),
    airportExists(destination),
  ]);

  if (!originExists) return badRequest(`Unknown airport code: ${origin}`);
  if (!destinationExists) return badRequest(`Unknown airport code: ${destination}`);

  // 4 — Auth (best-effort: missing session is fine, just means anonymous rate limit)
  let userId: string | undefined;
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id;
  } catch {
    // cookies() can throw outside a request context in certain Next.js builds
  }

  // 5 — Rate limit
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  const rateLimitKey = userId ?? `ip:${ip}`;
  const limit = getLimit(userId);
  const { allowed, retryAfterSeconds } = checkRateLimit(rateLimitKey, limit);

  if (!allowed) {
    return Response.json(
      { error: 'Too many requests. Please slow down.' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSeconds) },
      },
    );
  }

  // 6 — Fetch (cache-first)
  try {
    const { offers, cached } = await getFlightOffers({ origin, destination, departDate, returnDate });

    return Response.json(
      { cached, results: offers, count: offers.length },
      {
        status: 200,
        headers: { 'Cache-Control': 'private, no-store' },
      },
    );
  } catch (error) {
    if (error instanceof FlightDataError) {
      return err(error.message, 502);
    }
    console.error('[search] unexpected error:', error);
    return err('An unexpected error occurred', 500);
  }
}

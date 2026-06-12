import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { getFlightOffers } from '@/server/flights/cache';
import { FlightDataError } from '@/types/flights';

// ---------------------------------------------------------------------------
// GET /api/flights/flex
//
// Cheapest-price-per-day strip around a departure date. Fans out one
// getFlightOffers() per candidate day with Promise.allSettled, so:
//   • days already fresh in flight_prices cost zero Duffel calls (cache-first),
//   • a single failed/empty day never blanks the whole strip,
//   • the whole strip counts as ONE request for rate-limiting (vs. the client
//     firing N parallel /search calls).
// Only the departure date flexes; the return date (if any) stays fixed.
// ---------------------------------------------------------------------------

const IATA_RE = /^[A-Z]{3}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const flexSchema = z.object({
  origin: z.string().regex(IATA_RE),
  destination: z.string().regex(IATA_RE),
  depart: z.string().regex(DATE_RE),
  returnDate: z.string().regex(DATE_RE).optional(),
  flex: z.coerce.number().int().refine((n) => n === 1 || n === 3 || n === 7, 'flex must be 1, 3 or 7'),
  adults: z.coerce.number().int().min(1).max(9).optional(),
  children: z.coerce.number().int().min(0).max(9).optional(),
  infants: z.coerce.number().int().min(0).max(9).optional(),
});

type DayCell =
  | { date: string; priceMinor: number; currency: string }
  | { date: string; status: 'empty' | 'error' | 'unavailable' };

function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

// Per-process rate limiter (mirrors /search; one token per strip request).
type RateLimitEntry = { count: number; resetAt: number };
const flexRateStore = new Map<string, RateLimitEntry>();
function checkRateLimit(key: string, limitPerHour: number): boolean {
  const now = Date.now();
  const entry = flexRateStore.get(key);
  if (!entry || entry.resetAt < now) {
    flexRateStore.set(key, { count: 1, resetAt: now + 3_600_000 });
    return true;
  }
  if (entry.count >= limitPerHour) return false;
  entry.count++;
  return true;
}

// UTC date arithmetic on a YYYY-MM-DD string.
function addDays(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const parsed = flexSchema.safeParse({
    origin: searchParams.get('origin')?.toUpperCase(),
    destination: searchParams.get('destination')?.toUpperCase(),
    depart: searchParams.get('depart'),
    returnDate: searchParams.get('returnDate') ?? undefined,
    flex: searchParams.get('flex'),
    adults: searchParams.get('adults') ?? undefined,
    children: searchParams.get('children') ?? undefined,
    infants: searchParams.get('infants') ?? undefined,
  });

  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');
  }

  const { origin, destination, depart, returnDate, flex, adults, children, infants } = parsed.data;

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (!checkRateLimit(`ip:${ip}`, 50)) {
    return Response.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
  }

  // Build the candidate date list, clamped to the bookable window.
  const todayUtc = new Date().toISOString().slice(0, 10);
  const maxDate = new Date(Date.now() + 330 * 86_400_000).toISOString().slice(0, 10);

  const dates: string[] = [];
  for (let offset = -flex; offset <= flex; offset++) {
    dates.push(addDays(depart, offset));
  }

  // Fetch every day in parallel; failures are isolated per cell.
  const results = await Promise.allSettled(
    dates.map(async (date): Promise<DayCell> => {
      if (date < todayUtc || date > maxDate) return { date, status: 'unavailable' };
      // Round trips need depart < return; flexing earlier days can violate it.
      if (returnDate !== undefined && date >= returnDate) return { date, status: 'unavailable' };
      try {
        const { offers } = await getFlightOffers({
          origin,
          destination,
          departDate: date,
          returnDate,
          adults,
          children,
          infants,
        });
        if (offers.length === 0) return { date, status: 'empty' };
        // Offers come back price-ascending → first is cheapest.
        const cheapest = offers[0];
        return { date, priceMinor: cheapest.priceMinor, currency: cheapest.currency };
      } catch (err) {
        if (!(err instanceof FlightDataError)) console.error('[flex] unexpected error:', err);
        return { date, status: 'error' };
      }
    }),
  );

  const days: DayCell[] = results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { date: dates[i], status: 'error' },
  );

  return Response.json(
    { center: depart, days },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}

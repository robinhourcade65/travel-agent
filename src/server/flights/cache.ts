import { createAdminClient } from '@/lib/supabase/admin';
import { searchOffers, SearchOffersParams } from '@/lib/flights/duffel';
import { FlightOffer } from '@/types/flights';

// Per-process dedup map. Vercel single-region V1: this is acceptable.
// TODO: move to Upstash Redis when scaling to multi-region.
const pendingRequests = new Map<string, Promise<{ offers: FlightOffer[]; cached: boolean }>>();

export type FlightOffersResult = { offers: FlightOffer[]; cached: boolean };

export type GetFlightOffersParams = {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  passengers?: number;
  maxAgeMinutes?: number; // reserved — TTL is computed from departDate for now
};

function cacheKey(p: GetFlightOffersParams): string {
  return [p.origin, p.destination, p.departDate, p.returnDate ?? '', String(p.passengers ?? 1)].join('|');
}

function computeTTL(departDate: string): Date {
  const msPerDay = 86_400_000;
  const daysUntil = Math.floor((new Date(departDate).getTime() - Date.now()) / msPerDay);
  const hours = daysUntil < 7 ? 2 : daysUntil < 30 ? 6 : daysUntil < 90 ? 12 : 24;
  return new Date(Date.now() + hours * 3_600_000);
}

function rowToOffer(row: Record<string, unknown>): FlightOffer {
  const departAt = `${row.depart_date}T00:00:00`;
  const durationMinutes = Number(row.duration_minutes ?? 0);
  const arriveAt =
    durationMinutes > 0
      ? new Date(new Date(departAt).getTime() + durationMinutes * 60_000).toISOString()
      : departAt;
  return {
    id: String(row.id),
    origin: String(row.origin),
    destination: String(row.destination),
    departAt,
    arriveAt,
    durationMinutes,
    stops: Number(row.stops ?? 0),
    airline: String(row.airline ?? ''),
    airlineIata: String(row.airline_iata ?? ''),
    priceMinor: Number(row.price_minor),
    currency: String(row.currency),
    deeplink: row.deeplink ? String(row.deeplink) : null,
  };
}

export async function getFlightOffers(params: GetFlightOffersParams): Promise<FlightOffersResult> {
  const { origin, destination, departDate, returnDate, passengers = 1 } = params;
  const route = `${origin}→${destination} on ${departDate}`;

  // 1 — DB cache check
  const admin = createAdminClient();
  let query = admin
    .from('flight_prices')
    .select('*')
    .eq('origin', origin)
    .eq('destination', destination)
    .eq('depart_date', departDate)
    .gt('expires_at', new Date().toISOString())
    .order('price_minor', { ascending: true });

  query = returnDate !== undefined ? query.eq('return_date', returnDate) : query.is('return_date', null);

  const { data: cached, error: cacheError } = await query;

  if (cacheError) {
    console.error(`[cache] DB read error for ${route}:`, cacheError.message);
  }

  if (cached && cached.length > 0) {
    console.log(`[cache] hit  ${route} — ${cached.length} offers from DB`);
    return { offers: cached.map(rowToOffer), cached: true };
  }

  // 2 — cache miss: attach to any in-flight request for the same key (dedup)
  const key = cacheKey(params);
  console.log(`[cache] miss ${route}`);

  const existing = pendingRequests.get(key);
  if (existing) {
    console.log(`[cache] dedup ${route} — joining in-flight request`);
    return existing;
  }

  // 3 — new Duffel fetch
  const fetchPromise = fetchAndStore({ origin, destination, departDate, returnDate, passengers });
  pendingRequests.set(key, fetchPromise);
  // .catch first so the .finally chain never produces an unhandled rejection on Node 20+
  fetchPromise.catch(() => {}).finally(() => pendingRequests.delete(key));

  return fetchPromise;
}

async function fetchAndStore(params: {
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string | undefined;
  passengers: number;
}): Promise<FlightOffersResult> {
  const { origin, destination, departDate, returnDate, passengers } = params;
  const route = `${origin}→${destination} on ${departDate}`;

  console.log(`[cache] duffel ${route} — calling Duffel API`);

  const searchParams: SearchOffersParams = {
    origin,
    destination,
    departDate,
    passengers,
    ...(returnDate !== undefined ? { returnDate } : {}),
  };

  const offers = await searchOffers(searchParams);

  if (offers.length === 0) {
    console.log(`[cache] no offers returned for ${route}`);
    return { offers, cached: false };
  }

  const admin = createAdminClient();
  const expiresAt = computeTTL(departDate).toISOString();

  // Clear stale entries for this route+date before inserting fresh ones.
  // We use the search origin/destination (not offer-level IATAs) to guarantee
  // the FK constraint against airports(iata) is always satisfied.
  let deleteQuery = admin
    .from('flight_prices')
    .delete()
    .eq('origin', origin)
    .eq('destination', destination)
    .eq('depart_date', departDate);

  deleteQuery =
    returnDate !== undefined
      ? deleteQuery.eq('return_date', returnDate)
      : deleteQuery.is('return_date', null);

  const { error: deleteError } = await deleteQuery;
  if (deleteError) {
    console.error(`[cache] delete error for ${route}:`, deleteError.message);
  }

  const rows = offers.map((offer) => ({
    origin,
    destination,
    depart_date: departDate,
    return_date: returnDate ?? null,
    price_minor: offer.priceMinor,
    currency: offer.currency,
    airline: offer.airline || null,
    airline_iata: offer.airlineIata || null,
    stops: offer.stops,
    duration_minutes: offer.durationMinutes || null,
    deeplink: offer.deeplink,
    source: 'duffel',
    expires_at: expiresAt,
  }));

  const { error: insertError } = await admin.from('flight_prices').insert(rows);
  if (insertError) {
    console.error(`[cache] insert error for ${route}:`, insertError.message);
  } else {
    console.log(`[cache] stored ${rows.length} offers for ${route} (expires ${expiresAt})`);
  }

  return { offers, cached: false };
}

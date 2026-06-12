import { Duffel } from '@duffel/api';
import { FlightDataError, FlightOffer } from '@/types/flights';

// ISO 8601 duration → minutes (e.g. "PT2H30M" → 150, "P1DT2H" → 1560)
function parseDurationMinutes(iso: string | null): number {
  if (!iso) return 0;
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return 0;
  return (parseInt(m[1] ?? '0') * 24 * 60) +
         (parseInt(m[2] ?? '0') * 60) +
          parseInt(m[3] ?? '0');
}

export const duffel = new Duffel({
  token: process.env.DUFFEL_API_KEY!,
});

export type SearchOffersParams = {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  adults?: number;
  children?: number;
  infants?: number; // on lap → Duffel 'infant_without_seat'
  maxConnections?: 0 | 1 | 2; // omit for "any number of stops"
};

// Duffel's offer-request payload identifies adults by `type` but non-adults by
// `age` (it derives child / infant_without_seat from the age): under 2 = lap
// infant, 2–11 = child. Representative ages are enough for a price search.
const CHILD_AGE = 8;
const INFANT_AGE = 1;
type DuffelCreatePassenger = { type: 'adult' } | { age: number };

function buildPassengers(adults: number, children: number, infants: number): DuffelCreatePassenger[] {
  const list: DuffelCreatePassenger[] = [];
  for (let i = 0; i < Math.max(1, adults); i++) list.push({ type: 'adult' });
  for (let i = 0; i < children; i++) list.push({ age: CHILD_AGE });
  for (let i = 0; i < infants; i++) list.push({ age: INFANT_AGE });
  return list;
}

export async function searchOffers(params: SearchOffersParams): Promise<FlightOffer[]> {
  const { origin, destination, departDate, returnDate, adults = 1, children = 0, infants = 0, maxConnections } = params;

  const slices: { origin: string; destination: string; departure_date: string; arrival_time: null; departure_time: null }[] = [
    { origin, destination, departure_date: departDate, arrival_time: null, departure_time: null },
  ];
  if (returnDate) {
    slices.push({ origin: destination, destination: origin, departure_date: returnDate, arrival_time: null, departure_time: null });
  }

  const passengerList = buildPassengers(adults, children, infants);

  try {
    const offerRequestResponse = await duffel.offerRequests.create({
      slices,
      passengers: passengerList,
      cabin_class: 'economy',
      // Only constrain connections when a limit is set; unset = all stop counts.
      ...(maxConnections !== undefined ? { max_connections: maxConnections } : {}),
    });

    const offerRequestId = offerRequestResponse.data.id;

    const offersResponse = await duffel.offers.list({
      offer_request_id: offerRequestId,
      sort: 'total_amount',
    });

    return offersResponse.data.map((offer): FlightOffer => {
      const outboundSlice = offer.slices[0];
      const firstSegment = outboundSlice.segments[0];
      const lastSegment = outboundSlice.segments[outboundSlice.segments.length - 1];
      // Return leg (round-trip only): first segment's departure of the 2nd slice.
      const returnDepartAt = offer.slices[1]?.segments[0]?.departing_at ?? null;

      return {
        id: offer.id,
        origin: firstSegment.origin.iata_code ?? origin,
        destination: lastSegment.destination.iata_code ?? destination,
        departAt: firstSegment.departing_at,
        arriveAt: lastSegment.arriving_at,
        returnDepartAt,
        durationMinutes: parseDurationMinutes(outboundSlice.duration),
        stops: outboundSlice.segments.length - 1,
        airline: offer.owner.name,
        airlineIata: offer.owner.iata_code ?? '',
        priceMinor: Math.round(parseFloat(offer.total_amount) * 100),
        currency: offer.total_currency,
        deeplink: null,
      };
    });
  } catch (err) {
    if (err instanceof FlightDataError) throw err;

    console.error('[duffel] searchOffers error:', err);
    throw new FlightDataError(
      'Unable to fetch flight offers. Please try again shortly.',
      'DUFFEL_FETCH_ERROR',
      err
    );
  }
}

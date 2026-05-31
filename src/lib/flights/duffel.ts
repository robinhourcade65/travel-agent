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
  passengers?: number;
};

export async function searchOffers(params: SearchOffersParams): Promise<FlightOffer[]> {
  const { origin, destination, departDate, returnDate, passengers = 1 } = params;

  const slices: { origin: string; destination: string; departure_date: string }[] = [
    { origin, destination, departure_date: departDate },
  ];
  if (returnDate) {
    slices.push({ origin: destination, destination: origin, departure_date: returnDate });
  }

  const passengerList = Array.from({ length: passengers }, () => ({ type: 'adult' as const }));

  try {
    const offerRequestResponse = await duffel.offerRequests.create({
      slices,
      passengers: passengerList,
      cabin_class: 'economy',
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

      return {
        id: offer.id,
        origin: firstSegment.origin.iata_code ?? origin,
        destination: lastSegment.destination.iata_code ?? destination,
        departAt: firstSegment.departing_at,
        arriveAt: lastSegment.arriving_at,
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

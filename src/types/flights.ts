export type FlightOffer = {
  id: string;
  origin: string;
  destination: string;
  departAt: string;
  arriveAt: string;
  durationMinutes: number;
  stops: number;
  airline: string;
  airlineIata: string;
  priceMinor: number;
  currency: string;
  deeplink: string | null;
};

export class FlightDataError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'FlightDataError';
  }
}

export type FlightOffer = {
  id: string;
  origin: string;
  destination: string;
  departAt: string;
  arriveAt: string;
  // Return-leg departure time (local, ISO). null for one-way trips / legacy rows.
  returnDepartAt: string | null;
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

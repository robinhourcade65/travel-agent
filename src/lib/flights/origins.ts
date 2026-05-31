// The list of hub airports whose indicative prices are precomputed by the
// background job. One origin = one full sweep of all destination countries
// (currently ~276 Duffel calls per run).
//
// Keep this list SHORT. Each additional origin multiplies API cost and cron
// runtime by the number of destination countries (~92). Add new origins only
// when you have users actively flying from that hub and data to justify the cost.
//
// To add an origin: append the IATA code, redeploy, and manually trigger
// /api/cron/refresh-indicative?budget=300000 to seed it immediately.
export const ORIGINS: string[] = ['DUB'];

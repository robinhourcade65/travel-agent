// Static ISO-2 country code → continent mapping (UN geoscheme, 5-continent model).
// North and South America are merged into a single "Americas" (am) bucket to keep the
// chip bar to 5 continents + World. Keys are uppercase ISO-2, matching heatmap countryCode
// and the geojson ISO_A2 resolution in Globe.tsx.

export type ContinentKey = 'eu' | 'as' | 'af' | 'am' | 'oc'

export const COUNTRY_TO_CONTINENT: Record<string, ContinentKey> = {
  // ── Europe ──
  AL: 'eu', AD: 'eu', AT: 'eu', AX: 'eu', BA: 'eu', BE: 'eu', BG: 'eu', BY: 'eu',
  CH: 'eu', CY: 'eu', CZ: 'eu', DE: 'eu', DK: 'eu', EE: 'eu', ES: 'eu', FI: 'eu',
  FO: 'eu', FR: 'eu', GB: 'eu', GG: 'eu', GI: 'eu', GR: 'eu', HR: 'eu', HU: 'eu',
  IE: 'eu', IM: 'eu', IS: 'eu', IT: 'eu', JE: 'eu', LI: 'eu', LT: 'eu', LU: 'eu',
  LV: 'eu', MC: 'eu', MD: 'eu', ME: 'eu', MK: 'eu', MT: 'eu', NL: 'eu', NO: 'eu',
  PL: 'eu', PT: 'eu', RO: 'eu', RS: 'eu', RU: 'eu', SE: 'eu', SI: 'eu', SJ: 'eu',
  SK: 'eu', SM: 'eu', UA: 'eu', VA: 'eu', XK: 'eu',

  // ── Asia ──
  AE: 'as', AF: 'as', AM: 'as', AZ: 'as', BD: 'as', BH: 'as', BN: 'as', BT: 'as',
  CN: 'as', GE: 'as', HK: 'as', ID: 'as', IL: 'as', IN: 'as', IQ: 'as', IR: 'as',
  JO: 'as', JP: 'as', KG: 'as', KH: 'as', KP: 'as', KR: 'as', KW: 'as', KZ: 'as',
  LA: 'as', LB: 'as', LK: 'as', MM: 'as', MN: 'as', MO: 'as', MV: 'as', MY: 'as',
  NP: 'as', OM: 'as', PH: 'as', PK: 'as', PS: 'as', QA: 'as', SA: 'as', SG: 'as',
  SY: 'as', TH: 'as', TJ: 'as', TL: 'as', TM: 'as', TR: 'as', TW: 'as', UZ: 'as',
  VN: 'as', YE: 'as',

  // ── Africa ──
  AO: 'af', BF: 'af', BI: 'af', BJ: 'af', BW: 'af', CD: 'af', CF: 'af', CG: 'af',
  CI: 'af', CM: 'af', CV: 'af', DJ: 'af', DZ: 'af', EG: 'af', EH: 'af', ER: 'af',
  ET: 'af', GA: 'af', GH: 'af', GM: 'af', GN: 'af', GQ: 'af', GW: 'af', KE: 'af',
  KM: 'af', LR: 'af', LS: 'af', LY: 'af', MA: 'af', MG: 'af', ML: 'af', MR: 'af',
  MU: 'af', MW: 'af', MZ: 'af', NA: 'af', NE: 'af', NG: 'af', RE: 'af', RW: 'af',
  SC: 'af', SD: 'af', SH: 'af', SL: 'af', SN: 'af', SO: 'af', SS: 'af', ST: 'af',
  SZ: 'af', TD: 'af', TG: 'af', TN: 'af', TZ: 'af', UG: 'af', YT: 'af', ZA: 'af',
  ZM: 'af', ZW: 'af',

  // ── Americas (North + South) ──
  AG: 'am', AI: 'am', AR: 'am', AW: 'am', BB: 'am', BL: 'am', BM: 'am', BO: 'am',
  BQ: 'am', BR: 'am', BS: 'am', BZ: 'am', CA: 'am', CL: 'am', CO: 'am', CR: 'am',
  CU: 'am', CW: 'am', DM: 'am', DO: 'am', EC: 'am', FK: 'am', GD: 'am', GF: 'am',
  GL: 'am', GP: 'am', GT: 'am', GY: 'am', HN: 'am', HT: 'am', JM: 'am', KN: 'am',
  KY: 'am', LC: 'am', MF: 'am', MQ: 'am', MS: 'am', MX: 'am', NI: 'am', PA: 'am',
  PE: 'am', PM: 'am', PR: 'am', PY: 'am', SR: 'am', SV: 'am', SX: 'am', TC: 'am',
  TT: 'am', US: 'am', UY: 'am', VC: 'am', VE: 'am', VG: 'am', VI: 'am',

  // ── Oceania ──
  AS: 'oc', AU: 'oc', CK: 'oc', FJ: 'oc', FM: 'oc', GU: 'oc', KI: 'oc', MH: 'oc',
  MP: 'oc', NC: 'oc', NF: 'oc', NR: 'oc', NU: 'oc', NZ: 'oc', PF: 'oc', PG: 'oc',
  PN: 'oc', PW: 'oc', SB: 'oc', TK: 'oc', TO: 'oc', TV: 'oc', VU: 'oc', WF: 'oc',
  WS: 'oc',
}

export function continentOf(countryCode: string): ContinentKey | undefined {
  return COUNTRY_TO_CONTINENT[countryCode.toUpperCase()]
}

// Per-continent camera target for the auto-zoom. `world` is the default/zoomed-out view.
export const CONTINENT_CENTERS: Record<
  string,
  { lat: number; lng: number; altitude: number }
> = {
  eu: { lat: 54, lng: 15, altitude: 1.2 },
  as: { lat: 30, lng: 100, altitude: 2.0 },
  af: { lat: 0, lng: 20, altitude: 1.8 },
  am: { lat: 10, lng: -75, altitude: 2.0 },
  oc: { lat: -25, lng: 140, altitude: 1.6 },
  world: { lat: 30, lng: 10, altitude: 2.5 },
}

// Ordered chip definitions for the filter bar (World first, then the 5 continents).
export const CONTINENT_META: { key: string; label: string }[] = [
  { key: 'world', label: 'World' },
  { key: 'eu', label: 'Europe' },
  { key: 'as', label: 'Asia' },
  { key: 'af', label: 'Africa' },
  { key: 'am', label: 'Americas' },
  { key: 'oc', label: 'Oceania' },
]

// Pure toggle logic for the chip bar. Rules:
//  • Clicking World clears everything else → ['world'].
//  • Clicking a continent while World is active replaces the selection with just that continent.
//  • Otherwise toggle the continent in/out of the current set.
//  • At least one chip must always be active — emptying the set falls back to ['world'].
export function resolveContinentSelection(current: string[], clicked: string): string[] {
  if (clicked === 'world') return ['world']

  const base = current.filter((c) => c !== 'world')
  const next = base.includes(clicked)
    ? base.filter((c) => c !== clicked)
    : [...base, clicked]

  return next.length === 0 ? ['world'] : next
}

const NAMES: Record<string, string> = {
  // Europe
  AL: 'Albania', AT: 'Austria', BE: 'Belgium', BG: 'Bulgaria', BY: 'Belarus',
  CH: 'Switzerland', CY: 'Cyprus', CZ: 'Czech Republic', DE: 'Germany',
  DK: 'Denmark', EE: 'Estonia', ES: 'Spain', FI: 'Finland', FR: 'France',
  GB: 'United Kingdom', GR: 'Greece', HR: 'Croatia', HU: 'Hungary',
  IE: 'Ireland', IS: 'Iceland', IT: 'Italy', LT: 'Lithuania', LU: 'Luxembourg',
  LV: 'Latvia', ME: 'Montenegro', MK: 'North Macedonia', MT: 'Malta',
  NL: 'Netherlands', NO: 'Norway', PL: 'Poland', PT: 'Portugal',
  RO: 'Romania', RS: 'Serbia', SE: 'Sweden', SI: 'Slovenia', SK: 'Slovakia',
  TR: 'Turkey', UA: 'Ukraine',
  // Americas
  AR: 'Argentina', BR: 'Brazil', CA: 'Canada', CL: 'Chile', CO: 'Colombia',
  CR: 'Costa Rica', CU: 'Cuba', DO: 'Dominican Republic', EC: 'Ecuador',
  MX: 'Mexico', PA: 'Panama', PE: 'Peru', UY: 'Uruguay', US: 'United States',
  VE: 'Venezuela',
  // Middle East & Africa
  AE: 'United Arab Emirates', BH: 'Bahrain', DZ: 'Algeria', EG: 'Egypt',
  ET: 'Ethiopia', GH: 'Ghana', IL: 'Israel', JO: 'Jordan', KE: 'Kenya',
  KW: 'Kuwait', LY: 'Libya', MA: 'Morocco', MU: 'Mauritius', NG: 'Nigeria',
  OM: 'Oman', QA: 'Qatar', RW: 'Rwanda', SA: 'Saudi Arabia', SN: 'Senegal',
  TN: 'Tunisia', TZ: 'Tanzania', UG: 'Uganda', ZA: 'South Africa', ZM: 'Zambia',
  // Asia-Pacific
  AU: 'Australia', BD: 'Bangladesh', CN: 'China', HK: 'Hong Kong',
  ID: 'Indonesia', IN: 'India', JP: 'Japan', KR: 'South Korea', KZ: 'Kazakhstan',
  LK: 'Sri Lanka', MM: 'Myanmar', MN: 'Mongolia', MV: 'Maldives',
  MY: 'Malaysia', NP: 'Nepal', NZ: 'New Zealand', PH: 'Philippines',
  PK: 'Pakistan', SG: 'Singapore', TH: 'Thailand', TW: 'Taiwan',
  UZ: 'Uzbekistan', VN: 'Vietnam',
}

export function getCountryName(code: string): string {
  return NAMES[code] ?? code
}

/**
 * Curated map of ISO 3166-1 alpha-2 country code → primary international airport IATA.
 *
 * Used by the indicative-price seeder to ensure well-known gateway airports are
 * selected as the country representative, rather than relying solely on alphabetic
 * ordering of is_major airports (which can pick small or Duffel-unsupported airports).
 *
 * Rules for inclusion:
 * - Only airports with strong international connectivity (long-haul capable)
 * - Only entries we are confident about — omit if uncertain; fallback handles the rest
 * - One entry per country; prefer the capital/largest-hub for broadest route coverage
 */
export const COUNTRY_HUBS: Record<string, string> = {
  // ── Europe ──────────────────────────────────────────────────────────────
  AL: 'TIA', // Albania         — Tirana Mother Teresa
  AT: 'VIE', // Austria         — Vienna International
  BE: 'BRU', // Belgium         — Brussels Airport
  BG: 'SOF', // Bulgaria        — Sofia Airport
  CH: 'ZRH', // Switzerland     — Zurich Airport
  CY: 'LCA', // Cyprus          — Larnaca International
  CZ: 'PRG', // Czech Republic  — Václav Havel Prague
  DE: 'FRA', // Germany         — Frankfurt am Main
  DK: 'CPH', // Denmark         — Copenhagen Kastrup
  EE: 'TLL', // Estonia         — Tallinn Lennart Meri
  ES: 'MAD', // Spain           — Adolfo Suárez Madrid–Barajas
  FI: 'HEL', // Finland         — Helsinki-Vantaa
  FR: 'CDG', // France          — Paris Charles de Gaulle
  GB: 'LHR', // United Kingdom  — London Heathrow
  GR: 'ATH', // Greece          — Athens Eleftherios Venizelos
  HR: 'ZAG', // Croatia         — Zagreb Airport
  HU: 'BUD', // Hungary         — Budapest Ferenc Liszt
  IS: 'KEF', // Iceland         — Reykjavik Keflavik
  IT: 'FCO', // Italy           — Rome Fiumicino
  LT: 'VNO', // Lithuania       — Vilnius International
  LV: 'RIX', // Latvia          — Riga International
  MT: 'MLA', // Malta           — Malta International
  NL: 'AMS', // Netherlands     — Amsterdam Schiphol
  NO: 'OSL', // Norway          — Oslo Gardermoen
  PL: 'WAW', // Poland          — Warsaw Chopin
  PT: 'LIS', // Portugal        — Lisbon Humberto Delgado
  RO: 'OTP', // Romania         — Henri Coandă Bucharest
  RS: 'BEG', // Serbia          — Belgrade Nikola Tesla
  SE: 'ARN', // Sweden          — Stockholm Arlanda
  SI: 'LJU', // Slovenia        — Ljubljana Jože Pučnik
  SK: 'BTS', // Slovakia        — Bratislava M. R. Štefánik
  TR: 'IST', // Turkey          — Istanbul Airport
  UA: 'KBP', // Ukraine         — Kyiv Boryspil

  // ── Americas ────────────────────────────────────────────────────────────
  AR: 'EZE', // Argentina       — Buenos Aires Ezeiza
  BR: 'GRU', // Brazil          — São Paulo Guarulhos
  CA: 'YYZ', // Canada          — Toronto Pearson
  CL: 'SCL', // Chile           — Santiago Arturo Merino Benítez
  CO: 'BOG', // Colombia        — Bogotá El Dorado
  DO: 'SDQ', // Dominican Rep.  — Santo Domingo Las Américas
  MX: 'MEX', // Mexico          — Mexico City Benito Juárez
  PE: 'LIM', // Peru            — Lima Jorge Chávez
  US: 'JFK', // United States   — New York John F. Kennedy

  // ── Middle East & Africa ────────────────────────────────────────────────
  AE: 'DXB', // UAE             — Dubai International
  BH: 'BAH', // Bahrain         — Bahrain International
  EG: 'CAI', // Egypt           — Cairo International
  ET: 'ADD', // Ethiopia        — Addis Ababa Bole
  GH: 'ACC', // Ghana           — Kotoka International
  IL: 'TLV', // Israel          — Ben Gurion International
  JO: 'AMM', // Jordan          — Queen Alia International
  KE: 'NBO', // Kenya           — Jomo Kenyatta International
  KW: 'KWI', // Kuwait          — Kuwait International
  MA: 'CMN', // Morocco         — Mohammed V International
  MU: 'MRU', // Mauritius       — Sir Seewoosagur Ramgoolam
  NG: 'LOS', // Nigeria         — Murtala Muhammed International
  QA: 'DOH', // Qatar           — Hamad International
  SA: 'RUH', // Saudi Arabia    — King Khalid International
  SN: 'DKR', // Senegal         — Léopold Sédar Senghor
  TN: 'TUN', // Tunisia         — Carthage International
  TZ: 'DAR', // Tanzania        — Julius Nyerere International
  ZA: 'JNB', // South Africa    — O.R. Tambo International

  // ── Asia-Pacific ────────────────────────────────────────────────────────
  AU: 'SYD', // Australia       — Sydney Kingsford Smith
  BD: 'DAC', // Bangladesh      — Hazrat Shahjalal International
  CN: 'PEK', // China           — Beijing Capital
  HK: 'HKG', // Hong Kong       — Hong Kong International
  ID: 'CGK', // Indonesia       — Soekarno-Hatta International
  IN: 'DEL', // India           — Indira Gandhi International
  JP: 'NRT', // Japan           — Tokyo Narita
  KR: 'ICN', // South Korea     — Seoul Incheon
  LK: 'CMB', // Sri Lanka       — Bandaranaike International
  MV: 'MLE', // Maldives        — Velana International
  MY: 'KUL', // Malaysia        — Kuala Lumpur International
  NP: 'KTM', // Nepal           — Tribhuvan International
  NZ: 'AKL', // New Zealand     — Auckland International
  PH: 'MNL', // Philippines     — Ninoy Aquino International
  PK: 'KHI', // Pakistan        — Jinnah International
  SG: 'SIN', // Singapore       — Changi International
  TH: 'BKK', // Thailand        — Suvarnabhumi International
  TW: 'TPE', // Taiwan          — Taiwan Taoyuan International
  VN: 'SGN', // Vietnam         — Tan Son Nhat International
}

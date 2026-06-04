-- Reset duffel_supported = true for all curated country-hub airports.
--
-- Previous seeding runs may have marked these airports duffel_supported=false
-- after a transient Duffel 422 error or an alphabetically-prior small airport
-- for the same country failed first. This migration restores them so the next
-- indicative-price seed run can reach all major destination countries.
--
-- After applying this migration, re-run the seed for each origin:
--   npm run seed:indicative -- DUB
--   npm run seed:indicative -- LHR
--   npm run seed:indicative -- CDG

update public.airports
set duffel_supported = true
where iata in (
  -- Europe
  'TIA', -- AL Albania
  'VIE', -- AT Austria
  'BRU', -- BE Belgium
  'SOF', -- BG Bulgaria
  'ZRH', -- CH Switzerland
  'LCA', -- CY Cyprus
  'PRG', -- CZ Czech Republic
  'FRA', -- DE Germany
  'CPH', -- DK Denmark
  'TLL', -- EE Estonia
  'MAD', -- ES Spain
  'HEL', -- FI Finland
  'CDG', -- FR France
  'LHR', -- GB United Kingdom
  'ATH', -- GR Greece
  'ZAG', -- HR Croatia
  'BUD', -- HU Hungary
  'KEF', -- IS Iceland
  'FCO', -- IT Italy
  'VNO', -- LT Lithuania
  'RIX', -- LV Latvia
  'MLA', -- MT Malta
  'AMS', -- NL Netherlands
  'OSL', -- NO Norway
  'WAW', -- PL Poland
  'LIS', -- PT Portugal
  'OTP', -- RO Romania
  'BEG', -- RS Serbia
  'ARN', -- SE Sweden
  'LJU', -- SI Slovenia
  'BTS', -- SK Slovakia
  'IST', -- TR Turkey
  'KBP', -- UA Ukraine

  -- Americas
  'EZE', -- AR Argentina
  'GRU', -- BR Brazil
  'YYZ', -- CA Canada
  'SCL', -- CL Chile
  'BOG', -- CO Colombia
  'SDQ', -- DO Dominican Republic
  'MEX', -- MX Mexico
  'LIM', -- PE Peru
  'JFK', -- US United States

  -- Middle East & Africa
  'DXB', -- AE UAE
  'BAH', -- BH Bahrain
  'CAI', -- EG Egypt
  'ADD', -- ET Ethiopia
  'ACC', -- GH Ghana
  'TLV', -- IL Israel
  'AMM', -- JO Jordan
  'NBO', -- KE Kenya
  'KWI', -- KW Kuwait
  'CMN', -- MA Morocco
  'MRU', -- MU Mauritius
  'LOS', -- NG Nigeria
  'DOH', -- QA Qatar
  'RUH', -- SA Saudi Arabia
  'DKR', -- SN Senegal
  'TUN', -- TN Tunisia
  'DAR', -- TZ Tanzania
  'JNB', -- ZA South Africa

  -- Asia-Pacific
  'SYD', -- AU Australia
  'DAC', -- BD Bangladesh
  'PEK', -- CN China
  'HKG', -- HK Hong Kong
  'CGK', -- ID Indonesia
  'DEL', -- IN India
  'NRT', -- JP Japan
  'ICN', -- KR South Korea
  'CMB', -- LK Sri Lanka
  'MLE', -- MV Maldives
  'KUL', -- MY Malaysia
  'KTM', -- NP Nepal
  'AKL', -- NZ New Zealand
  'MNL', -- PH Philippines
  'KHI', -- PK Pakistan
  'SIN', -- SG Singapore
  'BKK', -- TH Thailand
  'TPE', -- TW Taiwan
  'SGN'  -- VN Vietnam
);

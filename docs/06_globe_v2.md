# 06 — Globe V2 (Feature 1)

**Goal:** rebuild the prototype globe as a production-quality React component connected to the real backend. This is your hero feature — it should feel inevitable, fast, and beautiful.

This file is longer than the others because the globe is genuinely complex. **Don't try to do it in one Claude Code session.** Split it across 3 sessions, one per "Phase" below.

---

## Design upgrade — what changes vs. your prototype

Your prototype was already strong. The V2 upgrades:

| Aspect | Prototype | V2 |
|---|---|---|
| Rendering | D3 + SVG | **react-globe.gl** (Three.js / WebGL) for smooth 3D |
| Data | Mocked airport list with random prices | Real Duffel data via heatmap API + on-demand search |
| Drill-down | Country click shows nothing | **Country → cities → flights** flow |
| Filtering | Date pickers only | Date flexibility (±N days), max stops, max duration, time-of-day, airline exclusions |
| State | All in-memory | URL-synced (sharable links like `/?from=DUB&month=2026-09`) |
| Mobile | Desktop only | Responsive; swipe gestures; bottom-sheet on mobile |
| Performance | Loads everything upfront | Lazy load country detail, virtualized flight list |
| Empty states | None | "No data for this route yet — try another" with helpful suggestions |

---

## Phase A — Globe rendering and country heat map (Session 1)

### Task for Claude Code

> Build the Globe V2 component as a Next.js client component. Reference `docs/prototype/index.html` (I'll paste my prototype into `docs/prototype/` so you can see the visual target). Match its visual style — same fonts, accent colors, shadow language — but upgrade rendering to WebGL.
>
> **Stack additions:**
> - Install `react-globe.gl` and `three` (Three.js is a peer dependency).
> - Install `d3-scale` and `d3-scale-chromatic` for color ramps.
>
> **Files to create:**
> - `src/components/globe/Globe.tsx` — the WebGL globe itself, marked `'use client'`.
> - `src/components/globe/LeftPanel.tsx` — origin selector + date picker + filters.
> - `src/components/globe/RightPanel.tsx` — flight list (empty in this phase).
> - `src/components/globe/Tooltip.tsx` — hovering tooltip.
> - `src/app/page.tsx` — top-level page composing the three panels, using URL search params for state.
>
> **Globe behavior in this phase:**
>
> 1. Load country GeoJSON from `react-globe.gl`'s built-in source or `ne_110m_admin_0_countries.geojson` (lightweight Natural Earth dataset).
> 2. On mount, fetch `/api/flights/heatmap?origin={origin}` where origin defaults to user's saved `home_airport` if logged in, otherwise `DUB`.
> 3. Color each country by the cheapest price from the response. Use a `d3.scaleSequential(d3.interpolateViridis)` or similar continuous palette. Countries with no data should appear muted gray, not invisible — leaving holes looks broken.
> 4. Hovering a country shows the `Tooltip` with: country name, cheapest price, cheapest airport IATA, currency.
> 5. Clicking a country triggers `onCountrySelect(countryCode)` — for now, just `console.log` it. Phase B handles drill-down.
> 6. Globe should auto-rotate slowly when idle (very slow, like 0.3 rpm). Stop rotation on mouse interaction; resume after 5s of inactivity.
> 7. Pinch/scroll zoom, drag to rotate, double-click to reset orientation.
> 8. Show a small "Live" pulse indicator with the timestamp of the heat-map data ("updated 2 minutes ago") in the corner.
>
> **Left panel behavior:**
>
> - Origin autocomplete searching `airports` table (server action `searchAirports(query)` you'll create in `src/server/airports.ts`).
> - Date picker with two modes: "Round trip" / "One way" toggle.
> - "Flexibility" chips: Exact, ±1 day, ±3 days, ±7 days.
> - These don't *do* anything yet — wire them to URL params but actual filtering happens in Phase C.
>
> **URL state shape:**
> ```
> /?from=DUB&depart=2026-08-15&return=2026-08-22&flex=3
> ```
> Use Next.js `useSearchParams` and `useRouter().replace()` to keep the URL in sync without full navigation. Updating state should NOT scroll the page.
>
> **Loading and empty states:**
> - Initial globe load: skeleton with a slow spin animation, "Loading flight prices…"
> - No heatmap data for the origin: dimmed globe + center message "Indicative prices are still computing for this origin. Try DUB, LHR, or CDG in the meantime."
>
> **Mobile responsiveness:**
> - Below 768px: left panel becomes a top bar (origin + date in one row), right panel becomes a bottom sheet (collapsed by default; swipe up to expand).
> - The globe always fills the remaining space.
>
> **Performance budget:**
> - First meaningful paint < 2s on a fast connection.
> - Country hover-to-tooltip < 50ms.
> - Globe should run at 60fps on a 2020-era laptop. If it can't, we lower polygon resolution; ask before doing so.
>
> **Important:** Do NOT animate every value with springs and easings everywhere. The current design trend ("everything bouncy") makes interfaces feel unprofessional and slow. Use animation deliberately: globe rotation, panel slide-ins, tooltip fade. That's it.
>
> When Phase A is done, deploy and let me click around. Commit `feat(globe): phase A — heatmap rendering`.

### Test after Phase A

- [ ] Globe renders, spins, can be dragged
- [ ] Countries colored by price; legend visible
- [ ] Hovering a country shows the tooltip
- [ ] Origin autocomplete works
- [ ] Changing origin in the URL (e.g. `?from=LHR`) updates the heat map
- [ ] Works on mobile (test on your phone)
- [ ] No console errors

---

## Phase B — Country drill-down and flight list (Session 2)

### Task for Claude Code

> Extend Globe V2 with the country drill-down and the right-panel flight list.
>
> **New behavior:**
>
> 1. When a country is clicked, the globe smoothly tilts to center that country (1.2s ease-out) and zooms slightly. Cities (airport pins) in that country fade in — only show airports we have in `public.airports` for that country.
> 2. The right panel populates with a loading state, then calls `/api/flights/search` with origin + the country's cheapest IATA + the current dates. Display results.
>
> **Flight card design** (matches your prototype but cleaner):
>
> Each flight is a small rectangular card showing:
> - Left: airline logo (use `https://content.airhex.com/content/logos/airlines_{IATA}_50_50_s.png` with a graceful fallback to a colored circle with the airline's IATA code).
> - Middle: depart time → arrive time, total duration, "Direct" or "1 stop"/"2 stops".
> - Right: price in bold, currency, small "View" chevron.
> - Whole card is clickable; opens the `deeplink` in a new tab if available; otherwise opens a `/flight/[id]` placeholder page.
> - Cards sorted by price ascending by default. Sort toggle: Price / Duration / Departure time.
>
> 3. Clicking a city pin (instead of the country) switches the destination to that specific city and re-fetches.
> 4. Breadcrumb at the top of the right panel: `← All countries / Japan / Tokyo (NRT)`. Clicking any segment navigates back up.
> 5. ESC key or clicking the globe background returns to the country-level view.
>
> **State management:**
> Add to the URL: `&to=NRT` once a destination is picked. So a fully-resolved URL looks like:
> ```
> /?from=DUB&to=NRT&depart=2026-08-15&return=2026-08-22
> ```
> This makes search results shareable.
>
> **Empty / error states for the flight list:**
> - No results: "We couldn't find flights for these dates. Try widening the date flexibility."
> - API error: "Couldn't load flights. [Retry button]"
> - Rate-limited (HTTP 429): "You've made a lot of searches. Sign up for a free account to get more, or come back in an hour."
>
> Commit `feat(globe): phase B — drill-down and flight list`.

### Test after Phase B

- [ ] Click country → globe tilts, cities appear, flights load on the right
- [ ] Click a flight card → opens booking site in new tab
- [ ] URL updates when navigating; refresh keeps state
- [ ] Breadcrumb works
- [ ] ESC returns to country view
- [ ] Mobile: bottom sheet expands with flight list

---

## Phase C — Filters and date flexibility (Session 3)

### Task for Claude Code

> Add advanced filters to Globe V2.
>
> **Filter UI** (lives in the left panel, collapsible "Advanced filters" section):
> - Max stops: 0 / 1 / Any (chip group, defaults to "Any")
> - Max total duration (slider, 2–48 hours)
> - Departure time window (range slider, 0:00–24:00)
> - Airline exclusions (multi-select autocomplete; rare in V1, low priority — make it work but don't spend much time on UI polish)
> - Currency selector (top right of the page, not in the filter panel — affects price display globally)
>
> **Filters apply client-side** to already-fetched results. Don't re-fetch on every filter change; that wastes API calls. Only re-fetch when origin / destination / dates / flexibility change.
>
> **Date flexibility:**
> - When flex > 0, the heatmap query becomes "cheapest in window {departDate ± flex days}". This requires extending `/api/flights/heatmap` to accept an optional `flex` param and aggregating across multiple `indicative_prices` rows. Add this server-side logic.
> - For flight search results: with flex enabled, perform N parallel searches (one per day in the window) and merge results. Hard-cap at 7 days of flex to avoid runaway costs.
>
> **Currency conversion:**
> - All prices in DB are in EUR. To display in USD/GBP/etc., fetch rates from a free source (e.g. `https://api.frankfurter.app/latest?from=EUR`) once per session and cache in a context provider.
>
> **Performance:**
> - Memoize filter application with `useMemo`.
> - With 100+ flight results, list rendering should remain smooth (virtualize with `@tanstack/react-virtual` if needed).
>
> Commit `feat(globe): phase C — filters and flexibility`.

### Test after Phase C

- [ ] Filters narrow the flight list without re-fetching
- [ ] Date flexibility ±3 increases the result count
- [ ] Currency switch updates all prices instantly
- [ ] No console errors, no janky scrolling

---

## End-of-feature checklist

After all three phases:

- [ ] Globe is genuinely beautiful — show it to a friend and watch their reaction
- [ ] Three real users can complete the flow: open page → find a destination → click through to book
- [ ] Lighthouse Performance score > 80 on desktop
- [ ] Lighthouse Accessibility score > 90 (keyboard navigation works; color contrasts pass)
- [ ] You haven't spent more than $5 on Duffel testing — the cache is doing its job

Next file: **`07_alerts.md`**.

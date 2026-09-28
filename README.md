# SNOWNOW

**Find your best mountain day.**

SNOWNOW is a decision engine for ski days. Not a snow report, not a traffic app,
not another conditions dashboard — an app that answers one question:

> What is the best mountain day I can realistically have?

It optimises the whole loop — **HOME → MOUNTAIN → SNOW → MOUNTAIN → HOME** —
for maximum good skiing and minimum miserable driving, and gives you the call:

```
BRECK
9.2
LET'S RIDE.

Leave 5:18 AM · Arrive 7:04 AM
Prime snow 8:10–10:47 AM
Head home 2:42 PM · Home 4:28 PM
```

---

## The two modes

| | Means | Answers |
|---|---|---|
| **NOW** | Decision mode. Today. | "I want to ski today — where, and when do I leave?" |
| **LATER** | Planning mode. A future date or range. | "What would my ski day look like on Saturday?" |

Both ask the same question and share the same engine. LATER differs only in how
much certainty it is willing to claim.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:5173 — demo mode, zero setup
npm test           # the full suite (vitest)
npm run build      # type-check + production bundle
npm run preview    # serve the built app
npm run server     # the data proxy (server/index.mjs) — needed for traffic, roads and snowpack
```

Node 20+ required. **With no environment variables set, the app runs entirely
in demo mode** — no API keys, no services, no network calls beyond loading the
page. See "Going live" below for what each optional variable turns on.

---

## Your ride

The engine has always modeled a person — how much they value sleep, powder,
quiet, an early night, a short drive — but until recently the only person it
modeled was the default one. The **Your ride** panel on the homepage is the
whole personal layer:

- **Passes you hold** (Epic, Ikon, Mountain Collective, Indy). A mountain on
  your pass scores as if the ticket were free, because for you it is; the
  card reads "On your Epic Pass" instead of a walk-up price. Mountains that
  aren't on your pass still appear, with the price. "Only show mountains on
  my pass" narrows the field, and quietly stands down if it would leave
  nothing reachable.
- **Sleep or send**, **what you're chasing** (corduroy ↔ powder), **crowds**,
  **how far you'll drive**, **home by**. Each maps to one `RiderPreferences`
  field the optimiser and scorer already read.

Settings live in this browser only (`localStorage`), are validated field by
field on the way back in, and reset from the panel. Nothing here changes what
NOW or LATER mean — only whose day they are optimising.

Every plan can leave the app: **Share plan** (the native share sheet, or the
clipboard) and **Add to calendar** (an `.ics` with the departure as the event
and a 30-minute alarm). NOW says how old its answer is and has a **Refresh**.

---

## ⚠️ Data honesty

SNOWNOW can run on demo data, a mix of live and demo, or (mostly) live data —
and it is always honest about which. This is enforced structurally, not by
convention:

- every value carries a `Provenance` stamp (`source`, `observation`,
  `confidence`, and for live data `fetchedAt`/`validUntil`)
- the UI resolves that into exactly one of four words — **LIVE**, **STALE**,
  **DEMO DATA**, **UNAVAILABLE** — via `domain/provenance.ts#displayStatus`,
  and never shows a fifth
- a live value past its own freshness window reads **STALE**, not LIVE
- demo data is never upgraded to LIVE, no matter how fresh it "feels"
- when a feed is unavailable the app says so and declines to fill the gap
  ("Road intel is offline. We can show the mountain, but we're not going to
  fake the drive.")
- a live registry never falls back to demo data, at any point — not per
  request, and not even as a configuration default when something's unset.
  A slot with nothing genuinely live to serve reports `unavailable`,
  mechanically enforced (`providers/index.test.ts`) — see "The production
  data gate" below
- **measured and modeled are different words.** A snow depth from a SNOTEL
  station says MEASURED and names the station, its elevation and its
  distance from the lifts; a snow depth from the weather model says MODELED
  and is shown once, at the forecast point, never per elevation — because a
  model's depth is one grid-cell number however many elevations you ask
  about
- tap "Where this data came from" on any recommendation to see every feed's
  status, provider and fetch time individually — the one aggregate badge on
  the card is a summary, not the only source of truth

The demo world is deterministic: the same date always produces the same
mountain day, so recommendations don't flicker and everything is testable.
Day 0 is deliberately shaped into a storm day — the product story starts at
4:47am with snow on the ground.

### Going live

| Feed | Source | Path | What it needs |
|---|---|---|---|
| **Weather** | Open-Meteo | browser → API | Nothing — free, keyless, CORS-enabled |
| **Alerts** | NWS | browser → API | Nothing — US mountains only; elsewhere reports unavailable |
| **Snowpack** (measured) | NRCS SNOTEL | browser → proxy → API | `server/` deployed + `VITE_API_BASE_URL`. No key. |
| **Traffic** | Google Routes | browser → proxy → API | `server/` + `GOOGLE_ROUTES_API_KEY` + `VITE_API_BASE_URL` |
| **Road conditions** | CDOT / COtrip | browser → proxy → API | `server/` + `COTRIP_API_KEY` (free) + `VITE_API_BASE_URL`; `VITE_ENABLE_ROAD_CONDITIONS=false` disables |
| **Lift ops** | Liftie (third-party) | browser → API | Nothing — every resort in the dataset has a Liftie id |
| **Crowds** | — | — | Unavailable, always. No trustworthy live source exists |
| **Pricing** | — | — | Unavailable, always. Investigated, unverifiable — official purchase link shown instead |
| **Places** | — | — | Unavailable, always. Never in scope |

```bash
cp .env.example .env
# edit .env — at minimum: VITE_DATA_MODE=live
npm run build
```

`VITE_*` variables are baked into the client bundle **at build time**, not
read at runtime — switching modes means rebuilding, which is also what keeps
demo mode the safe, can't-happen-by-accident default: there is no runtime
toggle to flip on live data without a deliberate build.

### The proxy

`server/index.mjs` is the one server-side thing this project needs, and it
exists for three reasons a browser can't cover: hold secrets (Google Routes,
CDOT), reach hosts that don't serve CORS (SNOTEL, CDOT), and share a cache
across visitors. It is dependency-free `node:http` so "does this leak a key
anywhere" is a five-minute read. Endpoints:

| Endpoint | Upstream | Cache |
|---|---|---|
| `POST /api/travel-curve` | Google Routes, 9 outbound / 11 return departure samples | 15 min, shared; today's curves keyed by quarter-hour |
| `POST /api/route-preview` | Google Routes, one "now" reading (the map) | 15 min |
| `GET /api/road-conditions` | CDOT `roadConditions` + `incidents`, normalized to one event list | 5 min, one statewide fetch serves every corridor |
| `GET /api/snotel?station=842:CO:SNTL` | NRCS AWDB daily depth + SWE, plus station metadata | 30 min |
| `GET /api/health`, `GET /api/test-drive` | — | — |

Guard rails: an origin allowlist (`CORS_ORIGIN`), a per-IP rate limit
(`RATE_LIMIT_PER_MINUTE`), and in-flight de-duplication so thirteen mountains
asking for the same corridor in the same second produce one Google call. A
same-day traffic request no longer loses every past departure time: Google
refuses a `departureTime` in the past, so the proxy drops those grid points
and anchors the curve at "now" instead of reporting the whole day
unavailable.

Deploy it anywhere Node runs (it is on Render today). GitHub Pages cannot host
it — Pages serves static files and has nowhere to hold a secret. Every
variable is documented in `.env.example`.

### GPS-based routing

"📍 Use my current location" sends the browser's exact `navigator.geolocation`
coordinates to the same `/api/travel-curve` endpoint the six manual cities
use — `origin`/`destination` there were always plain `{ lat, lon }`, never a
place name. No geocoding was added: the UI never needs to show a street
address, only "Using your current location". `engine/routing.ts` synthesises
one direct route from the fix to each mountain; a manual city keeps its
hand-authored routes.

One cost implication: the proxy's travel-curve cache key is rounded to three
decimal degrees (~300 ft) and shared across visitors. Six fixed cities pool
every visitor from that city onto the same entries; a GPS fix mostly misses
that shared cache and pays its own Google Routes calls. See "Caching and API
cost".

### The production data gate

`createLiveRegistry()` (`providers/live/index.ts`) never returns a
`Demo*Provider` in any slot, under any configuration. This isn't a claim —
it's mechanically enforced: `providers/index.test.ts` constructs a live
registry with every optional knob left unset and asserts none of its eight
provider slots is `instanceof` any of the eight demo classes, then repeats
the check with each knob individually disabled. A slot this registry can't
genuinely serve reports `unavailable` (see `providers/live/unavailable.ts`)
— never the plausible-looking demo number that same slot would show in an
actual demo build.

One caveat, stated precisely: this is a **runtime** guarantee, not a
**bundle-size** one. `providers/index.ts` statically imports both registries
so one function can dispatch between them, and the demo providers' code
remains present as inert bytes in the production bundle, never constructed.

### Snowpack: measured, and named

`SnotelSnowpackProvider` (`providers/live/snotelSnowpack.ts`) reads the NRCS
SNOTEL network — automated stations with a snow pillow, a depth sensor and a
precipitation gauge, most of them within a few miles of a Colorado ski area
at base-to-mid-mountain elevation. It is the one source in this project that
*measures* snow rather than modeling it. Each reading carries depth, snow
water equivalent, pack density, the 24-hour depth change and a five-day
new-snow **floor** (the sum of positive daily depth changes — settlement
means this undercounts what fell, and the panel says so).

`data/snotelStations.ts` maps each mountain to a station **and the station's
name**. The live provider fetches NRCS's own metadata for the id and refuses
to show a reading whose name doesn't match — so a wrong id fails as
UNAVAILABLE with the actual name in the reason, never as some other
station's depth wearing this mountain's label. A reading more than three days
old is likewise refused. The station ids were chosen from the published NRCS
list without a network path to confirm them (see "Known limitations"); the
name check is what makes that safe.

### Mountain operations: a three-tier strategy

`LiveMountainProvider.getOperations` (`providers/live/mountainStatus.ts`)
tries, in order:

1. **Official resort feed.** Not implemented — no resort publishes a
   verified, structured endpoint this project could confirm.
2. **Liftie** (`providers/live/liftieOperations.ts`), an open-source
   lift-status aggregator with a public JSON endpoint per resort
   (`GET https://liftie.info/api/resort/:id`). The adapter reads Liftie's
   real shape — a `status` map of lift name → `open | hold | scheduled |
   closed` plus a `stats` tally — and cross-checks the two; a disagreement
   is an unrecognized shape and reports `unavailable`. `data/resortSources.ts`
   carries Liftie's compact ids (`breck`, `abasin`, `winterpark`…) for all
   thirteen mountains. A pre-opening board reads "scheduled to open", not
   closed; a board Liftie itself last scraped hours ago is refused. Every
   value sourced this way carries `Provenance.attribution` saying plainly
   "Third-party aggregator (Liftie) — not the resort's own feed".
3. **Unavailable.** No real signal, no invented one. `scoring.ts` and
   `snowClock.ts` impute a neutral value and flag it as imputed, which lowers
   the plan's confidence rather than quietly scoring a made-up number.

### Road conditions: authoritative, per corridor, right now

`CotripRoadProvider` (`providers/live/cotripRoad.ts`) reads CDOT's real-time
feed through the proxy: `roadConditions` (surface and chain/traction law by
segment) and `incidents` (closures, crashes), normalized into one event list
and filtered by highway name and a mile-marker window per corridor (a crash
in Grand Junction is on I-70 but not between Denver and Vail).

What it will and won't claim: `closed` only for an incident CDOT types as a
closure whose message says the *road* is closed (a lane closure is not a road
closure) — because a closure removes the route from consideration entirely
(`engine/inputs.ts`), the one call that must not be made loosely.
`chains-required` when a segment's impacts name a chain or traction law.
`clear` at *medium* confidence when the feed was understood and said nothing
about the corridor. An unrecognized feed is `unavailable`, never clear. And
road status is a right-now fact: for a planned future date it reports
unavailable rather than pretending today's closure will still be there
Saturday.

Scoring prefers this read over anything the traffic source inferred. Google
Routes reports travel time, not surface state, and the traffic client no
longer stamps a fabricated `clear` on its data.

### Ticket pricing: investigated, and genuinely unavailable

Every one of the thirteen mountains prices tickets through a dynamic commerce
flow, not a stable public "price for this date" endpoint. Live mode reports
ticket price as `unavailable` for every resort — never the demo model's
plausible number presented as live. The resort's real ticket page is still
shown. A mountain on a pass the rider holds skips the question entirely.

### Crowds: retired from live mode

A calendar heuristic used to stand in here. It was a projection that could be
mistaken for measured attendance, so it was removed; live mode reports
`unavailable` and the scorer imputes a neutral, lightly-weighted value
(`crowds: 0.6` in `config/weights.ts`).

---

## Architecture

```
src/
  domain/       Types and pure primitives. No I/O, no React.
    time.ts       Minutes-since-local-midnight, the engine's unit of time
    dates.ts      DateKey helpers, weekday/holiday logic
    mountain.ts   The generic Mountain model; pass labels and coverage
    conditions.ts Weather, operations, travel curves, crowds
    snowpack.ts   A measured station reading, distinct from modeled depth
    alerts.ts     Official weather alerts — supplements the forecast only
    road.ts       Authoritative road/corridor status, separate from traffic
    plan.ts       SnowClock, DayScore, DepartureOption, ReturnOption, SkiDayPlan
    provenance.ts Availability<T>, confidence, displayStatus (LIVE/STALE/DEMO/UNAVAILABLE)

  config/       Everything tunable, in one place
    weights.ts    Scoring weights, rider preferences (incl. passes), optimiser economics
    env.ts        The one place that reads import.meta.env

  lib/          Small, dependency-free utilities
    cache.ts      TTL cache + memoizeAsync (in-flight de-duplication)
    http.ts       fetchJson with a hard timeout and typed failures
    share.ts      Share text and the .ics calendar event, derived from a plan
    snow.ts       Snow-density physics shared by demo and live weather

  data/         Content, not code
    mountains.ts  Thirteen Colorado mountains, four pass networks, two snow regions
    origins.ts    Six starting cities, plus `gpsOrigin()` for a live GPS fix
    corridors.ts  Shared traffic corridors, their severity and weather region
    resortSources.ts  Per-resort Liftie id, official ops page, official ticket page
    snotelStations.ts Per-mountain SNOTEL station, with the name the live reading must match
    pricing.ts    Demo lift-ticket rate cards

  providers/    Interfaces first, implementations behind them
    types.ts      Weather · Traffic · Mountain · Pricing · Places · Alerts ·
                  RoadCondition · Snowpack
    demo/         The demo bundle — deterministic, used by every engine test
    live/         Open-Meteo, NWS, Google Routes (via proxy), CDOT (via proxy),
                  SNOTEL (via proxy), Liftie; fetchCache.ts shares one TTL cache
    index.ts      createProviderRegistry() — the one place mode is decided

  engine/       The product's actual intelligence. Pure, testable, no React.
    inputs.ts     Fan-out to providers; a closed corridor removes a route
    routing.ts    resolveAccessRoutes() — the origin abstraction
    snowClock.ts  When is the mountain actually good?
    optimize.ts   Joint (leave home × leave mountain) optimisation
    scoring.ts    The number on the card, and why
    explain.ts    Plain-language reasoning
    plan.ts       buildPlan · recommend · stayOrGo
    future.ts     LATER: range projection with confidence discounting

  ui/           React. Renders plans; contains no business logic.
    hooks/usePreferences.ts  Your ride, remembered and validated
    components/RiderSettings.tsx · SnowpackPanel.tsx · PlanActions.tsx

server/
  index.mjs     The data proxy: Google Routes, CDOT, SNOTEL; cache, dedup,
                rate limit, origin allowlist. Pure helpers are unit-tested
                from src/server/proxy.test.ts.
```

**The rule that shapes everything:** the UI never talks to a provider, and the
engine never talks to React. `App.tsx` calls exactly one function —
`createProviderRegistry()` — and that function, plus `resolveEnvironment()`
right beside it, are the only two places in the codebase that decide demo
vs. live. Every other file, including every engine test, talks to
`ProviderRegistry` and has no idea which world it's in.

### The Snow Clock

Ski quality is modelled through the day at 15-minute resolution. Fresh snow is
treated as a **consumable stock**, not a static number: it accumulates
overnight, grows while it snows, and is consumed at a rate driven by how many
people are on the hill and how much terrain is open to spread them over.
Everything else — surface temperature, sun, wind, visibility, lift access,
avalanche-control delays — modulates how good the remaining snow is to ski.

"Prime" is the best contiguous stretch relative to the day's own peak, so a day
that never drops below 80 still has a prime window, and a mediocre day still
gets a named best-stretch rather than nothing.

### The optimiser

Morning and afternoon are **not** independent problems. Leaving later can be
worth it if it buys a better exit; skiing longer is only worth it if the drive
home doesn't eat the gain. So `optimizeDay` searches a grid of *(leave home,
leave mountain)* pairs jointly — typically several thousand candidate days per
mountain — and scores each in one currency: **quality-weighted ski minutes**.

One minute of 100-quality skiing is worth 1.0. One minute of 60-quality skiing
is worth 0.6. Drive time, congestion pain, sleep, standing in a dark car park
before the ropes drop, après while the road empties, and a late arrival home
are all converted into that same currency by `OPTIMIZER_CONFIG` — not by magic
numbers sprinkled through the code.

Selection is two-stage: the utility function narrows the field, and the
**published score makes the final call**, so the app can never recommend 4:54am
while displaying a better number next to 5:30am.

### Scoring

Thirteen weighted factors — snow, the 5-day snow cycle, snow timing, weather,
wind, terrain, operations, travel burden, traffic, roads, crowds, useful ski
time, ticket — plus named post-hoc penalties for costs that have no upper
bound (getting home hours late).

Traffic and crowds are weighted *lightly* on purpose: both already depress the
snow clock and the travel burden, and double-counting them would let a
two-hour dawn patrol outscore a full powder day.

A missing feed produces a neutral, **explicitly flagged** value and lowers the
day's confidence. It never silently becomes a plausible-looking number.

The score is decision support. It is not a measurement of anything.

### Adding a mountain

Add an entry to `src/data/mountains.ts` with its access routes, a Liftie id in
`resortSources.ts` and a SNOTEL station in `snotelStations.ts`. Nothing in the
engine, the scoring, the optimiser or the UI knows any mountain's name.
`dataset.test.ts` proves it by planning a wholly invented mountain.

### Why the winner changes

The demo data is tuned for *causal* differentiation, not variety for its own
sake. Each mountain has an identity and a condition that punishes it, and the
weather generator produces the conditions that expose them:

| Mountain | Wins when | Loses when |
|---|---|---|
| Vail | It dumps and the wind stays down | Wind, crowds, the drive |
| Beaver Creek | It's blowing everywhere else | Modest snow, furthest up I-70 |
| Breckenridge | Cold, calm, decent snow | Wind holds, long control work |
| Keystone | Dry and firm — first chair, best corduroy | Any real storm |
| Winter Park | Real snow and clear roads | Berthoud Pass in a storm |
| Copper | Closest big mountain to Denver, terrain that sorts itself | The top goes on wind hold |
| Crested Butte | Deep enough to justify the drive | The drive |
| Purgatory | The San Juans get the storm | Being nowhere near Denver |
| Wolf Creek | It's deep, and the ticket is $99 | Four and a half hours from Denver |

---

## Tests

```
npm test      # runs on every push and pull request (.github/workflows/ci.yml)
```

The core optimisation logic is tested without rendering any UI, against
hand-built fixtures (`src/test/fixtures.ts`) rather than the demo providers — a
test that fails because the demo weather changed would be telling us nothing.

Coverage spans: snow-clock physics, prime-window selection, scoring (factor
interactions, imputation, the ticket-price ceiling, pass coverage), morning
and return optimisation, the recommendation layer, LATER, dataset integrity,
planning a mountain the engine has never seen, demo-provider determinism,
provider-failure handling, and the UI end-to-end — including the ten-second
test as an executable acceptance test, honest empty states, rider settings
persisting across visits, share/calendar/refresh, and accessibility.

**Live-data coverage** (against mocked `fetch`): Open-Meteo normalization,
unit conversion, storm recency (real day gaps, dustings ignored, an honest
floor), modeled depth reported once; NWS alert parsing and overlap with the
planned day; Liftie's real response shape, pre-opening boards, stale boards;
the CDOT normalizer's closure/lane-closure/chain-law distinctions and
mile-marker windows; SNOTEL derivations, the station-name check, stale
readings; the Google Routes client's request shape; the proxy's time
arithmetic and past-departure handling (`src/server/proxy.test.ts`); the
shared fetch cache's in-flight de-duplication; `displayStatus`; and a corridor
closure that removes a route from consideration entirely.

**The scenario suite** (`engine/scenarios.test.ts`): fourteen realistic
Colorado ski days, each asserting not just a number but that the plan's own
explanation states the real reason a knowledgeable Colorado skier would
recognise.

---

## Design

Dark by commitment, not by toggle. The app is designed for one specific moment:
a phone held in one hand, in a dark room, at 4:47 in the morning, by someone who
has not had coffee yet. That rules out light backgrounds, small type, dense
tables and anything that needs to be studied.

- mobile-first, one-handed, 44px+ tap targets, minimal typing
- huge numerals, strong hierarchy, generous space
- motion is decoration and switches itself off for `prefers-reduced-motion`
- charts are hand-rolled SVG (no charting library) and expose their data as
  tables to assistive technology; the map is a group of real buttons, not an
  image, and labels on the crowded I-70 stretch flip below their dots rather
  than overlapping
- status is never encoded in colour alone
- ~115 kB gzipped, no web fonts, no external requests in demo mode
- each screen is a real history entry (`#/now`, `#/later`, `#/map`), so the
  phone's Back gesture returns home instead of leaving the app
- the starting city and your ride settings are remembered between visits; a
  GPS fix is used for the visit only and never written to storage

**The verdict outranks the decimal.** "LET'S RIDE." is pinned to a number the
model reaches a couple of times a season, which is the point of having it.

---

## Caching and API cost

The optimiser asks a provider for one whole travel curve per (route, direction)
and interpolates locally (`engine/travel.ts#travelAt`) — it never asks again
per candidate departure time.

- **Client-side**: every live provider goes through one shared TTL cache
  (`providers/live/fetchCache.ts`) with in-flight sharing, so a NOW screen
  makes one request per distinct URL, not one per mountain per render, and
  `Provenance.fetchedAt` is the moment the network answered, not the moment
  the cache was read. Weather 10 min, alerts and roads 5, Liftie 10, SNOTEL
  30, travel curves 5.
- **Server-side**: travel curves 15 min, the CDOT feed 5, SNOTEL 30 — all
  shared across every visitor. The in-memory cache doesn't survive a restart
  or scale past one instance; a multi-instance deployment needs Redis or a KV
  store behind the same `cacheGet`/`cacheSet` shape.

**API calls for one NOW request** (one mountain, one origin, cache cold):

| Call | Count | Notes |
|---|---|---|
| Open-Meteo | 3 | main forecast + base + summit points, in parallel |
| NWS alerts | 1 | |
| Liftie | 1 | |
| SNOTEL (proxy) | 1 | two upstream calls: data + station metadata |
| CDOT (proxy) | 1 | one statewide fetch, shared by every corridor |
| Google Routes (proxy) | up to 20 | fewer on a same-day request once the morning is under way |

A full NOW screen multiplies Open-Meteo, Liftie, SNOTEL and Google Routes by
the number of reachable mountains (8–13). Google Routes is the only billed
call; at personal-use volume with the shared 15-minute cache it sits inside
the free tier. A public multi-user deployment should budget for it, set
`CORS_ORIGIN` to the real frontend, and keep the rate limit on.

## Known limitations

- **Only Google Routes has been smoke-tested against its real endpoint.**
  This sandbox's network policy blocks `api.open-meteo.com`,
  `api.weather.gov`, `liftie.info`, `data.cotrip.org` and
  `wcc.sc.egov.usda.gov` outbound, so Open-Meteo, NWS, Liftie, CDOT and
  SNOTEL are implemented against their documented shapes with passing mocked
  tests, and each fails safe (`unavailable`) on a shape it doesn't recognize.
  Before trusting any of them in production, hit the endpoint once by hand
  and compare against the adapter's expectations.
- **The SNOTEL station ids and the CDOT mile-marker windows are best
  knowledge, not confirmed.** A wrong station id is caught by the name check
  and reports unavailable with the real name in the reason; a wrong marker
  window would either miss an event or flag one a few miles off the route.
  Both live in one data file each (`snotelStations.ts`, `CDOT_ROUTES` in
  `cotripRoad.ts`).
- **Liftie ids follow Liftie's repository naming** (`breck`, `abasin`,
  `winterpark`, `crestedbutte`, `wolfcreek`…). An id Liftie doesn't have
  404s and reports unavailable; none is guessed from a mountain's name.
- **A same-day traffic curve is only as wide as the day has left.** After
  the morning grid has passed, the outbound curve is a single "now" sample
  and the optimiser's departure choice collapses to it — which is the honest
  answer at 9am.
- **Colorado/`America/Denver` only.** The proxy's local→UTC conversion is
  DST-aware and tested; a mountain outside that zone needs the zone threaded
  through, not hard-coded.
- **No official resort feeds, no crowds, no pricing** — see the sections
  above for why each is `unavailable` by design rather than by gap.

Not built, by design: accounts, saved mountains, notifications, a service
worker (the manifest is in place but nothing is cached offline), webcams,
parking, multi-day trips.

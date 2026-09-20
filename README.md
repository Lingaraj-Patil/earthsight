# EarthSight

**See environmental risks before they become disasters.**

EarthSight is an environmental early-warning platform. Citizens photograph a
hazard; EarthSight predicts whether that hazard is about to become
significantly more dangerous because of upcoming rainfall and the terrain it
sits on.

The distinction matters: this is not a pollution-reporting map. Reporting tools
tell you what already went wrong. EarthSight forecasts **which existing hazards
are about to escalate**, so limited municipal attention goes to the right place
*before* the storm.

---

## The core idea

A blocked storm drain is a nuisance on a dry day. The same drain, in a local
depression, with 18mm of rain arriving in six hours, is a flood.

EarthSight makes that transformation explicit and explainable:

```
CURRENT RISK  54  MODERATE   →   PROJECTED RISK  91  CRITICAL
```

...and then shows exactly which factors produced the change, each with its own
point contribution.

---

## What makes the risk model more than an API call

The weakest version of this idea is "send photo to an AI, send coordinates to a
weather API, add the numbers." EarthSight's risk engine does real geospatial
computation on top of those inputs.

### Terrain-aware flood accumulation

Two visually identical blocked drains are not equally dangerous. One may sit on
a well-drained slope; the other in a bowl that half the street drains into.
EarthSight resolves this by modeling the actual hydrology at the hazard's exact
coordinates:

1. **Sample real elevations** — a 9×9 grid at 60m spacing (≈480m square) around
   the hazard, via the Open-Meteo Elevation API (free, keyless, 81 points in one
   request).
2. **Compute D8 flow direction** — for every cell, find the steepest-descent
   neighbour among its 8 neighbours, with diagonal distances correctly weighted
   (`slope = drop / distance`). This is the standard single-flow-direction
   routing algorithm used in GIS hydrology.
3. **Compute flow accumulation** — process cells from highest to lowest,
   pushing each cell's accumulated count into its receiver. A single pass
   suffices because a cell is always finalised before its receiver consumes it.
   The value at the centre cell is the size of the **upslope catchment draining
   into the hazard**.
4. **Derive flood exposure (0–1)** from three signals:
   - depression depth (45%) — how far below its surroundings the hazard sits
   - catchment size (35%) — share of sampled area draining into it
   - local flatness (20%) — steep ground sheds water, flat ground ponds

Only the raw elevations come from the network. All hydrology is computed
locally in `lib/terrain.ts` and is fully deterministic.

**Verified properties:** flow accumulation conserves mass exactly (all 81 cells
accounted for at local minima); a synthetic basin collects all 80 upslope cells
and scores 0.65 exposure, while a uniform slope collects 4 and scores 0.25;
identical inputs always produce identical output.

Terrain then modulates the hazard category's baseline rainfall sensitivity
(bounded 0.7×–1.4×, so terrain refines the category signal rather than
overwhelming it) and contributes its own explainable factor to current risk.

### Hydrological hazard chains

A single blocked drain is a local problem. Three blocked drains on the same
downhill path are a system failure: when the upslope one overflows, its water
arrives at the next one, which is already blocked. Crews that clear them in the
wrong order waste the intervention.

`lib/cascade.ts` finds these chains. For every pair of hazards it asks whether
water plausibly flows from A to B, which requires three conditions at once:

- **proximity** — within 1200m, close enough to share a drainage path
- **elevation drop** — at least 1.5m, so flow direction is trustworthy rather
  than DEM noise
- **gradient** — at least 0.002, steep enough to route water rather than pond

Connected components of the resulting directed graph are chains, ordered
upstream to downstream by elevation. The downstream outlet then carries
**compounded risk** (+4 per upstream blockage, capped at +12) because it
receives displaced water on top of its own catchment.

The map draws these links, and the priority panel surfaces the actionable
conclusion: *clear upstream first — clearing the outlet alone will refill.*

**Verified properties:** haversine distance is exact (111,195m for 1° latitude);
a synthetic 910m → 906m → 901m chain is detected and correctly ordered with the
outlet receiving +8 from two upstream blockages; pairs below the drop threshold
are correctly rejected; output is canonical regardless of input order.

### Calibration

Weights are tuned so a realistic worst case lands in the low-to-mid 90s rather
than saturating at 100. Saturation destroys differentiation: if several hazards
all pin to 100, the priority ranking stops being informative, which is the
entire point of the product.

```
base severity      0-55   visual evidence, largest single input
terrain exposure   0-18   the geospatial differentiator
category bonus     0-5    coarse prior, largely superseded by terrain
current rainfall   open   observed fact, usually small
-- forecast-driven, only when the forecast is meaningful --
forecast rainfall  ~0-20
rain probability   0-12
timing urgency     0-12
```

### Honest escalation

Escalation is gated on real forecast thresholds (≥2mm rainfall **or** ≥20%
probability), not on the score delta. If a hazard goes from 78 to 79 with a 4%
chance of rain, EarthSight says *"weather-driven escalation is currently
minimal"* instead of dressing up rounding noise as a prediction. The timeline,
the transformation card, and the recommended action all respect this.

---

## Data flow

```
photo ──► /api/analyze-hazard (server-only) ──► Gemini vision ──► structured JSON
                                                                        │
GPS or geocoded address ──► coordinates ──┬──► Open-Meteo forecast ─────┤
                                          │                             │
                                          └──► Open-Meteo elevation ──► D8 flow
                                                                    accumulation
                                                                        │
                                                                        ▼
                                                    deterministic risk engine
                                                                        │
                                    current risk · projected risk · factors
                                                                        │
                                              localStorage ──► priority map
```

---

## Honesty guarantees

These were enforced deliberately, and are easy to verify in the source:

- **No fake AI.** There is no local heuristic, lookup table, or fallback
  "demo analysis" anywhere. If `GEMINI_API_KEY` is missing, the server returns
  `CONFIG_MISSING` and the UI shows a real configuration error.
- **No fabricated confidence.** Severity and confidence come from the model's
  reading of the image, never a formula.
- **No placeholder coordinates.** Real reports get coordinates from device GPS
  or real forward geocoding. If geocoding fails, the user is asked to retry —
  no silent fallback to a default city centre.
- **No simulated processing.** Loading stages reflect actual promise
  resolution. There are no artificial delays.
- **No randomness.** Zero `Math.random()` in the codebase; risk is fully
  reproducible.
- **Seed data is labeled.** The four built-in sample incidents render as
  `SAMPLE INCIDENT`; real submissions render as `COMMUNITY REPORT`. Their
  synthetic terrain is still run through the same real hydrology model.
- **Graceful degradation is disclosed.** If elevation or weather data is
  unavailable, the risk engine says so in its factor list rather than guessing.

---

## Tech stack

Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS v4 · React Leaflet ·
OpenStreetMap · Lucide

**APIs** (all free; only Gemini needs a key):

| API | Purpose | Key required |
|---|---|---|
| Google Gemini (vision) | Hazard image analysis | Yes — free tier |
| Open-Meteo Forecast | Current + forecast rainfall | No |
| Open-Meteo Elevation | Terrain grid sampling | No |
| Open-Meteo Geocoding | Address → coordinates | No |
| BigDataCloud | Coordinates → place name | No |
| OpenStreetMap tiles | Map basemap | No |

---

## Running locally

```bash
npm install
cp .env.example .env.local     # add your free GEMINI_API_KEY
npm run dev                    # http://localhost:3000
```

Get a free Gemini key at <https://aistudio.google.com/apikey> (no credit card).
Without it, the app still runs — the map, seed incidents, terrain model and risk
engine all work — but image analysis returns an honest configuration error
instead of fake results.

---

## Project structure

```
app/
  api/analyze-hazard/route.ts   server-only vision call; key never reaches client
  page.tsx · map/ · report/
components/
  PriorityMap · PriorityPanel · ReportForm · HazardIntelligence
  TerrainInsight · ChainAlert · RiskTimeline · RiskExplanation
  RiskTransformation
  RecommendedAction · ReportSourceBadge · HeroDashboard · Navbar
lib/
  terrain.ts          elevation sampling + D8 flow accumulation
  cascade.ts          hazard-chain graph + compounded risk
  riskEngine.ts       deterministic, explainable scoring
  hazardAnalysis.ts   client → server route (no local fallback)
  weather.ts · geocoding.ts · imageProcessing.ts · storage.ts
  recommendedAction.ts · hazardTypes.ts · demoData.ts
types/hazard.ts       single shared data model
```

---

## What we learned

The interesting problem here was not calling APIs — it was deciding what a risk
score is allowed to claim. Getting D8 flow routing right (diagonal distance
weighting, processing order for single-pass accumulation, handling local minima)
was the technical core. The harder discipline was refusing to let the system
imply escalation it could not justify from real forecast data.

## Next steps

- Downstream exposure counts (schools, hospitals) via OpenStreetMap Overpass
- Backtesting against historical rainfall for documented flood events

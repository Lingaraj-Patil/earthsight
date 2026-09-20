import { HazardReport, HazardTypeId } from "@/types/hazard";
import { calculateRisk, labelForScore, RISK_ENGINE_VERSION } from "@/lib/riskEngine";
import { analyzeTerrainGrid, GRID_SIZE } from "@/lib/terrain";

/**
 * Built-in SAMPLE INCIDENTS used to seed the map on first run, so the
 * priority map isn't empty immediately after installation.
 *
 * These are clearly flagged with isSeed: true throughout the data model
 * and UI, and are never presented as genuine community reports. Real user
 * submissions always get isSeed: false. Seed incidents are the only
 * records allowed to carry predefined coordinates/weather/analysis,
 * because they are explicitly synthetic demonstration data rather than
 * something a real pipeline run should ever produce.
 */

type SeedInput = {
  id: string;
  hazardCategoryId: HazardTypeId;
  hazardType: string;
  observedMaterial: string;
  severityScore: number;
  confidence: number;
  environmentalImpact: string;
  visibleIndicators: string[];
  reasoning: string;
  description: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  currentRainfall: number;
  forecastRainfall: number;
  rainProbability: number;
  rainfallHours: number | null;
  weatherDescription: string;
  daysAgo: number;
  /** Shape of the synthetic elevation grid for this sample incident.
   * "basin" = sits in a depression (water collects), "slope" = drains
   * away, "flat" = minimal relief. Seed terrain is synthetic because
   * these are explicitly sample incidents, but it is still run through
   * the real D8 flow-accumulation model in lib/terrain.ts. */
  terrainShape: "basin" | "slope" | "flat";
  baseElevation: number;
};

/**
 * Deterministic synthetic elevation grid for sample incidents. No
 * randomness: the same shape always produces the same grid, which then
 * goes through the same real hydrology model used for live reports.
 */
function syntheticElevationGrid(
  shape: "basin" | "slope" | "flat",
  base: number
): number[] {
  const half = Math.floor(GRID_SIZE / 2);
  const grid: number[] = [];

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const dRow = row - half;
      const dCol = col - half;
      const distance = Math.sqrt(dRow * dRow + dCol * dCol);
      let elevation = base;

      if (shape === "basin") {
        // Paraboloid depression centred on the hazard.
        elevation = base + Math.min(distance * distance * 0.09, 4.5);
      } else if (shape === "slope") {
        // Consistent gradient running north-west to south-east.
        elevation = base + (dRow + dCol) * 0.55;
      } else {
        // Gentle undulation only.
        elevation = base + Math.sin(dRow * 0.8) * 0.18 + Math.cos(dCol * 0.8) * 0.18;
      }

      grid.push(Math.round(elevation * 100) / 100);
    }
  }

  return grid;
}

const seeds: SeedInput[] = [
  {
    id: "seed-1",
    hazardCategoryId: "drainage-obstruction",
    hazardType: "Drainage Obstruction",
    observedMaterial: "Mixed plastic and construction debris",
    severityScore: 78,
    confidence: 91,
    environmentalImpact: "Localized flooding if drainage capacity is further reduced",
    visibleIndicators: ["Storm drain opening blocked", "Standing water nearby", "Visible plastic waste"],
    reasoning: "Sample incident illustrating a severe drainage blockage scenario.",
    description: "Storm drain along 80 Feet Road blocked by plastic and debris.",
    locationLabel: "80 Feet Road, Koramangala, Bengaluru",
    latitude: 12.9352,
    longitude: 77.6245,
    currentRainfall: 2.1,
    forecastRainfall: 18,
    rainProbability: 78,
    rainfallHours: 6,
    weatherDescription: "Partly cloudy, rain developing later",
    daysAgo: 0,
    terrainShape: "basin",
    baseElevation: 906,
  },
  {
    id: "seed-2",
    hazardCategoryId: "illegal-waste-dumping",
    hazardType: "Illegal Waste Dumping",
    observedMaterial: "Mixed household and industrial waste",
    severityScore: 74,
    confidence: 88,
    environmentalImpact: "Soil and groundwater contamination",
    visibleIndicators: ["Large unsorted waste pile", "Proximity to waterway", "Visible discoloration of soil"],
    reasoning: "Sample incident illustrating an unauthorized dump site near a lake.",
    description: "Large unauthorized dump site near Bellandur Lake service road.",
    locationLabel: "Bellandur Lake Road, Bengaluru",
    latitude: 12.9351,
    longitude: 77.6784,
    currentRainfall: 3.4,
    forecastRainfall: 9,
    rainProbability: 55,
    rainfallHours: 10,
    weatherDescription: "Overcast",
    daysAgo: 1,
    terrainShape: "flat",
    baseElevation: 896,
  },
  {
    id: "seed-3",
    hazardCategoryId: "plastic-accumulation",
    hazardType: "Plastic Accumulation",
    observedMaterial: "Single-use plastics and packaging",
    severityScore: 52,
    confidence: 82,
    environmentalImpact: "Waterway blockage and wildlife harm",
    visibleIndicators: ["Plastic bottles along shoreline", "Packaging debris in water"],
    reasoning: "Sample incident illustrating plastic buildup along a lake edge.",
    description: "Plastic waste accumulating along the northern bank of Ulsoor Lake.",
    locationLabel: "Ulsoor Lake, Bengaluru",
    latitude: 12.9815,
    longitude: 77.6205,
    currentRainfall: 0.6,
    forecastRainfall: 14,
    rainProbability: 66,
    rainfallHours: 14,
    weatherDescription: "Clear sky",
    daysAgo: 2,
    terrainShape: "basin",
    baseElevation: 913,
  },
  {
    id: "seed-4",
    hazardCategoryId: "blocked-runoff-channel",
    hazardType: "Blocked Runoff Channel",
    observedMaterial: "Sediment, debris and plastic waste",
    severityScore: 58,
    confidence: 85,
    environmentalImpact: "Street flooding and water overflow",
    visibleIndicators: ["Channel partially silted up", "Debris caught at channel mouth"],
    reasoning: "Sample incident illustrating a sediment-choked runoff channel.",
    description: "Runoff channel near ITPL Main Road choked with sediment and debris.",
    locationLabel: "ITPL Main Road, Whitefield, Bengaluru",
    latitude: 12.9698,
    longitude: 77.75,
    currentRainfall: 1.0,
    forecastRainfall: 16,
    rainProbability: 72,
    rainfallHours: 8,
    weatherDescription: "Partly cloudy",
    daysAgo: 1,
    terrainShape: "slope",
    baseElevation: 885,
  },
  // --- Hazard chain demo: three hazards on one Koramangala storm-drain
  // path, ~400m apart, descending 910m -> 906m -> 901m. seed-1 above is
  // the middle link. This is what the cascade analyzer detects as a
  // chain, where clearing order changes the outcome.
  {
    id: "seed-5",
    hazardCategoryId: "blocked-runoff-channel",
    hazardType: "Blocked Runoff Channel",
    observedMaterial: "Construction debris and silt",
    severityScore: 64,
    confidence: 86,
    environmentalImpact: "Street flooding and water overflow",
    visibleIndicators: ["Channel narrowed by debris", "Silt buildup at inlet"],
    reasoning: "Sample incident forming the upstream link of a drainage chain.",
    description: "Runoff channel narrowed by construction debris, 5th Block.",
    locationLabel: "5th Block, Koramangala, Bengaluru",
    latitude: 12.9378,
    longitude: 77.6218,
    currentRainfall: 2.1,
    forecastRainfall: 18,
    rainProbability: 78,
    rainfallHours: 6,
    weatherDescription: "Partly cloudy, rain developing later",
    daysAgo: 0,
    terrainShape: "slope",
    baseElevation: 910,
  },
  {
    id: "seed-6",
    hazardCategoryId: "waste-near-waterway",
    hazardType: "Waste Near Waterway",
    observedMaterial: "Mixed solid waste and plastic",
    severityScore: 71,
    confidence: 89,
    environmentalImpact: "Downstream water contamination",
    visibleIndicators: [
      "Waste piled at drain mouth",
      "Standing water",
      "Low-lying ground",
    ],
    reasoning:
      "Sample incident forming the downstream outlet of a drainage chain, where upstream water arrives.",
    description: "Waste accumulated at the storm drain outlet near the canal.",
    locationLabel: "Koramangala Storm Drain Outlet, Bengaluru",
    latitude: 12.933,
    longitude: 77.627,
    currentRainfall: 2.1,
    forecastRainfall: 18,
    rainProbability: 78,
    rainfallHours: 6,
    weatherDescription: "Partly cloudy, rain developing later",
    daysAgo: 0,
    terrainShape: "basin",
    baseElevation: 901,
  },
];

function buildHazard(seed: SeedInput): HazardReport {
  const analysis = {
    hazardType: seed.hazardType,
    observedMaterial: seed.observedMaterial,
    description: seed.reasoning,
    severityScore: seed.severityScore,
    severityLabel: labelForScore(seed.severityScore),
    confidence: seed.confidence,
    environmentalImpact: seed.environmentalImpact,
    visibleIndicators: seed.visibleIndicators,
    reasoning: seed.reasoning,
  };

  const createdAt = new Date(Date.now() - seed.daysAgo * 24 * 60 * 60 * 1000).toISOString();

  const weather = {
    currentRainfall: seed.currentRainfall,
    forecastRainfall: seed.forecastRainfall,
    rainProbability: seed.rainProbability,
    rainfallHours: seed.rainfallHours,
    weatherDescription: seed.weatherDescription,
    fetchedAt: createdAt,
    isFallback: true as const,
  };

  const terrain = {
    ...analyzeTerrainGrid(syntheticElevationGrid(seed.terrainShape, seed.baseElevation)),
    isFallback: true as const,
  };

  const risk = calculateRisk(analysis, weather, seed.hazardCategoryId, terrain);

  return {
    id: seed.id,
    createdAt,
    name: `${seed.hazardType} — Sample Incident`,
    type: seed.hazardType,
    description: seed.description,
    imageUrl: undefined,
    locationLabel: seed.locationLabel,
    latitude: seed.latitude,
    longitude: seed.longitude,
    locationSource: "seed",
    analysis,
    weather,
    terrain,
    provenance: {
      reportCreatedAt: createdAt,
      aiAnalyzedAt: createdAt,
      weatherFetchedAt: createdAt,
      terrainAnalyzedAt: createdAt,
      riskCalculatedAt: createdAt,
      riskEngineVersion: RISK_ENGINE_VERSION,
    },
    risk: {
      currentRisk: risk.currentRisk,
      projectedRisk: risk.projectedRisk,
      currentLabel: risk.currentLabel,
      projectedLabel: risk.projectedLabel,
      factors: risk.factors,
      weatherEscalation: risk.weatherEscalation,
    },
    isNew: false,
    isSeed: true,
  };
}

export const SEED_HAZARDS: HazardReport[] = seeds.map(buildHazard);

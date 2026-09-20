// Central shared types for EarthSight.
// Every part of the app (analysis, weather, risk engine, storage, UI)
// imports from here so there is exactly one source of truth.

export type RiskLabel = "Low" | "Moderate" | "High" | "Critical";

export type HazardTypeId =
  | "drainage-obstruction"
  | "illegal-waste-dumping"
  | "plastic-accumulation"
  | "blocked-runoff-channel"
  | "water-pollution"
  | "waste-near-waterway"
  | "flood-prone-obstruction"
  | "other";

export interface HazardTypeOption {
  id: HazardTypeId;
  label: string;
  /** How strongly rainfall should influence this hazard's risk. 0-1 */
  rainSensitivity: number;
}

/**
 * Structured output of the real vision-model hazard analysis
 * (see app/api/analyze-hazard/route.ts). Every field here is expected to
 * come from the model's actual reading of the uploaded photo — there is no
 * "isDemo" escape hatch: if analysis can't be performed for real, the
 * pipeline surfaces an error instead of producing a HazardAnalysis object.
 */
export type HazardAnalysis = {
  hazardType: string;
  observedMaterial: string;
  /** The model's own description of what it observed in the image. */
  description: string;
  /** 0-100 severity as assessed from the image alone (before weather). */
  severityScore: number;
  /** Label derived from severityScore using the shared risk thresholds. */
  severityLabel: RiskLabel;
  /** 0-100 model confidence in this assessment. */
  confidence: number;
  environmentalImpact: string;
  visibleIndicators: string[];
  reasoning: string;
};

/**
 * Locally-computed terrain hydrology for the hazard's exact coordinates.
 * Raw elevations come from the Open-Meteo Elevation API; every derived
 * value below (flow directions, catchment size, flood exposure) is
 * computed deterministically in lib/terrain.ts.
 */
export type TerrainAnalysis = {
  centerElevation: number; // m above sea level at the hazard
  depressionDepth: number; // m below surrounding mean (positive = in a dip)
  meanSlope: number; // degrees
  upslopeCells: number; // grid cells draining into the hazard
  upslopeFraction: number; // 0-1 share of sampled area draining in
  floodExposure: number; // 0-1 composite ponding/flood-accumulation score
  gridSize: number;
  cellSizeMeters: number;
  elevations: number[]; // row-major sampled grid, for visualization
  flowDirections: number[]; // D8 receiver index per cell, -1 = local minimum
  isFallback?: boolean;
};

export type WeatherData = {
  currentRainfall: number; // mm, current/recent rainfall
  forecastRainfall: number; // mm, upcoming rainfall total
  rainProbability: number; // 0-100
  rainfallHours: number | null; // hours until rain starts, null = not expected soon
  weatherDescription: string;
  temperatureC?: number;
  /** Real ISO timestamp of when this forecast was retrieved. Used to derive
   * an absolute rain-arrival time (fetchedAt + rainfallHours) for the
   * intervention-window countdown, and to disclose staleness. */
  fetchedAt: string;
  /** True when live weather data could not be fetched and fallback data was used. */
  isFallback?: boolean;
};

/** Which real contribution a RiskFactor represents. Lets downstream logic
 * (the intervention engine, the cascade planner) operate on the actual
 * semantics of a factor instead of parsing its display label, which
 * contains dynamic numbers and can't be matched reliably. */
export type RiskFactorKind =
  | "ai-severity"
  | "current-rainfall"
  | "terrain-exposure"
  | "terrain-unavailable"
  | "category-sensitivity"
  | "forecast-rainfall"
  | "rain-probability"
  | "timing-urgency"
  | "weather-minimal";

export type RiskFactor = {
  label: string;
  contribution: number; // signed points contributed to risk score
  explanation: string;
  kind: RiskFactorKind;
  /** Whether this factor fed into currentRisk or only into the
   * forecast-driven projectedRisk escalation. */
  phase: "current" | "projected";
};

export type RiskResult = {
  currentRisk: number;
  projectedRisk: number;
  currentLabel: RiskLabel;
  projectedLabel: RiskLabel;
  factors: RiskFactor[];
  /** Whether forecast rainfall is significant enough to justify calling the
   * current→projected gap "escalation". Computed from real forecast
   * rainfall/probability thresholds — never inferred from the score delta
   * alone, so a 1-2 point rounding bump from negligible rain is never
   * mislabeled as meaningful escalation. */
  weatherEscalation: "significant" | "minimal";
};

export type HazardReport = {
  id: string;
  createdAt: string;

  name: string;
  type: string;
  /** The reporter's own free-text description (distinct from analysis.description, which is the AI's observation). */
  description?: string;

  imageUrl?: string;

  locationLabel: string;
  latitude: number;
  longitude: number;
  /** How the coordinates were obtained. Never "default" for real reports. */
  locationSource: "gps" | "geocoded" | "seed";

  analysis: HazardAnalysis;
  weather: WeatherData;
  /** Null when the elevation service was unavailable at analysis time.
   * The risk engine then runs without a terrain term and discloses it. */
  terrain: TerrainAnalysis | null;

  /** Real timestamps for each real operation performed, so the UI can
   * disclose staleness rather than silently presenting an old snapshot as
   * current. Populated once at creation; weatherFetchedAt/riskCalculatedAt
   * are updated in place if the user explicitly refreshes (never silently). */
  provenance: {
    reportCreatedAt: string;
    aiAnalyzedAt: string;
    weatherFetchedAt: string;
    terrainAnalyzedAt: string | null;
    riskCalculatedAt: string;
    riskEngineVersion: string;
  };

  risk: {
    currentRisk: number;
    projectedRisk: number;
    currentLabel: RiskLabel;
    projectedLabel: RiskLabel;
    factors: RiskFactor[];
    weatherEscalation: "significant" | "minimal";
  };

  isNew?: boolean;
  /** True only for the small set of built-in sample incidents that ship
   * with the app so the map isn't empty on first load. Real citizen
   * reports must always have this set to false. */
  isSeed: boolean;
};

export type RiskMode = "current" | "projected";

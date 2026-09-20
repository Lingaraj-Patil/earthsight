import {
  HazardAnalysis,
  HazardTypeId,
  RiskFactor,
  RiskLabel,
  RiskResult,
  TerrainAnalysis,
  WeatherData,
} from "@/types/hazard";
import { getHazardTypeById } from "@/lib/hazardTypes";

/**
 * Explainable, deterministic risk engine.
 *
 * Every point added to a risk score is tracked as a RiskFactor with a
 * human-readable explanation, so the UI can always show "why did the risk
 * change?" without any hidden logic. There is no randomness anywhere in
 * this file — the same inputs always produce the same output.
 *
 * Inputs:
 *  - analysis: real output of the vision model, reflecting what is
 *    actually visible in the uploaded photo.
 *  - weather: real current/forecast data from Open-Meteo.
 *  - terrain: locally-computed hydrology (D8 flow accumulation over a real
 *    elevation grid). This is what makes two visually identical hazards
 *    score differently: one sitting in a local depression with a large
 *    upslope catchment is genuinely more dangerous in rain than one on a
 *    well-drained slope. May be null if the elevation service failed, in
 *    which case the terrain term is skipped and disclosed rather than
 *    guessed.
 *  - hazardCategoryId: the reporter's category selection, a
 *    controlled-vocabulary signal for baseline water sensitivity.
 */

export function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export const RISK_ENGINE_VERSION = "1.1.0-terrain-cascade";

export function labelForScore(score: number): RiskLabel {
  if (score >= 85) return "Critical";
  if (score >= 65) return "High";
  if (score >= 40) return "Moderate";
  return "Low";
}

// The AI's raw 0-100 visual severity score is scaled down before becoming
// the "base severity" contribution, leaving headroom for weather- and
// terrain-driven escalation to actually move the needle.
// Weights are chosen so that a realistic worst case lands in the low-to-mid
// 90s rather than saturating at 100. Saturation destroys differentiation:
// if several hazards all pin to 100, the priority ranking stops being
// informative, which is the whole point of the product.
//
//   base severity      0-55   (visual evidence, the largest single input)
//   terrain exposure   0-18   (the geospatial differentiator)
//   category bonus     0-5    (coarse prior, now mostly superseded by terrain)
//   current rainfall   open   (observed fact, usually small)
//   ---- forecast-driven escalation, only when forecast is meaningful ----
//   forecast rainfall  ~0-20
//   rain probability   0-12
//   timing urgency     0-12
const SEVERITY_BASE_WEIGHT = 0.55;
const TERRAIN_MAX_POINTS = 18;
const CATEGORY_BONUS_POINTS = 5;
const FORECAST_RAINFALL_WEIGHT = 0.8;
const RAIN_PROBABILITY_POINTS = 12;

// Below these thresholds, forecast rain is not meaningful enough to claim
// weather-driven escalation. This prevents rounding noise from a near-zero
// forecast (e.g. 0.3mm at 4% probability) from being displayed as if real
// escalation were happening.
const MEANINGFUL_RAINFALL_MM = 2;
const MEANINGFUL_PROBABILITY_PERCENT = 20;

function hasMeaningfulForecast(weather: WeatherData): boolean {
  return (
    weather.forecastRainfall >= MEANINGFUL_RAINFALL_MM ||
    weather.rainProbability >= MEANINGFUL_PROBABILITY_PERCENT
  );
}

/**
 * Terrain modulates the hazard category's baseline water sensitivity.
 * A floodExposure of 0.5 is neutral; below that terrain damps rainfall
 * impact (water drains away), above it terrain amplifies (water collects).
 * Bounded to 0.7x-1.4x so terrain refines the category signal rather than
 * overwhelming it.
 */
function terrainSensitivityMultiplier(terrain: TerrainAnalysis | null): number {
  if (!terrain) return 1;
  return 0.7 + terrain.floodExposure * 0.7;
}

export function calculateRisk(
  analysis: HazardAnalysis,
  weather: WeatherData,
  hazardCategoryId: HazardTypeId,
  terrain: TerrainAnalysis | null
): RiskResult {
  const hazardType = getHazardTypeById(hazardCategoryId);
  const categorySensitivity = hazardType.rainSensitivity; // 0-1
  const sensitivity = Math.min(
    1,
    categorySensitivity * terrainSensitivityMultiplier(terrain)
  );

  const factors: RiskFactor[] = [];

  // ---- CURRENT RISK ----
  const baseSeverity = clamp(analysis.severityScore * SEVERITY_BASE_WEIGHT);
  factors.push({
    label: `AI-assessed severity: ${analysis.severityLabel}`,
    contribution: baseSeverity,
    explanation: `The vision model rated this hazard's visible severity at ${analysis.severityScore}/100 from the uploaded photo (model confidence ${analysis.confidence}%).`,
    kind: "ai-severity",
    phase: "current",
  });

  // Current rainfall already on the ground is an observed fact (not a
  // forecast), so it always counts toward current risk.
  const currentRainContribution = Math.round(weather.currentRainfall * 1.5 * sensitivity);
  if (currentRainContribution > 0) {
    factors.push({
      label: `${weather.currentRainfall}mm of current rainfall`,
      contribution: currentRainContribution,
      explanation: `Rain already falling adds immediate pressure on this hazard, which is ${
        sensitivity >= 0.7 ? "highly" : sensitivity >= 0.45 ? "moderately" : "mildly"
      } sensitive to water here.`,
      kind: "current-rainfall",
      phase: "current",
    });
  }

  // Terrain contributes to current risk directly: a hazard sitting in a
  // depression with a large upslope catchment is already a bad location,
  // independent of what the forecast says.
  let terrainContribution = 0;
  if (terrain) {
    terrainContribution = Math.round(
      terrain.floodExposure * TERRAIN_MAX_POINTS * categorySensitivity
    );
    if (terrainContribution > 0) {
      const descriptors: string[] = [];
      if (terrain.depressionDepth >= 0.5) {
        descriptors.push(
          `sits ${terrain.depressionDepth.toFixed(1)}m below the surrounding ground`
        );
      }
      if (terrain.upslopeCells > 0) {
        descriptors.push(
          `${terrain.upslopeCells} of ${terrain.gridSize * terrain.gridSize - 1} sampled cells drain toward it`
        );
      }
      if (terrain.meanSlope < 3) {
        descriptors.push(`the ground is nearly flat (${terrain.meanSlope}° mean slope)`);
      }

      factors.push({
        label: "Terrain concentrates water at this location",
        contribution: terrainContribution,
        explanation: `Elevation analysis of a ${terrain.gridSize}x${terrain.gridSize} grid (${terrain.cellSizeMeters}m spacing) shows this point ${
          descriptors.length ? descriptors.join(", ") + "." : "has elevated flood-accumulation potential."
        } Flood exposure score: ${terrain.floodExposure.toFixed(2)}/1.00.`,
        kind: "terrain-exposure",
        phase: "current",
      });
    }
  } else {
    factors.push({
      label: "Terrain data unavailable",
      contribution: 0,
      explanation:
        "Elevation data could not be retrieved for this location, so terrain-based flood accumulation was excluded from this score.",
      kind: "terrain-unavailable",
      phase: "current",
    });
  }

  const sensitivityBonus = Math.round(categorySensitivity * CATEGORY_BONUS_POINTS);
  if (sensitivityBonus > 0) {
    factors.push({
      label: "Hazard category is water-sensitive",
      contribution: sensitivityBonus,
      explanation: `${hazardType.label} is a category that reacts strongly to water and drainage conditions.`,
      kind: "category-sensitivity",
      phase: "current",
    });
  }

  const currentRisk = clamp(
    baseSeverity + currentRainContribution + terrainContribution + sensitivityBonus
  );

  // ---- PROJECTED RISK ----
  const meaningfulForecast = hasMeaningfulForecast(weather);

  let forecastContribution = 0;
  let probabilityContribution = 0;
  let urgencyContribution = 0;

  if (meaningfulForecast) {
    forecastContribution = Math.round(
      weather.forecastRainfall * FORECAST_RAINFALL_WEIGHT * sensitivity
    );
    if (forecastContribution > 0) {
      factors.push({
        label: `${weather.forecastRainfall}mm rainfall forecast`,
        contribution: forecastContribution,
        explanation: terrain
          ? `Forecast rainfall of ${weather.forecastRainfall}mm, weighted by this location's terrain-adjusted water sensitivity (${sensitivity.toFixed(2)}).`
          : `Forecast rainfall of ${weather.forecastRainfall}mm could worsen this hazard given its water sensitivity.`,
        kind: "forecast-rainfall",
        phase: "projected",
      });
    }

    probabilityContribution = Math.round(
      (weather.rainProbability / 100) * RAIN_PROBABILITY_POINTS * sensitivity
    );
    if (probabilityContribution > 0) {
      factors.push({
        label: `${weather.rainProbability}% probability of rain`,
        contribution: probabilityContribution,
        explanation: `A ${weather.rainProbability}% chance of rain increases confidence that this hazard will be tested by water soon.`,
        kind: "rain-probability",
        phase: "projected",
      });
    }

    if (weather.rainfallHours !== null) {
      if (weather.rainfallHours <= 3) urgencyContribution = Math.round(12 * sensitivity);
      else if (weather.rainfallHours <= 6) urgencyContribution = Math.round(9 * sensitivity);
      else if (weather.rainfallHours <= 12) urgencyContribution = Math.round(5 * sensitivity);
      else urgencyContribution = Math.round(2 * sensitivity);

      if (urgencyContribution > 0) {
        factors.push({
          label: `Rain expected within ${weather.rainfallHours} hours`,
          contribution: urgencyContribution,
          explanation: `The closer the rainfall, the less time is available to intervene before conditions worsen.`,
          kind: "timing-urgency",
          phase: "projected",
        });
      }
    }
  } else {
    factors.push({
      label: "Weather-driven escalation is currently minimal",
      contribution: 0,
      explanation: `Forecast rainfall is ${weather.forecastRainfall}mm with a ${weather.rainProbability}% probability of rain — too low to meaningfully increase this hazard's risk right now.`,
      kind: "weather-minimal",
      phase: "projected",
    });
  }

  const projectedRiskRaw =
    currentRisk + forecastContribution + probabilityContribution + urgencyContribution;
  const projectedRisk = clamp(Math.max(projectedRiskRaw, currentRisk));

  return {
    currentRisk,
    projectedRisk,
    currentLabel: labelForScore(currentRisk),
    projectedLabel: labelForScore(projectedRisk),
    factors,
    weatherEscalation: meaningfulForecast ? "significant" : "minimal",
  };
}

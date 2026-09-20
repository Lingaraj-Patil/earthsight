import { TerrainAnalysis } from "@/types/hazard";

/**
 * Terrain-aware flood exposure analysis.
 *
 * This is the piece that makes EarthSight's risk model geospatial rather
 * than a lookup table. Instead of assuming every "drainage obstruction"
 * behaves identically, we sample real elevation data around the hazard's
 * exact coordinates and compute how water actually moves there.
 *
 * Pipeline:
 *   1. Sample an N x N grid of real elevations around the hazard
 *      (Open-Meteo Elevation API — free, no key, up to 100 points/call).
 *   2. Compute D8 flow direction: for every cell, which of its 8
 *      neighbours is the steepest downhill step. This is the standard
 *      single-flow-direction routing used in GIS hydrology.
 *   3. Compute flow accumulation by processing cells from highest to
 *      lowest and pushing each cell's accumulated count into its
 *      receiver. The value at the centre cell is the size of the upslope
 *      catchment draining toward the hazard.
 *   4. Derive a 0-1 floodExposure score from depression depth, catchment
 *      size, and local flatness.
 *
 * Only the raw elevations come from the network. All hydrology below is
 * computed locally and deterministically — the same coordinates always
 * produce the same terrain analysis.
 *
 * If the elevation API is unreachable, this returns null. The risk engine
 * then runs without a terrain term and says so explicitly, rather than
 * substituting invented terrain values.
 */

const ELEVATION_API = "https://api.open-meteo.com/v1/elevation";

/** 9x9 = 81 sample points, within the API's 100-coordinate limit. */
export const GRID_SIZE = 9;
/** Spacing between samples. 9 x 60m ≈ a 480m square around the hazard,
 * which is the scale at which street-level ponding is decided. */
export const CELL_SIZE_METERS = 60;

const METERS_PER_DEG_LAT = 111_320;

/** Builds the lat/lng sample grid, row-major, north-to-south. */
function buildGrid(latitude: number, longitude: number) {
  const half = Math.floor(GRID_SIZE / 2);
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos((latitude * Math.PI) / 180);

  const lats: number[] = [];
  const lngs: number[] = [];

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const northOffset = (half - row) * CELL_SIZE_METERS;
      const eastOffset = (col - half) * CELL_SIZE_METERS;
      lats.push(latitude + northOffset / METERS_PER_DEG_LAT);
      lngs.push(longitude + eastOffset / Math.max(metersPerDegLng, 1));
    }
  }

  return { lats, lngs };
}

/** D8 neighbour offsets: E, SE, S, SW, W, NW, N, NE. */
const D8: Array<[number, number]> = [
  [0, 1],
  [1, 1],
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, -1],
  [-1, 0],
  [-1, 1],
];

function index(row: number, col: number): number {
  return row * GRID_SIZE + col;
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE;
}

/**
 * For each cell, find the steepest-descent neighbour (its "receiver").
 * Distance is accounted for so diagonal steps aren't unfairly favoured:
 * slope = drop / horizontal distance.
 * Returns -1 for cells that are local minima (no lower neighbour).
 */
export function computeFlowDirections(elevations: number[]): number[] {
  const receivers = new Array<number>(elevations.length).fill(-1);

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const i = index(row, col);
      let steepestSlope = 0;
      let receiver = -1;

      for (const [dRow, dCol] of D8) {
        const nRow = row + dRow;
        const nCol = col + dCol;
        if (!inBounds(nRow, nCol)) continue;

        const j = index(nRow, nCol);
        const drop = elevations[i] - elevations[j];
        if (drop <= 0) continue;

        const distance =
          (dRow !== 0 && dCol !== 0 ? Math.SQRT2 : 1) * CELL_SIZE_METERS;
        const slope = drop / distance;

        if (slope > steepestSlope) {
          steepestSlope = slope;
          receiver = j;
        }
      }

      receivers[i] = receiver;
    }
  }

  return receivers;
}

/**
 * Flow accumulation. Each cell contributes itself plus everything that
 * drains through it. Processing cells from highest to lowest guarantees
 * a cell is finalised before its receiver consumes it, so a single pass
 * is sufficient and no recursion or cycle handling is needed.
 */
export function computeFlowAccumulation(
  elevations: number[],
  receivers: number[]
): number[] {
  const accumulation = new Array<number>(elevations.length).fill(1);

  const order = elevations
    .map((elevation, i) => ({ elevation, i }))
    .sort((a, b) => b.elevation - a.elevation);

  for (const { i } of order) {
    const receiver = receivers[i];
    if (receiver >= 0) {
      accumulation[receiver] += accumulation[i];
    }
  }

  return accumulation;
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Mean local slope across the grid, in degrees. */
function computeMeanSlope(elevations: number[]): number {
  const slopes: number[] = [];

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const i = index(row, col);
      for (const [dRow, dCol] of D8) {
        const nRow = row + dRow;
        const nCol = col + dCol;
        if (!inBounds(nRow, nCol)) continue;
        const j = index(nRow, nCol);
        const distance =
          (dRow !== 0 && dCol !== 0 ? Math.SQRT2 : 1) * CELL_SIZE_METERS;
        slopes.push(Math.abs(elevations[i] - elevations[j]) / distance);
      }
    }
  }

  return (Math.atan(mean(slopes)) * 180) / Math.PI;
}

// --- Flood exposure weighting -------------------------------------------
// These three signals are combined into one 0-1 score. The weights favour
// depression depth because a hazard sitting in a local low point is the
// single strongest predictor of standing water, followed by how much
// upslope area drains into it, with flatness as a secondary modifier
// (steep ground sheds water instead of ponding).
const DEPRESSION_WEIGHT = 0.45;
const CATCHMENT_WEIGHT = 0.35;
const FLATNESS_WEIGHT = 0.2;

/** A 5m local depression is treated as maximally bad at this grid scale. */
const MAX_MEANINGFUL_DEPRESSION_M = 5;
/** Draining 30% of the sampled area into one cell is treated as maximal. */
const MAX_MEANINGFUL_CATCHMENT_FRACTION = 0.3;
/** At 10 degrees of mean slope, ponding potential is treated as zero. */
const MAX_MEANINGFUL_SLOPE_DEG = 10;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function analyzeTerrainGrid(elevations: number[]): Omit<TerrainAnalysis, "isFallback"> {
  const centerIndex = index(Math.floor(GRID_SIZE / 2), Math.floor(GRID_SIZE / 2));
  const centerElevation = elevations[centerIndex];

  const surrounding = elevations.filter((_, i) => i !== centerIndex);
  const depressionDepth = mean(surrounding) - centerElevation;

  const receivers = computeFlowDirections(elevations);
  const accumulation = computeFlowAccumulation(elevations, receivers);
  const upslopeCells = accumulation[centerIndex] - 1;
  const upslopeFraction = upslopeCells / (elevations.length - 1);

  const meanSlope = computeMeanSlope(elevations);

  const depressionScore = clamp01(depressionDepth / MAX_MEANINGFUL_DEPRESSION_M);
  const catchmentScore = clamp01(upslopeFraction / MAX_MEANINGFUL_CATCHMENT_FRACTION);
  const flatnessScore = clamp01(1 - meanSlope / MAX_MEANINGFUL_SLOPE_DEG);

  const floodExposure = clamp01(
    DEPRESSION_WEIGHT * depressionScore +
      CATCHMENT_WEIGHT * catchmentScore +
      FLATNESS_WEIGHT * flatnessScore
  );

  return {
    centerElevation: Math.round(centerElevation * 10) / 10,
    depressionDepth: Math.round(depressionDepth * 10) / 10,
    meanSlope: Math.round(meanSlope * 10) / 10,
    upslopeCells,
    upslopeFraction: Math.round(upslopeFraction * 1000) / 1000,
    floodExposure: Math.round(floodExposure * 100) / 100,
    gridSize: GRID_SIZE,
    cellSizeMeters: CELL_SIZE_METERS,
    elevations: elevations.map((e) => Math.round(e * 10) / 10),
    flowDirections: receivers,
  };
}

/**
 * Fetches real elevations and runs the hydrology model.
 * Returns null (never invented data) if the elevation service fails.
 */
export async function analyzeTerrain(
  latitude: number,
  longitude: number
): Promise<TerrainAnalysis | null> {
  try {
    const { lats, lngs } = buildGrid(latitude, longitude);

    const params = new URLSearchParams({
      latitude: lats.map((v) => v.toFixed(5)).join(","),
      longitude: lngs.map((v) => v.toFixed(5)).join(","),
    });

    const response = await fetch(`${ELEVATION_API}?${params.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;

    const data = await response.json();
    const elevations: unknown = data?.elevation;

    if (
      !Array.isArray(elevations) ||
      elevations.length !== GRID_SIZE * GRID_SIZE ||
      elevations.some((e) => typeof e !== "number" || Number.isNaN(e))
    ) {
      return null;
    }

    return { ...analyzeTerrainGrid(elevations as number[]), isFallback: false };
  } catch {
    return null;
  }
}

import { HazardReport } from "@/types/hazard";

/**
 * Hydrological hazard-chain analysis.
 *
 * A single blocked drain is a local problem. Three blocked drains along
 * the same downhill drainage path are a system failure: when the upslope
 * one overflows, its water arrives at the next one, which is already
 * blocked. Municipal crews that clear them in the wrong order waste the
 * intervention.
 *
 * This module finds those chains. For every pair of hazards it asks:
 * does water plausibly flow from A to B? That requires three things to
 * be true simultaneously:
 *
 *   1. They are close enough to share a drainage path (<= LINK_RADIUS_M).
 *   2. A is meaningfully higher than B (>= MIN_DROP_M), so water moves
 *      in that direction.
 *   3. The gradient between them is steep enough to actually route water
 *      rather than pond in place (>= MIN_GRADIENT).
 *
 * Connected components of the resulting directed graph are "chains".
 * Chains are then scored: a hazard with blocked hazards upstream of it
 * carries compounded risk, because it will receive their displaced water
 * on top of its own catchment.
 *
 * Everything here is deterministic and computed locally from terrain data
 * already attached to each report. No network calls, no randomness.
 */

/** Maximum separation for two hazards to be considered hydrologically linked. */
const LINK_RADIUS_M = 1200;
/** Minimum elevation drop for a directed link. Below this, GPS/DEM noise
 * dominates and the direction of flow isn't trustworthy. */
const MIN_DROP_M = 1.5;
/** Minimum gradient (rise/run). Very flat pairs pond rather than route. */
const MIN_GRADIENT = 0.002;
/** Per-upstream-hazard risk amplification, capped below. */
export const AMPLIFICATION_PER_UPSTREAM = 4;
export const MAX_AMPLIFICATION = 12;

export type HazardLink = {
  fromId: string;
  toId: string;
  distanceMeters: number;
  dropMeters: number;
  gradient: number;
};

export type HazardChain = {
  id: string;
  memberIds: string[];
  /** Ordered most-upstream to most-downstream. */
  orderedIds: string[];
  /** The downstream-most member, where compounded water arrives. */
  outletId: string;
  /** Highest projected risk within the chain. */
  peakProjectedRisk: number;
};

export type HazardNetwork = {
  links: HazardLink[];
  chains: HazardChain[];
  /** Per-hazard derived values, keyed by hazard id. */
  nodes: Record<
    string,
    {
      chainId: string | null;
      upstreamCount: number;
      downstreamCount: number;
      /** Extra risk points from upstream blockages draining toward it. */
      amplification: number;
      /** Risk after compounding, clamped to 100. */
      compoundedProjectedRisk: number;
    }
  >;
};

const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Iterative DFS over an adjacency map; avoids recursion depth concerns
 * and keeps traversal order deterministic. */
function collectComponent(
  startId: string,
  undirected: Map<string, Set<string>>,
  seen: Set<string>
): string[] {
  const component: string[] = [];
  const stack = [startId];

  while (stack.length) {
    const id = stack.pop() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    component.push(id);

    const neighbours = undirected.get(id);
    if (!neighbours) continue;
    // Sort for deterministic traversal regardless of insertion order.
    for (const n of [...neighbours].sort()) {
      if (!seen.has(n)) stack.push(n);
    }
  }

  return component.sort();
}

export function buildHazardNetwork(hazards: HazardReport[]): HazardNetwork {
  // Only hazards with real terrain data can be placed in a flow network.
  // Checked with a proper type guard (not `!== null`) because a report
  // loaded from localStorage that predates the `terrain` field existing
  // in the schema has it as `undefined`, not `null` — `undefined !== null`
  // is true, so that check alone would silently let malformed records
  // through and crash on the `!` assertion below.
  const placed = hazards
    .filter((h): h is HazardReport & { terrain: NonNullable<HazardReport["terrain"]> } =>
      h.terrain !== null && h.terrain !== undefined
    )
    .sort((a, b) => a.id.localeCompare(b.id));

  const links: HazardLink[] = [];

  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i];
      const b = placed[j];

      const distance = haversineMeters(
        a.latitude,
        a.longitude,
        b.latitude,
        b.longitude
      );
      if (distance > LINK_RADIUS_M || distance === 0) continue;

      const elevA = a.terrain.centerElevation;
      const elevB = b.terrain.centerElevation;
      const drop = Math.abs(elevA - elevB);
      if (drop < MIN_DROP_M) continue;

      const gradient = drop / distance;
      if (gradient < MIN_GRADIENT) continue;

      const [upstream, downstream] = elevA > elevB ? [a, b] : [b, a];
      links.push({
        fromId: upstream.id,
        toId: downstream.id,
        distanceMeters: Math.round(distance),
        dropMeters: Math.round(drop * 10) / 10,
        gradient: Math.round(gradient * 10000) / 10000,
      });
    }
  }

  // Build adjacency structures.
  const downstreamOf = new Map<string, Set<string>>();
  const upstreamOf = new Map<string, Set<string>>();
  const undirected = new Map<string, Set<string>>();

  for (const link of links) {
    if (!downstreamOf.has(link.fromId)) downstreamOf.set(link.fromId, new Set());
    downstreamOf.get(link.fromId)!.add(link.toId);

    if (!upstreamOf.has(link.toId)) upstreamOf.set(link.toId, new Set());
    upstreamOf.get(link.toId)!.add(link.fromId);

    if (!undirected.has(link.fromId)) undirected.set(link.fromId, new Set());
    if (!undirected.has(link.toId)) undirected.set(link.toId, new Set());
    undirected.get(link.fromId)!.add(link.toId);
    undirected.get(link.toId)!.add(link.fromId);
  }

  // Connected components = chains (only those with 2+ members matter).
  const seen = new Set<string>();
  const chains: HazardChain[] = [];
  const byId = new Map(placed.map((h) => [h.id, h]));

  for (const hazard of placed) {
    if (seen.has(hazard.id)) continue;
    if (!undirected.has(hazard.id)) continue;

    const memberIds = collectComponent(hazard.id, undirected, seen);
    if (memberIds.length < 2) continue;

    // Order upstream → downstream by elevation.
    const orderedIds = [...memberIds].sort(
      (x, y) =>
        (byId.get(y)!.terrain.centerElevation ?? 0) -
        (byId.get(x)!.terrain.centerElevation ?? 0)
    );

    chains.push({
      id: `chain-${memberIds[0]}`,
      memberIds,
      orderedIds,
      outletId: orderedIds[orderedIds.length - 1],
      peakProjectedRisk: Math.max(
        ...memberIds.map((id) => byId.get(id)!.risk.projectedRisk)
      ),
    });
  }

  chains.sort((a, b) => b.peakProjectedRisk - a.peakProjectedRisk);

  // Per-node derived values. Iterate in sorted id order so the resulting
  // object is canonical regardless of the order hazards arrived in.
  const nodes: HazardNetwork["nodes"] = {};
  const chainOf = new Map<string, string>();
  for (const chain of chains) {
    for (const id of chain.memberIds) chainOf.set(id, chain.id);
  }

  const sortedHazards = [...hazards].sort((a, b) => a.id.localeCompare(b.id));

  for (const hazard of sortedHazards) {
    const upstreamCount = upstreamOf.get(hazard.id)?.size ?? 0;
    const downstreamCount = downstreamOf.get(hazard.id)?.size ?? 0;

    const amplification = Math.min(
      upstreamCount * AMPLIFICATION_PER_UPSTREAM,
      MAX_AMPLIFICATION
    );

    nodes[hazard.id] = {
      chainId: chainOf.get(hazard.id) ?? null,
      upstreamCount,
      downstreamCount,
      amplification,
      compoundedProjectedRisk: Math.min(
        100,
        hazard.risk.projectedRisk + amplification
      ),
    };
  }

  return { links, chains, nodes };
}

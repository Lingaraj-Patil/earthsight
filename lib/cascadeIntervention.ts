import { HazardChain, HazardNetwork, AMPLIFICATION_PER_UPSTREAM, MAX_AMPLIFICATION } from "@/lib/cascade";
import { HazardReport, RiskLabel } from "@/types/hazard";
import { getHazardTypeIdFromLabel } from "@/lib/hazardTypes";
import { interventionsForHazard, simulateIntervention } from "@/lib/interventionEngine";
import { labelForScore, clamp } from "@/lib/riskEngine";

/**
 * Cascade Intervention Planning.
 *
 * Given a detected hazard chain, computes what the OUTLET's compounded risk
 * would be under four scenarios. This is not a "best decision" opinion —
 * it's four deterministic recalculations of the same real formula
 * lib/cascade.ts already uses for compounding (+4 per upstream blockage,
 * capped at +12), combined with the real per-hazard intervention
 * simulation from lib/interventionEngine.ts.
 *
 * A scenario is marked unsimulatable (rather than silently skipped or
 * filled with a guess) when the relevant hazard's category has no defined
 * intervention.
 */

export type CascadeScenarioId =
  | "do-nothing"
  | "clear-downstream"
  | "clear-all-upstream"
  | "clear-critical-upstream";

export type CascadeScenario = {
  id: CascadeScenarioId;
  label: string;
  description: string;
  simulatable: boolean;
  note?: string;
  projectedOutletRisk: number;
  projectedOutletLabel: RiskLabel;
  riskReduction: number;
};

function amplificationFor(upstreamCount: number): number {
  return Math.min(upstreamCount * AMPLIFICATION_PER_UPSTREAM, MAX_AMPLIFICATION);
}

export function planCascadeInterventions(
  chain: HazardChain,
  network: HazardNetwork,
  hazards: HazardReport[]
): CascadeScenario[] {
  const byId = new Map(hazards.map((h) => [h.id, h]));
  const outlet = byId.get(chain.outletId);
  if (!outlet) return [];

  const upstreamIds = network.links
    .filter((l) => l.toId === chain.outletId)
    .map((l) => l.fromId);

  const baseline = outlet.risk.projectedRisk;
  const baseAmplification = network.nodes[chain.outletId]?.amplification ?? 0;
  const doNothingRisk = clamp(baseline + baseAmplification);

  const scenarios: CascadeScenario[] = [
    {
      id: "do-nothing",
      label: "Do nothing",
      description: "No intervention. Water from upstream blockages continues to arrive here.",
      simulatable: true,
      projectedOutletRisk: doNothingRisk,
      projectedOutletLabel: labelForScore(doNothingRisk),
      riskReduction: 0,
    },
  ];

  const outletCategory = getHazardTypeIdFromLabel(outlet.type);
  const outletOptions = interventionsForHazard(outletCategory);
  if (outletOptions.length > 0) {
    const sim = simulateIntervention(outlet, outletOptions[0].id)!;
    const withAmplification = clamp(sim.simulatedProjectedRisk + baseAmplification);
    scenarios.push({
      id: "clear-downstream",
      label: `Clear downstream (${outlet.analysis.hazardType})`,
      description: `Apply "${outletOptions[0].name}" to the outlet only. Upstream blockages remain.`,
      simulatable: true,
      projectedOutletRisk: withAmplification,
      projectedOutletLabel: labelForScore(withAmplification),
      riskReduction: doNothingRisk - withAmplification,
    });
  } else {
    scenarios.push({
      id: "clear-downstream",
      label: `Clear downstream (${outlet.analysis.hazardType})`,
      simulatable: false,
      note: "No deterministic intervention is defined for this hazard's category.",
      description: "",
      projectedOutletRisk: doNothingRisk,
      projectedOutletLabel: labelForScore(doNothingRisk),
      riskReduction: 0,
    });
  }

  const allUpstreamRisk = clamp(baseline + amplificationFor(0));
  scenarios.push({
    id: "clear-all-upstream",
    label: `Clear all upstream (${upstreamIds.length})`,
    description: "Clear every hazard upstream of the outlet. The outlet itself is untouched.",
    simulatable: true,
    projectedOutletRisk: allUpstreamRisk,
    projectedOutletLabel: labelForScore(allUpstreamRisk),
    riskReduction: doNothingRisk - allUpstreamRisk,
  });

  const upstreamHazards = upstreamIds
    .map((id) => byId.get(id))
    .filter((h): h is HazardReport => !!h);

  if (upstreamHazards.length > 0) {
    const mostCritical = [...upstreamHazards].sort(
      (a, b) => b.risk.projectedRisk - a.risk.projectedRisk
    )[0];
    const newAmplification = amplificationFor(Math.max(0, upstreamIds.length - 1));
    const criticalRisk = clamp(baseline + newAmplification);
    scenarios.push({
      id: "clear-critical-upstream",
      label: `Clear most critical upstream (${mostCritical.analysis.hazardType})`,
      description: `Clear only ${mostCritical.locationLabel} (projected risk ${mostCritical.risk.projectedRisk}), the highest-risk hazard upstream of the outlet.`,
      simulatable: true,
      projectedOutletRisk: criticalRisk,
      projectedOutletLabel: labelForScore(criticalRisk),
      riskReduction: doNothingRisk - criticalRisk,
    });
  }

  return scenarios;
}

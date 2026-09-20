import { HazardReport, HazardTypeId, RiskFactorKind, RiskLabel } from "@/types/hazard";
import { clamp, labelForScore } from "@/lib/riskEngine";

/**
 * Intervention Intelligence: "what happens if we act?"
 *
 * This does NOT subtract a hardcoded number from the final score. It
 * re-runs the actual clamp/combine logic the risk engine uses, but with
 * specific real RiskFactor contributions reduced — the same factors
 * already computed and displayed in "Why did the risk change?". If an
 * intervention isn't present in the report's real factor list (e.g. the
 * hazard has no terrain-exposure factor because elevation data was
 * unavailable), it simply has nothing to reduce there — the simulation
 * never invents a factor that wasn't real.
 *
 * Each intervention definition is scoped to the hazard categories it
 * genuinely applies to. Categories with no defined intervention (the
 * catch-all "other") intentionally have none — we do not invent
 * interventions for hazard types we haven't modeled.
 */

export type InterventionId =
  | "clear-obstruction"
  | "remove-waste"
  | "restrict-exposure";

export type InterventionDefinition = {
  id: InterventionId;
  name: string;
  description: string;
  applicableHazards: HazardTypeId[];
  /** Deterministic reduction fraction (0-1) applied to each matched factor
   * kind's contribution. Two tiers: how much this action addresses the
   * hazard's own visible severity vs. how much it addresses its
   * interaction with water (current rain, terrain, forecast, etc). */
  severityReduction: number;
  waterInteractionReduction: number;
  targetKinds: RiskFactorKind[];
  /** Human-readable real-world variability range, for display only — the
   * simulation itself always uses the fixed fractions above so results are
   * reproducible. */
  effectivenessRangeLabel: string;
};

const WATER_INTERACTION_KINDS: RiskFactorKind[] = [
  "current-rainfall",
  "terrain-exposure",
  "category-sensitivity",
  "forecast-rainfall",
  "rain-probability",
  "timing-urgency",
];

export const INTERVENTIONS: InterventionDefinition[] = [
  {
    id: "clear-obstruction",
    name: "Clear the obstruction",
    description:
      "Physically remove the blockage and restore the drainage path (inlet, channel, or culvert).",
    applicableHazards: [
      "drainage-obstruction",
      "blocked-runoff-channel",
      "flood-prone-obstruction",
    ],
    severityReduction: 0.7,
    waterInteractionReduction: 0.9,
    targetKinds: ["ai-severity", ...WATER_INTERACTION_KINDS],
    effectivenessRangeLabel: "typically 70-90% of water-response risk",
  },
  {
    id: "remove-waste",
    name: "Remove and isolate the waste",
    description:
      "Physically remove accumulated material and isolate any hazardous fraction before it reaches drainage.",
    applicableHazards: ["illegal-waste-dumping", "plastic-accumulation", "waste-near-waterway"],
    severityReduction: 0.6,
    waterInteractionReduction: 0.5,
    targetKinds: ["ai-severity", ...WATER_INTERACTION_KINDS],
    effectivenessRangeLabel: "typically 40-60% of water-response risk",
  },
  {
    id: "restrict-exposure",
    name: "Restrict exposure and stop discharge",
    description:
      "Contain the contamination source and prevent further discharge from entering runoff.",
    applicableHazards: ["water-pollution"],
    severityReduction: 0.3,
    waterInteractionReduction: 0.7,
    targetKinds: ["ai-severity", ...WATER_INTERACTION_KINDS],
    effectivenessRangeLabel: "typically 60-80% of water-response risk",
  },
];

export function interventionsForHazard(hazardCategoryId: HazardTypeId): InterventionDefinition[] {
  return INTERVENTIONS.filter((i) => i.applicableHazards.includes(hazardCategoryId));
}

export type InterventionFactorImpact = {
  label: string;
  kind: RiskFactorKind;
  originalContribution: number;
  reducedContribution: number;
  pointsSaved: number;
};

export type InterventionSimulation = {
  intervention: InterventionDefinition;
  simulatedCurrentRisk: number;
  simulatedProjectedRisk: number;
  simulatedCurrentLabel: RiskLabel;
  simulatedProjectedLabel: RiskLabel;
  currentRiskReduction: number;
  projectedRiskReduction: number;
  affectedFactors: InterventionFactorImpact[];
  explanation: string;
};

/**
 * Re-derives current/projected risk with this intervention's reductions
 * applied to the report's real factors, using the same clamp(sum) and
 * clamp(max(current+projectedDelta, current)) logic the risk engine uses.
 */
export function simulateIntervention(
  report: HazardReport,
  interventionId: InterventionId
): InterventionSimulation | null {
  const intervention = INTERVENTIONS.find((i) => i.id === interventionId);
  if (!intervention) return null;

  const affectedFactors: InterventionFactorImpact[] = [];

  let simulatedCurrentRisk = 0;
  let projectedDelta = 0;

  for (const factor of report.risk.factors) {
    const isTargeted = intervention.targetKinds.includes(factor.kind);
    const reduction = factor.kind === "ai-severity"
      ? intervention.severityReduction
      : intervention.waterInteractionReduction;

    const reducedContribution = isTargeted
      ? Math.round(factor.contribution * (1 - reduction))
      : factor.contribution;

    if (isTargeted && factor.contribution !== reducedContribution) {
      affectedFactors.push({
        label: factor.label,
        kind: factor.kind,
        originalContribution: factor.contribution,
        reducedContribution,
        pointsSaved: factor.contribution - reducedContribution,
      });
    }

    if (factor.phase === "current") {
      simulatedCurrentRisk += reducedContribution;
    } else {
      projectedDelta += reducedContribution;
    }
  }

  simulatedCurrentRisk = clamp(simulatedCurrentRisk);
  const simulatedProjectedRisk = clamp(
    Math.max(simulatedCurrentRisk + projectedDelta, simulatedCurrentRisk)
  );

  const totalSaved = affectedFactors.reduce((sum, f) => sum + f.pointsSaved, 0);
  const topFactors = [...affectedFactors]
    .sort((a, b) => b.pointsSaved - a.pointsSaved)
    .slice(0, 2)
    .map((f) => f.label)
    .join(" and ");

  const explanation = affectedFactors.length
    ? `${intervention.name} reduces ${affectedFactors.length} real risk factor${
        affectedFactors.length === 1 ? "" : "s"
      } (mainly ${topFactors || "the hazard's water-response contribution"}), saving ${totalSaved} point${
        totalSaved === 1 ? "" : "s"
      } total across current and projected risk (${intervention.effectivenessRangeLabel}).`
    : `${intervention.name} did not match any factor currently contributing to this hazard's score, so it would not measurably change the risk here.`;

  return {
    intervention,
    simulatedCurrentRisk,
    simulatedProjectedRisk,
    simulatedCurrentLabel: labelForScore(simulatedCurrentRisk),
    simulatedProjectedLabel: labelForScore(simulatedProjectedRisk),
    currentRiskReduction: report.risk.currentRisk - simulatedCurrentRisk,
    projectedRiskReduction: report.risk.projectedRisk - simulatedProjectedRisk,
    affectedFactors,
    explanation,
  };
}

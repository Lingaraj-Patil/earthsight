import { HazardTypeId, RiskResult } from "@/types/hazard";
import { getHazardTypeIdFromLabel } from "@/lib/hazardTypes";

/**
 * Deterministic recommended-action text, keyed by the reporter's chosen
 * hazard category (a controlled vocabulary) and whether the risk engine
 * found significant weather-driven escalation. This is not AI-generated
 * and not random — the same category + risk state always produces the
 * same recommendation, and the urgency framing only changes when the real
 * risk engine says weather escalation is significant.
 */

const ACTIONS: Record<HazardTypeId, { normal: string; urgent: string }> = {
  "drainage-obstruction": {
    normal: "Clear the drainage obstruction to restore normal flow capacity.",
    urgent:
      "Clear this drainage obstruction before the forecast rainfall arrives — blocked drains are likely to overflow.",
  },
  "illegal-waste-dumping": {
    normal: "Report to local waste management authorities for removal and site cleanup.",
    urgent:
      "Flag for urgent removal — forecast rainfall increases the risk of contaminated runoff spreading from this site.",
  },
  "plastic-accumulation": {
    normal: "Schedule cleanup to prevent further accumulation and waterway blockage.",
    urgent:
      "Remove plastic waste before forecast rainfall increases the risk of it washing into nearby waterways.",
  },
  "blocked-runoff-channel": {
    normal: "Clear sediment and debris from the runoff channel to restore its capacity.",
    urgent:
      "Clear this runoff channel before the forecast rainfall arrives to prevent street flooding.",
  },
  "water-pollution": {
    normal: "Prevent further discharge at the source and flag the site for inspection.",
    urgent:
      "Prevent further discharge immediately and notify environmental authorities — forecast rainfall could spread contamination.",
  },
  "waste-near-waterway": {
    normal: "Remove or isolate the waste before it can reach the waterway.",
    urgent:
      "Remove or isolate this waste before forecast rainfall causes runoff directly into the waterway.",
  },
  "flood-prone-obstruction": {
    normal: "Clear the obstruction to reduce flash-flood risk in this area.",
    urgent:
      "Clear this obstruction before the forecast rainfall arrives — this location is known to be flood-prone.",
  },
  other: {
    normal: "Flag for inspection by local environmental or municipal authorities.",
    urgent:
      "Flag for urgent inspection — forecast rainfall may worsen conditions at this site.",
  },
};

export function getRecommendedAction(hazardCategoryLabel: string, risk: RiskResult): string {
  const id = getHazardTypeIdFromLabel(hazardCategoryLabel);
  const entry = ACTIONS[id];

  const urgent =
    risk.weatherEscalation === "significant" &&
    (risk.projectedLabel === "High" || risk.projectedLabel === "Critical");

  return urgent ? entry.urgent : entry.normal;
}

import { HazardNetwork } from "@/lib/cascade";
import { HazardReport } from "@/types/hazard";

/**
 * Action Priority: a transparent alternative sort key to raw risk score.
 * Every point is named — this is deliberately NOT a black-box number.
 * Combines four real, already-computed signals:
 *
 *   projected risk label   0-3 points  (Low..Critical)
 *   rainfall urgency       0-2 points  (only if escalation is significant)
 *   AI confidence          0-1 point   (low confidence subtracts, not adds)
 *   cascade involvement    0-2 points  (part of a chain, more if upstream)
 *
 * Total 0-8 maps to Low/Medium/High/Urgent. The reasons array names every
 * contributing fact so the UI never has to show a number without an
 * explanation.
 */

export type ActionPriorityLevel = "Low" | "Medium" | "High" | "Urgent";

export type ActionPriorityResult = {
  level: ActionPriorityLevel;
  score: number;
  maxScore: number;
  reasons: string[];
};

const LABEL_POINTS: Record<string, number> = { Low: 0, Moderate: 1, High: 2, Critical: 3 };

export function computeActionPriority(
  report: HazardReport,
  network: HazardNetwork
): ActionPriorityResult {
  const reasons: string[] = [];
  let score = 0;

  const labelPoints = LABEL_POINTS[report.risk.projectedLabel] ?? 0;
  score += labelPoints;
  reasons.push(`Projected risk: ${report.risk.projectedLabel} (+${labelPoints})`);

  if (report.risk.weatherEscalation === "significant" && report.weather.rainfallHours !== null) {
    const urgencyPoints = report.weather.rainfallHours <= 6 ? 2 : 1;
    score += urgencyPoints;
    reasons.push(
      `Rainfall window: ${report.weather.rainfallHours}h (+${urgencyPoints})`
    );
  } else {
    reasons.push("Rainfall window: no significant escalation forecast (+0)");
  }

  if (report.analysis.confidence >= 75) {
    score += 1;
    reasons.push(`AI confidence: High, ${report.analysis.confidence}% (+1)`);
  } else if (report.analysis.confidence < 50) {
    score -= 1;
    reasons.push(`AI confidence: Low, ${report.analysis.confidence}% (-1, less certain)`);
  } else {
    reasons.push(`AI confidence: Medium, ${report.analysis.confidence}% (+0)`);
  }

  const node = network.nodes[report.id];
  if (node?.chainId) {
    const cascadePoints = node.upstreamCount > 0 ? 2 : 1;
    score += cascadePoints;
    reasons.push(
      node.upstreamCount > 0
        ? `Cascade involvement: receives water from ${node.upstreamCount} upstream hazard(s) (+2)`
        : `Cascade involvement: part of a hazard chain (+1)`
    );
  } else {
    reasons.push("Cascade involvement: not part of a detected chain (+0)");
  }

  const maxScore = 8;
  const clamped = Math.max(0, Math.min(maxScore, score));

  let level: ActionPriorityLevel;
  if (clamped >= 6) level = "Urgent";
  else if (clamped >= 4) level = "High";
  else if (clamped >= 2) level = "Medium";
  else level = "Low";

  return { level, score: clamped, maxScore, reasons };
}

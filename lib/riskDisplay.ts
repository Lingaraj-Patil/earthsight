import { RiskLabel } from "@/types/hazard";

export const RISK_COLOR: Record<RiskLabel, string> = {
  Low: "#4ade80",
  Moderate: "#facc15",
  High: "#fb923c",
  Critical: "#f87171",
};

export const RISK_BG: Record<RiskLabel, string> = {
  Low: "rgba(74, 222, 128, 0.12)",
  Moderate: "rgba(250, 204, 21, 0.12)",
  High: "rgba(251, 146, 60, 0.12)",
  Critical: "rgba(248, 113, 113, 0.14)",
};

export function riskTextClass(label: RiskLabel): string {
  switch (label) {
    case "Low":
      return "text-green-400";
    case "Moderate":
      return "text-yellow-400";
    case "High":
      return "text-orange-400";
    case "Critical":
      return "text-red-400";
  }
}

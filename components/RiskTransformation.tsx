"use client";

import { HazardReport } from "@/types/hazard";
import { riskTextClass } from "@/lib/riskDisplay";
import { ArrowDown } from "lucide-react";

export default function RiskTransformation({ report }: { report: HazardReport }) {
  const { risk } = report;
  // A numeric delta alone can't tell you whether escalation is real —
  // rounding can produce a 1-2 point bump from negligible rain. The risk
  // engine's weatherEscalation flag is the honest signal: it's only
  // "significant" when forecast rainfall/probability actually cross a
  // meaningful threshold.
  const significantEscalation =
    risk.weatherEscalation === "significant" && risk.projectedRisk > risk.currentRisk;

  return (
    <div className="es-card rounded-3xl p-6 sm:p-7">
      <h3 className="text-xs font-medium uppercase tracking-wider text-emerald-400">
        Risk Transformation
      </h3>

      <div className="mt-6 flex flex-col items-center gap-2 text-center">
        <span className="text-xs uppercase tracking-wide text-zinc-500">Current Risk</span>
        <span className={`text-5xl font-semibold ${riskTextClass(risk.currentLabel)}`}>
          {risk.currentRisk}
        </span>
        <span className={`text-sm font-medium ${riskTextClass(risk.currentLabel)}`}>
          {risk.currentLabel.toUpperCase()}
        </span>

        <ArrowDown
          className={`my-3 h-6 w-6 ${significantEscalation ? "text-red-400" : "text-zinc-600"}`}
        />

        <span className="text-xs uppercase tracking-wide text-zinc-500">Projected Risk</span>
        <span className={`text-5xl font-semibold ${riskTextClass(risk.projectedLabel)}`}>
          {risk.projectedRisk}
        </span>
        <span className={`text-sm font-medium ${riskTextClass(risk.projectedLabel)}`}>
          {risk.projectedLabel.toUpperCase()}
        </span>

        {significantEscalation ? (
          <p className="mt-4 text-xs text-zinc-500 max-w-sm">
            This hazard could escalate from{" "}
            <span className={riskTextClass(risk.currentLabel)}>
              {risk.currentLabel.toLowerCase()}
            </span>{" "}
            to{" "}
            <span className={riskTextClass(risk.projectedLabel)}>
              {risk.projectedLabel.toLowerCase()}
            </span>{" "}
            risk once forecast rainfall arrives.
          </p>
        ) : (
          <p className="mt-4 text-xs text-zinc-500 max-w-sm">
            Weather-driven escalation is currently minimal — no significant rainfall is forecast
            for this location right now.
          </p>
        )}
      </div>
    </div>
  );
}

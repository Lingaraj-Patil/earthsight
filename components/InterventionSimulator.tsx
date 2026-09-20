"use client";

import { useState } from "react";
import { HazardReport, RiskLabel } from "@/types/hazard";
import { getHazardTypeIdFromLabel } from "@/lib/hazardTypes";
import { interventionsForHazard, simulateIntervention } from "@/lib/interventionEngine";
import { riskTextClass } from "@/lib/riskDisplay";
import { ArrowRight, Wrench, Sparkles } from "lucide-react";

/**
 * "What If I Act?" — lets the user pick a real, category-scoped
 * intervention and see the actual recalculated risk, not a canned
 * before/after pair. Every number here comes from
 * lib/interventionEngine.ts's simulateIntervention(), which re-derives the
 * score from the report's real RiskFactor[].
 */
export default function InterventionSimulator({ report }: { report: HazardReport }) {
  const categoryId = getHazardTypeIdFromLabel(report.type);
  const options = interventionsForHazard(categoryId);

  const [selectedId, setSelectedId] = useState(options[0]?.id ?? null);
  const simulation = selectedId ? simulateIntervention(report, selectedId) : null;

  if (options.length === 0) {
    return (
      <div className="es-card rounded-3xl p-6 sm:p-7">
        <h3 className="text-xs font-medium uppercase tracking-wider text-emerald-400">
          What If I Act?
        </h3>
        <p className="mt-4 text-sm text-zinc-500">
          No deterministic intervention model exists yet for this hazard category (
          {report.analysis.hazardType}). Rather than guess, EarthSight doesn&apos;t simulate an
          action here.
        </p>
      </div>
    );
  }

  return (
    <div className="es-card rounded-3xl p-6 sm:p-7">
      <h3 className="text-xs font-medium uppercase tracking-wider text-emerald-400">
        What If I Act?
      </h3>

      {options.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSelectedId(opt.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors es-focus-ring ${
                selectedId === opt.id
                  ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300"
                  : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white"
              }`}
            >
              {opt.name}
            </button>
          ))}
        </div>
      )}

      {simulation && (
        <>
          <p className="mt-4 flex items-start gap-2 text-sm text-zinc-400">
            <Wrench className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
            {simulation.intervention.description}
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 sm:gap-2">
            <TrajectoryStep label="Now" value={report.risk.currentRisk} riskLabel={report.risk.currentLabel} />
            <ArrowRight className="h-4 w-4 text-zinc-600 rotate-90 sm:rotate-0 shrink-0" />
            <TrajectoryStep
              label="Without action"
              value={report.risk.projectedRisk}
              riskLabel={report.risk.projectedLabel}
              tone="bad"
            />
            <ArrowRight className="h-4 w-4 text-zinc-600 rotate-90 sm:rotate-0 shrink-0" />
            <TrajectoryStep
              label="With action"
              value={simulation.simulatedProjectedRisk}
              riskLabel={simulation.simulatedProjectedLabel}
              tone="good"
            />
          </div>

          <div className="mt-5 flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3">
            <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
            <p className="text-sm text-white">
              <span className="font-semibold text-emerald-400">
                {simulation.projectedRiskReduction}
              </span>{" "}
              point reduction in projected risk
              {simulation.currentRiskReduction !== simulation.projectedRiskReduction && (
                <> ({simulation.currentRiskReduction} points on current risk)</>
              )}
              .
            </p>
          </div>

          <p className="mt-4 text-xs text-zinc-500 leading-relaxed">{simulation.explanation}</p>

          {simulation.affectedFactors.length > 0 && (
            <div className="mt-4 flex flex-col gap-1.5">
              {simulation.affectedFactors.map((f) => (
                <div
                  key={f.label}
                  className="flex items-center justify-between text-xs text-zinc-500"
                >
                  <span>{f.label}</span>
                  <span>
                    {f.originalContribution} → {f.reducedContribution}{" "}
                    <span className="text-emerald-400">(−{f.pointsSaved})</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TrajectoryStep({
  label,
  value,
  riskLabel,
  tone,
}: {
  label: string;
  value: number;
  riskLabel: RiskLabel;
  tone?: "good" | "bad";
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-center">
      <span className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</span>
      <span
        className={`text-2xl font-semibold ${
          tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-red-400" : "text-white"
        }`}
      >
        {value}
      </span>
      <span className={`text-[11px] font-medium ${riskTextClass(riskLabel)}`}>
        {riskLabel.toUpperCase()}
      </span>
    </div>
  );
}

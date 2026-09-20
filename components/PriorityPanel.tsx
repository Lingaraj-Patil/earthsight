"use client";

import { useState } from "react";
import { HazardReport, RiskMode } from "@/types/hazard";
import { RISK_BG, RISK_COLOR } from "@/lib/riskDisplay";
import { Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import ReportSourceBadge from "@/components/ReportSourceBadge";
import { HazardNetwork } from "@/lib/cascade";
import { computeActionPriority } from "@/lib/actionPriority";

function scoreFor(report: HazardReport, mode: RiskMode) {
  return mode === "current" ? report.risk.currentRisk : report.risk.projectedRisk;
}
function labelFor(report: HazardReport, mode: RiskMode) {
  return mode === "current" ? report.risk.currentLabel : report.risk.projectedLabel;
}

export default function PriorityPanel({
  hazards,
  mode,
  network,
  onSelect,
  selectedId,
}: {
  hazards: HazardReport[];
  mode: RiskMode;
  network: HazardNetwork;
  onSelect: (id: string) => void;
  selectedId?: string;
}) {
  const [sortByAction, setSortByAction] = useState(false);

  const ranked = sortByAction
    ? [...hazards].sort(
        (a, b) => computeActionPriority(b, network).score - computeActionPriority(a, network).score
      )
    : [...hazards].sort((a, b) => scoreFor(b, mode) - scoreFor(a, mode));

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/5 px-5 py-4">
        <h2 className="text-sm font-semibold text-white">Priority Incidents</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          {sortByAction
            ? "Ranked by action priority"
            : mode === "current"
              ? "Ranked by current conditions"
              : "Ranked by projected conditions"}
        </p>
        <button
          type="button"
          onClick={() => setSortByAction((v) => !v)}
          aria-pressed={sortByAction}
          className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors es-focus-ring ${
            sortByAction
              ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
              : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white"
          }`}
        >
          <Zap className="h-3 w-3" />
          Action Priority
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
        {ranked.length === 0 && (
          <p className="px-2 py-8 text-center text-sm text-zinc-600">No hazards reported yet.</p>
        )}
        {ranked.map((report, index) => {
          const score = scoreFor(report, mode);
          const label = labelFor(report, mode);
          const color = RISK_COLOR[label];
          const isSelected = report.id === selectedId;

          return (
            <button
              key={report.id}
              type="button"
              onClick={() => onSelect(report.id)}
              className={`text-left rounded-2xl border p-3.5 transition-colors es-focus-ring ${
                isSelected
                  ? "border-emerald-400/50 bg-emerald-400/[0.06]"
                  : "border-white/8 bg-white/[0.02] hover:bg-white/[0.05]"
              }`}
              style={{ borderColor: isSelected ? undefined : "rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{ backgroundColor: RISK_BG[label], color }}
                >
                  Priority {index + 1}
                </span>
                <div className="flex items-center gap-2">
                  <ReportSourceBadge isSeed={report.isSeed} />
                  {report.isNew && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                      <Sparkles className="h-3 w-3" /> New
                    </span>
                  )}
                </div>
              </div>

              {sortByAction && (
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                  {computeActionPriority(report, network).level} action priority
                </p>
              )}
              <p className={`${sortByAction ? "mt-1" : "mt-2"} text-sm font-medium text-white line-clamp-1`}>
                {report.analysis.hazardType}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500 line-clamp-1">
                {report.description || report.locationLabel}
              </p>

              <div className="mt-2 flex items-center gap-2">
                <span className="text-xl font-semibold" style={{ color }}>
                  {score}
                </span>
                <span className="text-[11px] font-medium" style={{ color }}>
                  {label.toUpperCase()}
                </span>
                <Link
                  href={`/report?id=${report.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="ml-auto text-[11px] text-emerald-400 hover:text-emerald-300"
                >
                  Details →
                </Link>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

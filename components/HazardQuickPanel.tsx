"use client";

import Link from "next/link";
import { HazardReport } from "@/types/hazard";
import { HazardNetwork } from "@/lib/cascade";
import { getHazardTypeIdFromLabel } from "@/lib/hazardTypes";
import { interventionsForHazard, simulateIntervention } from "@/lib/interventionEngine";
import { computeInterventionWindow, formatDuration } from "@/lib/interventionWindow";
import { riskTextClass } from "@/lib/riskDisplay";
import ReportSourceBadge from "@/components/ReportSourceBadge";
import { X, ArrowRight } from "lucide-react";

/**
 * The compact "environmental command center" readout for a selected
 * hazard. Every field reads directly from the report or a real
 * computation already used elsewhere in the app (interventionEngine,
 * interventionWindow, cascade network) — nothing here is recomputed with
 * different logic than the full detail page.
 */
export default function HazardQuickPanel({
  report,
  network,
  onClose,
}: {
  report: HazardReport;
  network: HazardNetwork;
  onClose: () => void;
}) {
  const categoryId = getHazardTypeIdFromLabel(report.type);
  const options = interventionsForHazard(categoryId);
  const simulation = options.length > 0 ? simulateIntervention(report, options[0].id) : null;

  const significant = report.risk.weatherEscalation === "significant";
  const window = computeInterventionWindow(report.weather, significant);

  const node = network.nodes[report.id];
  const connectedCount = (node?.upstreamCount ?? 0) + (node?.downstreamCount ?? 0);

  return (
    <div className="absolute top-3 right-3 z-[500] w-[280px] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-white/10 bg-[#0c1916]/95 backdrop-blur-md shadow-2xl shadow-black/50 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <ReportSourceBadge isSeed={report.isSeed} />
          <p className="mt-1.5 text-sm font-semibold text-white leading-tight">
            {report.analysis.hazardType}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close hazard panel"
          className="text-zinc-500 hover:text-white shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <MiniStat
          label="Current"
          value={report.risk.currentRisk}
          sub={report.risk.currentLabel}
          className={riskTextClass(report.risk.currentLabel)}
        />
        <MiniStat
          label="Projected"
          value={report.risk.projectedRisk}
          sub={report.risk.projectedLabel}
          className={riskTextClass(report.risk.projectedLabel)}
        />
      </div>

      <dl className="mt-3 flex flex-col gap-1.5 text-xs">
        <Row
          label="Rain"
          value={
            report.weather.rainfallHours === null
              ? "Not significant"
              : `${report.weather.rainfallHours}h`
          }
        />
        <Row
          label="Terrain exposure"
          value={report.terrain ? report.terrain.floodExposure.toFixed(2) : "unavailable"}
        />
        <Row label="Connected hazards" value={String(connectedCount)} />
        <Row
          label="Intervention window"
          value={
            window.status === "counting-down"
              ? formatDuration(window.msRemaining)
              : window.status === "already-past"
                ? "stale forecast"
                : "no urgency"
          }
        />
        {simulation && (
          <>
            <Row label="Potential mitigation" value={simulation.intervention.name} />
            <Row
              label="Simulated risk"
              value={`${simulation.simulatedProjectedRisk}`}
              valueClass={riskTextClass(simulation.simulatedProjectedLabel)}
            />
          </>
        )}
      </dl>

      <Link
        href={`/report?id=${report.id}`}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-emerald-400 px-3 py-2 text-xs font-medium text-[#06120f] hover:bg-emerald-300 transition-colors"
      >
        Full Intelligence
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function MiniStat({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: number;
  sub: string;
  className: string;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] py-2">
      <p className="text-[9px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`text-xl font-semibold ${className}`}>{value}</p>
      <p className={`text-[10px] font-medium ${className}`}>{sub.toUpperCase()}</p>
    </div>
  );
}

function Row({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-zinc-500">{label}</dt>
      <dd className={`font-medium ${valueClass ?? "text-white"}`}>{value}</dd>
    </div>
  );
}

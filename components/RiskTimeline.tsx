"use client";

import { HazardReport } from "@/types/hazard";
import { riskTextClass } from "@/lib/riskDisplay";
import { CloudRain, TriangleAlert, MapPin, CheckCircle2 } from "lucide-react";

export default function RiskTimeline({ report }: { report: HazardReport }) {
  const { weather, risk, analysis } = report;
  const significant = risk.weatherEscalation === "significant";

  const hoursLabel = !significant
    ? "No significant rain expected"
    : weather.rainfallHours === null
      ? "Timing uncertain"
      : weather.rainfallHours === 0
        ? "Rain expected imminently"
        : `In ${weather.rainfallHours} hour${weather.rainfallHours === 1 ? "" : "s"}`;

  return (
    <div className="es-card rounded-3xl p-6 sm:p-7">
      <h3 className="text-xs font-medium uppercase tracking-wider text-emerald-400">
        Before-the-Rain Timeline
      </h3>

      <div className="mt-6 relative pl-8">
        <div
          className={`absolute left-[11px] top-2 bottom-2 w-px bg-gradient-to-b ${
            significant
              ? "from-zinc-600 via-emerald-400/50 to-red-400/60"
              : "from-zinc-600 via-zinc-600/50 to-zinc-600/30"
          }`}
        />

        {/* NOW */}
        <div className="relative pb-8">
          <span className="absolute -left-8 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-[#0c1916] border border-emerald-400/40">
            <MapPin className="h-3 w-3 text-emerald-400" />
          </span>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Now</p>
          <p className="mt-1 text-sm text-white">
            {analysis.hazardType} detected{report.locationLabel ? ` at ${report.locationLabel}` : ""}.
          </p>
          <p className="mt-1 text-sm">
            Risk:{" "}
            <span className={`font-semibold ${riskTextClass(risk.currentLabel)}`}>
              {risk.currentRisk}
            </span>{" "}
            <span className={`text-xs font-medium ${riskTextClass(risk.currentLabel)}`}>
              {risk.currentLabel.toUpperCase()}
            </span>
          </p>
        </div>

        {/* RAIN EVENT */}
        <div className="relative pb-8">
          <span
            className={`absolute -left-8 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-[#0c1916] border ${
              significant ? "border-sky-400/40" : "border-white/15"
            }`}
          >
            {significant ? (
              <CloudRain className="h-3 w-3 text-sky-300" />
            ) : (
              <CheckCircle2 className="h-3 w-3 text-zinc-500" />
            )}
          </span>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {hoursLabel}
          </p>
          <p className="mt-1 text-sm text-white">
            {significant
              ? `Rainfall forecast: ~${weather.forecastRainfall}mm with a ${weather.rainProbability}% probability.`
              : `Forecast shows ${weather.forecastRainfall}mm rainfall at a ${weather.rainProbability}% probability — not enough to meaningfully change conditions.`}
          </p>
        </div>

        {/* CONSEQUENCE */}
        <div className="relative">
          <span
            className={`absolute -left-8 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-[#0c1916] border ${
              significant ? "border-red-400/40" : "border-white/15"
            }`}
          >
            {significant ? (
              <TriangleAlert className="h-3 w-3 text-red-400" />
            ) : (
              <CheckCircle2 className="h-3 w-3 text-zinc-500" />
            )}
          </span>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {significant ? "After rainfall" : "If conditions stay the same"}
          </p>
          <p className="mt-1 text-sm text-white">
            {significant
              ? `Potential ${analysis.environmentalImpact?.toLowerCase() ?? "escalation"}.`
              : "Risk is not expected to change meaningfully from current conditions."}
          </p>
          <p className="mt-1 text-sm">
            Risk:{" "}
            <span className={`font-semibold ${riskTextClass(risk.projectedLabel)}`}>
              {risk.projectedRisk}
            </span>{" "}
            <span className={`text-xs font-medium ${riskTextClass(risk.projectedLabel)}`}>
              {risk.projectedLabel.toUpperCase()}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

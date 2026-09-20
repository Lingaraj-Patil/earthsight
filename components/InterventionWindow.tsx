"use client";

import { useEffect, useState } from "react";
import { HazardReport } from "@/types/hazard";
import { computeInterventionWindow, formatDuration } from "@/lib/interventionWindow";
import { Timer, CloudOff, History } from "lucide-react";

/**
 * Displays a live countdown to real forecast rain arrival. The countdown
 * itself re-computes from the report's real weather.fetchedAt timestamp
 * plus the real forecast rainfallHours every tick — it never counts down
 * an arbitrary number. If the anchoring timestamp has already passed (the
 * report's weather snapshot is stale), that's disclosed explicitly rather
 * than showing a countdown that implies the data is current.
 */
export default function InterventionWindow({ report }: { report: HazardReport }) {
  const significant = report.risk.weatherEscalation === "significant";
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // Ticks the real clock so the countdown stays accurate. The interval
    // only re-reads Date.now() — it never advances a fake counter.
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const window = computeInterventionWindow(report.weather, significant, now);

  return (
    <div className="es-card rounded-3xl p-6 sm:p-7">
      <h3 className="text-xs font-medium uppercase tracking-wider text-emerald-400">
        Intervention Window
      </h3>

      {window.status === "no-significant-rain" && (
        <div className="mt-4 flex items-start gap-3">
          <CloudOff className="h-5 w-5 shrink-0 text-zinc-500" />
          <p className="text-sm text-zinc-400">
            No significant weather-driven escalation detected right now. There is no forecast
            urgency pushing this hazard toward a higher risk state.
          </p>
        </div>
      )}

      {window.status === "already-past" && (
        <div className="mt-4 flex items-start gap-3">
          <History className="h-5 w-5 shrink-0 text-yellow-400" />
          <p className="text-sm text-zinc-400">
            The forecast window used in this analysis has already passed (weather was checked{" "}
            {window.arrivedMinutesAgo >= 60
              ? `${Math.round(window.arrivedMinutesAgo / 60)}h`
              : `${window.arrivedMinutesAgo}m`}{" "}
            ago). This snapshot may be stale — refresh environmental conditions for a current
            read.
          </p>
        </div>
      )}

      {window.status === "counting-down" && (
        <div className="mt-4 flex items-start gap-3">
          <Timer className="h-5 w-5 shrink-0 text-emerald-400" />
          <div>
            <p className="text-3xl font-semibold text-emerald-400">
              {formatDuration(window.msRemaining)}
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              Recommended: act before forecast rainfall arrives.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { HazardReport } from "@/types/hazard";
import { fetchWeatherData } from "@/lib/weather";
import { calculateRisk, RISK_ENGINE_VERSION } from "@/lib/riskEngine";
import { getHazardTypeIdFromLabel } from "@/lib/hazardTypes";
import { saveHazard, StorageError } from "@/lib/storage";
import { RefreshCw, Loader2, AlertTriangle } from "lucide-react";

/**
 * Explicit "Refresh Environmental Risk" action. This is deliberately NOT
 * automatic — a stored report is a historical snapshot, and silently
 * recalculating it on every page view would misrepresent what was
 * actually analyzed at submission time. The user has to ask for a fresh
 * read, and is shown exactly what changed.
 *
 * Preserves: AI analysis, image, location, terrain.
 * Refetches: weather only (terrain doesn't meaningfully change over the
 * timescales this app operates on).
 * Recalculates: risk, deterministically, from the same real engine.
 */
export default function RefreshRisk({
  report,
  onUpdated,
}: {
  report: HazardReport;
  onUpdated: (updated: HazardReport) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diff, setDiff] = useState<{
    previousProjected: number;
    updatedProjected: number;
    previousRainProbability: number;
    updatedRainProbability: number;
    previousForecastRainfall: number;
    updatedForecastRainfall: number;
  } | null>(null);

  if (report.isSeed) return null;

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const freshWeather = await fetchWeatherData(report.latitude, report.longitude);
      const categoryId = getHazardTypeIdFromLabel(report.type);
      const updatedRisk = calculateRisk(report.analysis, freshWeather, categoryId, report.terrain);

      const updated: HazardReport = {
        ...report,
        weather: freshWeather,
        risk: {
          currentRisk: updatedRisk.currentRisk,
          projectedRisk: updatedRisk.projectedRisk,
          currentLabel: updatedRisk.currentLabel,
          projectedLabel: updatedRisk.projectedLabel,
          factors: updatedRisk.factors,
          weatherEscalation: updatedRisk.weatherEscalation,
        },
        provenance: {
          ...report.provenance,
          weatherFetchedAt: freshWeather.fetchedAt,
          riskCalculatedAt: new Date().toISOString(),
          riskEngineVersion: RISK_ENGINE_VERSION,
        },
      };

      setDiff({
        previousProjected: report.risk.projectedRisk,
        updatedProjected: updated.risk.projectedRisk,
        previousRainProbability: report.weather.rainProbability,
        updatedRainProbability: freshWeather.rainProbability,
        previousForecastRainfall: report.weather.forecastRainfall,
        updatedForecastRainfall: freshWeather.forecastRainfall,
      });

      saveHazard(updated);
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof StorageError ? err.message : "Could not refresh conditions.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
      <button
        type="button"
        onClick={handleRefresh}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-white hover:bg-white/[0.08] transition-colors es-focus-ring disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5 text-emerald-400" />
        )}
        Refresh Environmental Risk
      </button>

      {error && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
          <AlertTriangle className="h-3.5 w-3.5" /> {error}
        </p>
      )}

      {diff && !error && (
        <div className="mt-3 text-xs text-zinc-400">
          <p>
            Projected risk: <span className="text-white">{diff.previousProjected}</span> →{" "}
            <span className="font-semibold text-emerald-400">{diff.updatedProjected}</span>
          </p>
          <p className="mt-1">
            Rain probability: {diff.previousRainProbability}% → {diff.updatedRainProbability}%
            &nbsp;·&nbsp; Forecast rainfall: {diff.previousForecastRainfall}mm →{" "}
            {diff.updatedForecastRainfall}mm
          </p>
        </div>
      )}
    </div>
  );
}

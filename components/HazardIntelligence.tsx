"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HazardReport } from "@/types/hazard";
import { riskTextClass, RISK_BG, RISK_COLOR } from "@/lib/riskDisplay";
import { deleteHazard, StorageError, getHazards } from "@/lib/storage";
import { buildHazardNetwork, HazardNetwork } from "@/lib/cascade";
import { computeActionPriority } from "@/lib/actionPriority";
import RiskTransformation from "@/components/RiskTransformation";
import RiskExplanation from "@/components/RiskExplanation";
import RiskTimeline from "@/components/RiskTimeline";
import RecommendedAction from "@/components/RecommendedAction";
import ReportSourceBadge from "@/components/ReportSourceBadge";
import TerrainInsight from "@/components/TerrainInsight";
import ConfidenceNotice from "@/components/ConfidenceNotice";
import WhyThisMatters from "@/components/WhyThisMatters";
import DataProvenance from "@/components/DataProvenance";
import InterventionWindow from "@/components/InterventionWindow";
import InterventionSimulator from "@/components/InterventionSimulator";
import RefreshRisk from "@/components/RefreshRisk";
import ResponsibleAI from "@/components/ResponsibleAI";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  AlertTriangle,
  ImageOff,
  Trash2,
  Info,
  Navigation,
  Zap,
} from "lucide-react";

export default function HazardIntelligence({ report: initialReport }: { report: HazardReport }) {
  const router = useRouter();
  const [report, setReport] = useState(initialReport);
  const [network, setNetwork] = useState<HazardNetwork | null>(null);
  const { analysis, weather } = report;
  const submitted = new Date(report.createdAt);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setNetwork(buildHazardNetwork(getHazards()));
  }, [report.id]);

  const handleDelete = () => {
    try {
      deleteHazard(report.id);
      router.push("/map");
    } catch (err) {
      setDeleteError(
        err instanceof StorageError ? err.message : "Could not delete this report."
      );
    }
  };

  const actionPriority = network ? computeActionPriority(report, network) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-28">
      <div className="flex items-center justify-between">
        <Link
          href="/map"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors es-focus-ring rounded"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Live Map
        </Link>

        {!report.isSeed && (
          <div className="flex items-center gap-2">
            {confirmingDelete ? (
              <>
                <span className="text-xs text-zinc-500">Delete this report?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="rounded-full bg-red-500/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 es-focus-ring"
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 es-focus-ring"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:text-red-300 hover:border-red-400/30 transition-colors es-focus-ring"
                aria-label="Delete this hazard report"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Report
              </button>
            )}
          </div>
        )}
      </div>

      {deleteError && (
        <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4" /> {deleteError}
        </p>
      )}

      <div className="mt-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
              style={{
                backgroundColor: RISK_BG[report.risk.projectedLabel],
                color: RISK_COLOR[report.risk.projectedLabel],
              }}
            >
              {report.risk.projectedLabel.toUpperCase()} PROJECTED RISK
            </span>
            <ReportSourceBadge isSeed={report.isSeed} />
            {actionPriority && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300">
                <Zap className="h-3 w-3" />
                {actionPriority.level} action priority
              </span>
            )}
          </div>
          <h1 className="mt-3 text-3xl font-semibold text-white tracking-tight">
            {analysis.hazardType}
          </h1>
          <p className="mt-1 text-zinc-400">{report.description ?? "No description provided."}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-4 text-sm text-zinc-400">
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-4 w-4 text-emerald-400" />
          {report.locationLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-emerald-400" />
          {submitted.toLocaleString()}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Navigation className="h-4 w-4 text-emerald-400" />
          {report.locationSource === "gps"
            ? "Location from device GPS"
            : report.locationSource === "geocoded"
              ? "Location from geocoded address"
              : "Seed location (predefined)"}
        </span>
      </div>

      {weather.isFallback && (
        <div className="mt-6 flex flex-col gap-2">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-yellow-400/20 bg-yellow-400/5 px-3 py-1.5 text-xs text-yellow-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            Live weather data was unavailable when this report was analyzed — showing fallback
            environmental data instead.
          </p>
        </div>
      )}

      {!report.isSeed && (
        <div className="mt-4">
          <RefreshRisk report={report} onUpdated={setReport} />
        </div>
      )}

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evidence */}
        <div className="es-card rounded-3xl overflow-hidden">
          <div className="p-6 pb-0">
            <h3 className="text-xs font-medium uppercase tracking-wider text-emerald-400">
              Evidence
            </h3>
          </div>
          {report.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={report.imageUrl}
              alt={`Uploaded evidence for ${analysis.hazardType}`}
              className="mt-4 w-full h-64 object-cover"
            />
          ) : (
            <div className="mt-4 flex h-64 flex-col items-center justify-center gap-2 text-zinc-600">
              <ImageOff className="h-8 w-8" />
              <span className="text-sm">No image provided</span>
            </div>
          )}
          <div className="p-6 pt-4">
            <ConfidenceNotice confidence={analysis.confidence} />
          </div>
        </div>

        {/* AI analysis */}
        <div className="es-card rounded-3xl p-6">
          <h3 className="text-xs font-medium uppercase tracking-wider text-emerald-400">
            AI Hazard Analysis
          </h3>
          <dl className="mt-4 flex flex-col gap-3 text-sm">
            <Row label="Hazard Type" value={analysis.hazardType} />
            <Row label="Observed Material" value={analysis.observedMaterial} />
            <Row
              label="Severity"
              value={`${analysis.severityLabel} (${analysis.severityScore}/100)`}
              valueClass={riskTextClass(analysis.severityLabel)}
            />
            <Row label="Model Confidence" value={`${analysis.confidence}%`} />
            <Row label="Environmental Impact" value={analysis.environmentalImpact} />
          </dl>

          {analysis.visibleIndicators.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-zinc-500 mb-1.5">Visual evidence detected</p>
              <div className="flex flex-wrap gap-1.5">
                {analysis.visibleIndicators.map((indicator) => (
                  <span
                    key={indicator}
                    className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-300"
                  >
                    {indicator}
                  </span>
                ))}
              </div>
            </div>
          )}

          {analysis.reasoning && (
            <p className="mt-4 flex items-start gap-2 text-xs text-zinc-500 leading-relaxed">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-400" />
              {analysis.reasoning}
            </p>
          )}

          <h3 className="mt-6 text-xs font-medium uppercase tracking-wider text-emerald-400">
            Current Conditions
          </h3>
          <dl className="mt-4 flex flex-col gap-3 text-sm">
            <Row label="Current Weather" value={weather.weatherDescription} />
            <Row label="Current Rainfall" value={`${weather.currentRainfall} mm`} />
          </dl>

          <h3 className="mt-6 text-xs font-medium uppercase tracking-wider text-emerald-400">
            Projected Conditions
          </h3>
          <dl className="mt-4 flex flex-col gap-3 text-sm">
            <Row label="Forecast Rainfall" value={`${weather.forecastRainfall} mm`} />
            <Row label="Rain Probability" value={`${weather.rainProbability}%`} />
            <Row
              label="Time Until Rain"
              value={weather.rainfallHours === null ? "Not expected soon" : `${weather.rainfallHours}h`}
            />
          </dl>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <RiskTransformation report={report} />
        <RiskExplanation factors={report.risk.factors} />
      </div>

      <div className="mt-6">
        <TerrainInsight terrain={report.terrain} />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <InterventionWindow report={report} />
        <RecommendedAction report={report} />
      </div>

      <div className="mt-6">
        <InterventionSimulator report={report} />
      </div>

      <div className="mt-6">
        <RiskTimeline report={report} />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <WhyThisMatters hazardTypeLabel={report.type} />
        <DataProvenance report={report} />
      </div>

      <div className="mt-6">
        <ResponsibleAI />
      </div>
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
    <div className="flex items-center justify-between gap-4">
      <dt className="text-zinc-500 shrink-0">{label}</dt>
      <dd className={`text-right font-medium ${valueClass ?? "text-white"}`}>{value}</dd>
    </div>
  );
}

"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  X,
  MapPin,
  LocateFixed,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";

import { HAZARD_TYPES } from "@/lib/hazardTypes";
import { analyzeHazard, HazardAnalysisError } from "@/lib/hazardAnalysis";
import { fetchWeatherData } from "@/lib/weather";
import { forwardGeocode, reverseGeocode } from "@/lib/geocoding";
import { compressImageToDataUrl } from "@/lib/imageProcessing";
import { calculateRisk, RISK_ENGINE_VERSION } from "@/lib/riskEngine";
import { analyzeTerrain } from "@/lib/terrain";
import { saveHazard, StorageError } from "@/lib/storage";
import {
  HazardAnalysis,
  HazardReport,
  WeatherData,
  RiskResult,
  HazardTypeId,
  TerrainAnalysis,
} from "@/types/hazard";

import RiskTransformation from "@/components/RiskTransformation";
import RiskExplanation from "@/components/RiskExplanation";
import RiskTimeline from "@/components/RiskTimeline";
import RecommendedAction from "@/components/RecommendedAction";
import TerrainInsight from "@/components/TerrainInsight";
import ChainAlert from "@/components/ChainAlert";
import CascadeScenarios from "@/components/CascadeScenarios";
import InterventionWindow from "@/components/InterventionWindow";
import InterventionSimulator from "@/components/InterventionSimulator";
import { getHazards } from "@/lib/storage";
import { buildHazardNetwork } from "@/lib/cascade";
import { riskTextClass } from "@/lib/riskDisplay";

type Step = 1 | 2 | 3 | 4 | 5;
type GeoStatus = "idle" | "locating" | "success" | "denied" | "unavailable" | "unsupported";
type StageState = "pending" | "active" | "done" | "error";

type PipelineStages = {
  locate: StageState;
  ai: StageState;
  weather: StageState;
  terrain: StageState;
  risk: StageState;
};

const INITIAL_STAGES: PipelineStages = {
  locate: "pending",
  ai: "pending",
  weather: "pending",
  terrain: "pending",
  risk: "pending",
};

type PipelineError = { message: string; retryable: boolean };
type ResolvedLocation = { lat: number; lng: number; label: string; source: "gps" | "geocoded" };

export default function ReportForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(1);

  // Step 1 — evidence
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);

  // Step 2 — location & context
  const [locationLabel, setLocationLabel] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [hazardTypeId, setHazardTypeId] = useState<HazardTypeId>(HAZARD_TYPES[0].id);
  const [description, setDescription] = useState("");
  const [step2Error, setStep2Error] = useState<string | null>(null);

  // Step 3 — real pipeline progress (no timers, only actual promise state)
  const [stages, setStages] = useState<PipelineStages>(INITIAL_STAGES);
  const [pipelineError, setPipelineError] = useState<PipelineError | null>(null);

  // Step 4 / 5 — results
  const [analysis, setAnalysis] = useState<HazardAnalysis | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [terrain, setTerrain] = useState<TerrainAnalysis | null>(null);
  const [risk, setRisk] = useState<RiskResult | null>(null);
  const [resolvedLocation, setResolvedLocation] = useState<ResolvedLocation | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Real timestamps captured the moment each async operation actually
  // resolves, used to populate HazardReport.provenance. These are read
  // during render (to build the provenance object), so they must be real
  // state, not refs.
  const [aiAnalyzedAt, setAiAnalyzedAt] = useState<string>("");
  const [terrainAnalyzedAt, setTerrainAnalyzedAt] = useState<string | null>(null);
  const [riskCalculatedAt, setRiskCalculatedAt] = useState<string>("");

  const hazardTypeLabel =
    HAZARD_TYPES.find((h) => h.id === hazardTypeId)?.label ?? HAZARD_TYPES[0].label;

  // ---------------- Step 1: image upload (real compression, not cosmetic) ----------------

  const handleFiles = useCallback(async (files: FileList | null) => {
    setImageError(null);
    const file = files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setImageError("Please upload an image file (JPG, PNG, WEBP, etc).");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setImageError("Image is too large. Please upload a file under 8MB.");
      return;
    }

    setIsCompressing(true);
    try {
      const compressed = await compressImageToDataUrl(file);
      setImageDataUrl(compressed);
    } catch {
      setImageError("Could not process this image. Please try another file.");
    } finally {
      setIsCompressing(false);
    }
  }, []);

  // ---------------- Step 2: geolocation ----------------

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setGeoStatus("unsupported");
      return;
    }
    setGeoStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCoords({ lat, lng });
        setGeoStatus("success");
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) setGeoStatus("denied");
        else if (error.code === error.TIMEOUT) setGeoStatus("unavailable");
        else setGeoStatus("unavailable");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // ---------------- Step 1 -> 2 ----------------

  const goToStep2 = () => {
    if (!imageDataUrl) {
      setImageError("Please upload a photo of the hazard before continuing.");
      return;
    }
    setStep(2);
  };

  // ---------------- Step 2 -> 3: real pipeline, no hardcoded fallback coordinates ----------------

  const runAnalysisPipeline = async () => {
    if (!coords && !locationLabel.trim()) {
      setStep2Error(
        "Please enter a location or use your current location — a real location is required."
      );
      return;
    }

    setStep2Error(null);
    setPipelineError(null);
    setStages(INITIAL_STAGES);
    setStep(3);

    let lat: number;
    let lng: number;
    let finalLabel: string;
    let source: "gps" | "geocoded";

    setStages((s) => ({ ...s, locate: "active" }));

    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
      source = "gps";
      if (locationLabel.trim()) {
        finalLabel = locationLabel.trim();
      } else {
        const reverse = await reverseGeocode(lat, lng);
        finalLabel = reverse ?? (lat.toFixed(5) + ", " + lng.toFixed(5));
      }
    } else {
      const geocoded = await forwardGeocode(locationLabel);
      if (!geocoded) {
        setStages(INITIAL_STAGES);
        setStep(2);
        setStep2Error(
          "Couldn't determine this location. Please use your current location or enter a more specific place."
        );
        return;
      }
      lat = geocoded.latitude;
      lng = geocoded.longitude;
      finalLabel = geocoded.label;
      source = "geocoded";
    }

    setResolvedLocation({ lat, lng, label: finalLabel, source });
    setStages((s) => ({
      ...s,
      locate: "done",
      ai: "active",
      weather: "active",
      terrain: "active",
    }));

    const analysisPromise = analyzeHazard({
      hazardTypeLabel,
      description,
      imageDataUrl: imageDataUrl as string,
    })
      .then((result) => {
        setStages((s) => ({ ...s, ai: "done" }));
        setAiAnalyzedAt(new Date().toISOString());
        return result;
      })
      .catch((err: unknown) => {
        setStages((s) => ({ ...s, ai: "error" }));
        throw err;
      });

    const weatherPromise = fetchWeatherData(lat, lng).then((result) => {
      setStages((s) => ({ ...s, weather: "done" }));
      return result;
    });

    // Terrain analysis resolves to null rather than throwing if the
    // elevation service is unavailable, so it can never block a report.
    const terrainPromise = analyzeTerrain(lat, lng).then((result) => {
      setStages((s) => ({ ...s, terrain: result ? "done" : "error" }));
      setTerrainAnalyzedAt(result ? new Date().toISOString() : null);
      return result;
    });

    let analysisResult: HazardAnalysis;
    let weatherResult: WeatherData;
    let terrainResult: TerrainAnalysis | null;
    try {
      [analysisResult, weatherResult, terrainResult] = await Promise.all([
        analysisPromise,
        weatherPromise,
        terrainPromise,
      ]);
    } catch (err) {
      const message =
        err instanceof HazardAnalysisError
          ? describeAnalysisError(err)
          : "Something went wrong while analyzing this report.";
      setPipelineError({ message, retryable: true });
      return;
    }

    setStages((s) => ({ ...s, risk: "active" }));
    const riskResult = calculateRisk(
      analysisResult,
      weatherResult,
      hazardTypeId,
      terrainResult
    );
    setRiskCalculatedAt(new Date().toISOString());
    setStages((s) => ({ ...s, risk: "done" }));

    setAnalysis(analysisResult);
    setWeather(weatherResult);
    setTerrain(terrainResult);
    setRisk(riskResult);
    setStep(4);
  };

  // ---------------- Step 5: submit ----------------

  const handleAddToPriorityMap = () => {
    if (!analysis || !weather || !risk || !resolvedLocation) return;
    setSubmitting(true);
    setSubmitError(null);

    const report: HazardReport = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      name: hazardTypeLabel + " — " + resolvedLocation.label,
      type: hazardTypeLabel,
      description: description || undefined,
      imageUrl: imageDataUrl ?? undefined,
      locationLabel: resolvedLocation.label,
      latitude: resolvedLocation.lat,
      longitude: resolvedLocation.lng,
      locationSource: resolvedLocation.source,
      analysis,
      weather,
      terrain,
      provenance: {
        reportCreatedAt: new Date().toISOString(),
        aiAnalyzedAt: aiAnalyzedAt || new Date().toISOString(),
        weatherFetchedAt: weather.fetchedAt,
        terrainAnalyzedAt: terrainAnalyzedAt,
        riskCalculatedAt: riskCalculatedAt || new Date().toISOString(),
        riskEngineVersion: RISK_ENGINE_VERSION,
      },
      risk: {
        currentRisk: risk.currentRisk,
        projectedRisk: risk.projectedRisk,
        currentLabel: risk.currentLabel,
        projectedLabel: risk.projectedLabel,
        factors: risk.factors,
        weatherEscalation: risk.weatherEscalation,
      },
      isNew: true,
      isSeed: false,
    };

    try {
      saveHazard(report);
      router.push("/map?focus=" + report.id + "&toast=1");
    } catch (err) {
      setSubmitting(false);
      setSubmitError(
        err instanceof StorageError ? err.message : "Could not save this report. Please try again."
      );
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-28">
      {/* Progress */}
      <div
        className="mb-10 flex items-center gap-2"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={5}
      >
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              s <= step ? "bg-emerald-400" : "bg-white/10"
            }`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="es-fade-up">
          <h1 className="text-3xl font-semibold text-white tracking-tight">
            Report an Environmental Hazard
          </h1>
          <p className="mt-2 text-zinc-400">
            Help identify environmental risks before they become emergencies.
          </p>

          <div className="mt-8">
            {!imageDataUrl ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  void handleFiles(e.dataTransfer.files);
                }}
                className={`flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-6 py-16 text-center transition-colors ${
                  isDragging
                    ? "border-emerald-400 bg-emerald-400/5"
                    : "border-white/15 bg-white/[0.02]"
                }`}
              >
                {isCompressing ? (
                  <>
                    <Loader2 className="h-10 w-10 animate-spin text-emerald-400" />
                    <p className="text-white font-medium">Processing image...</p>
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-10 w-10 text-emerald-400" />
                    <p className="text-white font-medium">Drag and drop image</p>
                    <p className="text-sm text-zinc-500">or</p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-full border border-white/15 bg-white/[0.03] px-5 py-2 text-sm font-medium text-white hover:bg-white/[0.08] transition-colors es-focus-ring"
                    >
                      Choose file
                    </button>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  aria-label="Upload hazard photo"
                  onChange={(e) => void handleFiles(e.target.files)}
                />
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-3xl border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageDataUrl}
                  alt="Uploaded hazard evidence preview"
                  className="max-h-96 w-full object-cover"
                />
                <div className="absolute top-3 right-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-full bg-black/60 backdrop-blur px-3 py-1.5 text-xs font-medium text-white hover:bg-black/80 es-focus-ring"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageDataUrl(null)}
                    aria-label="Remove image"
                    className="rounded-full bg-black/60 backdrop-blur p-1.5 text-white hover:bg-black/80 es-focus-ring"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  aria-label="Replace hazard photo"
                  onChange={(e) => void handleFiles(e.target.files)}
                />
              </div>
            )}
            {imageError && (
              <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-red-400">
                <AlertTriangle className="h-4 w-4" /> {imageError}
              </p>
            )}
          </div>

          <div className="mt-8 flex justify-end">
            <button
              type="button"
              onClick={goToStep2}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-6 py-3 text-sm font-medium text-[#06120f] hover:bg-emerald-300 transition-colors es-focus-ring disabled:opacity-40"
              disabled={!imageDataUrl || isCompressing}
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="es-fade-up">
          <h1 className="text-3xl font-semibold text-white tracking-tight">
            Location and Context
          </h1>
          <p className="mt-2 text-zinc-400">
            Tell us where this hazard is and what kind of hazard it is. We use your real GPS
            location or geocode the address you type — no placeholder coordinates are ever used.
          </p>

          <div className="mt-8 flex flex-col gap-6">
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-white mb-2">
                Location
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <MapPin className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <input
                    id="location"
                    type="text"
                    value={locationLabel}
                    onChange={(e) => {
                      setLocationLabel(e.target.value);
                      if (coords) setCoords(null);
                    }}
                    placeholder="e.g. Koramangala, Bengaluru"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-3 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-400/50 es-focus-ring"
                  />
                </div>
                <button
                  type="button"
                  onClick={useMyLocation}
                  className="shrink-0 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white hover:bg-white/[0.08] transition-colors es-focus-ring"
                >
                  {geoStatus === "locating" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LocateFixed className="h-4 w-4 text-emerald-400" />
                  )}
                  <span className="hidden sm:inline">Use My Location</span>
                </button>
              </div>

              {geoStatus === "success" && coords && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Current location detected (
                  {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})
                </p>
              )}
              {geoStatus === "denied" && (
                <p className="mt-2 text-xs text-yellow-400">
                  Location permission was denied. You can still enter a location manually.
                </p>
              )}
              {geoStatus === "unavailable" && (
                <p className="mt-2 text-xs text-yellow-400">
                  We couldn&apos;t determine your location. Please enter it manually.
                </p>
              )}
              {geoStatus === "unsupported" && (
                <p className="mt-2 text-xs text-yellow-400">
                  Your browser doesn&apos;t support geolocation. Please enter a location manually.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="hazardType" className="block text-sm font-medium text-white mb-2">
                Hazard Type
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {HAZARD_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setHazardTypeId(type.id)}
                    className={`rounded-2xl border px-3 py-3 text-left text-sm transition-colors es-focus-ring ${
                      hazardTypeId === type.id
                        ? "border-emerald-400/60 bg-emerald-400/10 text-white"
                        : "border-white/10 bg-white/[0.02] text-zinc-400 hover:bg-white/[0.05]"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-white mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Describe what you observed — this is given to the AI as context, but the image itself drives the analysis."
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-400/50 es-focus-ring"
              />
            </div>

            {step2Error && (
              <p role="alert" className="flex items-center gap-2 text-sm text-red-400">
                <AlertTriangle className="h-4 w-4" /> {step2Error}
              </p>
            )}
          </div>

          <div className="mt-8 flex justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm font-medium text-white hover:bg-white/[0.05] transition-colors es-focus-ring"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            <button
              type="button"
              onClick={() => void runAnalysisPipeline()}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-6 py-3 text-sm font-medium text-[#06120f] hover:bg-emerald-300 transition-colors es-focus-ring"
            >
              <Sparkles className="h-4 w-4" />
              Analyze Hazard
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="es-fade-up flex flex-col items-center justify-center py-24 text-center">
          {pipelineError ? (
            <div className="w-full max-w-md">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-400/10 border border-red-400/20">
                <AlertTriangle className="h-7 w-7 text-red-400" />
              </div>
              <p className="mt-5 text-lg font-medium text-white">Analysis couldn&apos;t complete</p>
              <p role="alert" className="mt-2 text-sm text-zinc-400">
                {pipelineError.message}
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/[0.05] transition-colors es-focus-ring"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
                {pipelineError.retryable && (
                  <button
                    type="button"
                    onClick={() => void runAnalysisPipeline()}
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-medium text-[#06120f] hover:bg-emerald-300 transition-colors es-focus-ring"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Try Again
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="relative flex h-20 w-20 items-center justify-center">
                <span className="absolute inset-0 rounded-full border-2 border-emerald-400/20" />
                <Loader2 className="h-10 w-10 animate-spin text-emerald-400" />
              </div>
              <p className="mt-8 text-lg font-medium text-white" role="status" aria-live="polite">
                {activeStageLabel(stages)}
              </p>
              <div className="mt-6 flex flex-col gap-2 w-full max-w-xs text-left">
                <StageRow label="Resolving location" state={stages.locate} />
                <StageRow label="Analyzing image with AI" state={stages.ai} />
                <StageRow label="Fetching weather forecast" state={stages.weather} />
                <StageRow label="Modeling terrain water flow" state={stages.terrain} />
                <StageRow label="Calculating risk" state={stages.risk} />
              </div>
            </>
          )}
        </div>
      )}

      {step === 4 && analysis && weather && (
        <div className="es-fade-up">
          <h1 className="text-3xl font-semibold text-white tracking-tight">
            Environmental Intelligence
          </h1>
          <p className="mt-2 text-zinc-400">
            Here&apos;s what the AI detected in your photo, combined with real current
            environmental conditions for this location.
          </p>

          {weather.isFallback && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-yellow-400/20 bg-yellow-400/5 px-3 py-1.5 text-xs text-yellow-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              Live weather data unavailable right now — showing fallback environmental data.
            </p>
          )}

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="es-card rounded-3xl p-6">
              <h3 className="text-xs font-medium uppercase tracking-wider text-emerald-400">
                AI Hazard Analysis
              </h3>
              <dl className="mt-4 flex flex-col gap-3 text-sm">
                <Row label="Hazard Type" value={analysis.hazardType} />
                <Row label="Observed Material" value={analysis.observedMaterial} />
                <Row
                  label="Severity"
                  value={analysis.severityLabel + " (" + analysis.severityScore + "/100)"}
                  valueClass={riskTextClass(analysis.severityLabel)}
                />
                <Row label="Model Confidence" value={analysis.confidence + "%"} />
                <Row label="Environmental Impact" value={analysis.environmentalImpact} />
              </dl>
              {analysis.visibleIndicators.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {analysis.visibleIndicators.map((indicator) => (
                    <span
                      key={indicator}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-300"
                    >
                      {indicator}
                    </span>
                  ))}
                </div>
              )}
              {analysis.reasoning && (
                <p className="mt-4 text-xs text-zinc-500 leading-relaxed">{analysis.reasoning}</p>
              )}
            </div>

            <div className="es-card rounded-3xl p-6">
              <h3 className="text-xs font-medium uppercase tracking-wider text-emerald-400">
                Environmental Conditions
              </h3>
              <dl className="mt-4 flex flex-col gap-3 text-sm">
                <Row label="Current Weather" value={weather.weatherDescription} />
                <Row label="Current Rainfall" value={weather.currentRainfall + " mm"} />
                <Row label="Forecast Rainfall" value={weather.forecastRainfall + " mm"} />
                <Row label="Rain Probability" value={weather.rainProbability + "%"} />
                <Row
                  label="Time Until Rain"
                  value={weather.rainfallHours === null ? "Not expected soon" : weather.rainfallHours + "h"}
                />
              </dl>
            </div>
          </div>

          <div className="mt-8 flex justify-between">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm font-medium text-white hover:bg-white/[0.05] transition-colors es-focus-ring"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(5)}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-6 py-3 text-sm font-medium text-[#06120f] hover:bg-emerald-300 transition-colors es-focus-ring"
            >
              See Risk Forecast
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {step === 5 && risk && analysis && weather && resolvedLocation && (() => {
        const previewReport = buildPreviewReport(
          analysis,
          weather,
          terrain,
          risk,
          hazardTypeLabel,
          description,
          resolvedLocation,
          {
            reportCreatedAt: new Date().toISOString(),
            aiAnalyzedAt: aiAnalyzedAt,
            weatherFetchedAt: weather.fetchedAt,
            terrainAnalyzedAt: terrainAnalyzedAt,
            riskCalculatedAt: riskCalculatedAt,
            riskEngineVersion: RISK_ENGINE_VERSION,
          }
        );
        // Detect cascades against already-persisted hazards, honestly
        // including this in-progress report (not yet saved) so the
        // demo can show "cascade detected" before the user clicks
        // Add to Priority Map — using only real terrain/location data.
        const previewNetwork = buildHazardNetwork([...getHazards(), previewReport]);
        const previewChain = previewNetwork.chains.find((c) =>
          c.memberIds.includes(previewReport.id)
        );

        return (
        <div className="es-fade-up">
          <h1 className="text-3xl font-semibold text-white tracking-tight">
            Current vs Projected Risk
          </h1>
          <p className="mt-2 text-zinc-400">
            See how this hazard could change as environmental conditions evolve.
          </p>

          <div className="mt-8 flex flex-col gap-6">
            <RiskTransformation report={previewReport} />
            <RiskExplanation factors={risk.factors} />
            <TerrainInsight terrain={terrain} />

            {previewChain && (
              <>
                <ChainAlert network={previewNetwork} hazards={[...getHazards(), previewReport]} />
                <CascadeScenarios
                  chain={previewChain}
                  network={previewNetwork}
                  hazards={[...getHazards(), previewReport]}
                />
              </>
            )}

            <InterventionWindow report={previewReport} />
            <InterventionSimulator report={previewReport} />
            <RecommendedAction report={previewReport} />
            <RiskTimeline report={previewReport} />
          </div>

          {submitError && (
            <p role="alert" className="mt-4 flex items-center gap-2 text-sm text-red-400">
              <AlertTriangle className="h-4 w-4" /> {submitError}
            </p>
          )}

          <div className="mt-8 flex justify-between">
            <button
              type="button"
              onClick={() => setStep(4)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm font-medium text-white hover:bg-white/[0.05] transition-colors es-focus-ring"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            <button
              type="button"
              onClick={handleAddToPriorityMap}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-6 py-3 text-sm font-medium text-[#06120f] hover:bg-emerald-300 transition-colors es-focus-ring disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
              Add to Priority Map
            </button>
          </div>
        </div>
        );
      })()}
    </div>
  );
}

function buildPreviewReport(
  analysis: HazardAnalysis,
  weather: WeatherData,
  terrain: TerrainAnalysis | null,
  risk: RiskResult,
  hazardTypeLabel: string,
  description: string,
  resolvedLocation: ResolvedLocation,
  provenance: HazardReport["provenance"]
): HazardReport {
  return {
    id: "preview",
    createdAt: new Date().toISOString(),
    name: hazardTypeLabel,
    type: hazardTypeLabel,
    description,
    locationLabel: resolvedLocation.label,
    latitude: resolvedLocation.lat,
    longitude: resolvedLocation.lng,
    locationSource: resolvedLocation.source,
    analysis,
    weather,
    terrain,
    provenance,
    risk: {
      currentRisk: risk.currentRisk,
      projectedRisk: risk.projectedRisk,
      currentLabel: risk.currentLabel,
      projectedLabel: risk.projectedLabel,
      factors: risk.factors,
      weatherEscalation: risk.weatherEscalation,
    },
    isSeed: false,
  };
}

function describeAnalysisError(err: HazardAnalysisError): string {
  switch (err.code) {
    case "CONFIG_MISSING":
      return "AI analysis isn't configured on this server yet. Add a free GEMINI_API_KEY to .env.local (get one at aistudio.google.com/apikey) and restart the app.";
    case "IMAGE_TOO_LARGE":
      return "This image is too large to analyze. Try a smaller photo.";
    case "AI_PROVIDER_ERROR":
      return "The AI provider returned an error. Please try again in a moment.";
    case "AI_MALFORMED_RESPONSE":
      return "The AI response couldn't be understood. Please try again.";
    case "NETWORK_ERROR":
      return "Couldn't reach the analysis service. Check your connection and try again.";
    default:
      return err.message || "Hazard analysis failed.";
  }
}

function activeStageLabel(stages: PipelineStages): string {
  if (stages.locate === "active") return "Resolving location...";
  if (stages.ai === "active" && stages.weather === "active")
    return "Analyzing image, weather and terrain...";
  if (stages.ai === "active") return "Analyzing image with AI...";
  if (stages.weather === "active") return "Fetching weather forecast...";
  if (stages.terrain === "active") return "Modeling terrain water flow...";
  if (stages.risk === "active") return "Calculating risk...";
  return "Working...";
}

function StageRow({ label, state }: { label: string; state: StageState }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {state === "done" ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
      ) : state === "active" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400 shrink-0" />
      ) : state === "error" ? (
        <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
      ) : (
        <span className="h-3.5 w-3.5 rounded-full border border-white/15 shrink-0" />
      )}
      <span
        className={
          state === "done" || state === "active"
            ? "text-zinc-300"
            : state === "error"
              ? "text-red-400"
              : "text-zinc-600"
        }
      >
        {label}
      </span>
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

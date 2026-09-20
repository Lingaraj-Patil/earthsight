import Link from "next/link";
import {
  Camera,
  Sparkles,
  MapPin,
  CloudRain,
  Mountain,
  Calculator,
  Waves,
  Wrench,
  ListOrdered,
  ArrowRight,
} from "lucide-react";

type Stage = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  input: string;
  process: string;
  output: string;
};

const STAGES: Stage[] = [
  {
    icon: Camera,
    title: "1. Citizen Evidence",
    input: "A photo taken with a phone camera.",
    process: "Client-side compression: resized to a max 1600px edge and re-encoded as JPEG.",
    output: "A compact image payload ready for real analysis, sized to fit storage and API limits.",
  },
  {
    icon: Sparkles,
    title: "2. AI Hazard Analysis",
    input: "The compressed image, sent to a server-only route.",
    process:
      "Google Gemini's vision model analyzes the actual image and returns structured JSON: hazard type, material, severity, confidence, indicators, reasoning.",
    output: "A real HazardAnalysis object — no lookup table, no fabricated confidence.",
  },
  {
    icon: MapPin,
    title: "3. Location",
    input: "Browser GPS coordinates, or a typed address.",
    process:
      "GPS is used directly. A typed address is forward-geocoded via Open-Meteo's Geocoding API. Neither path falls back to a default coordinate — geocoding failure blocks the pipeline with an explicit error.",
    output: "Real latitude/longitude, tagged with their source (gps / geocoded).",
  },
  {
    icon: CloudRain,
    title: "4. Weather",
    input: "The real coordinates from step 3.",
    process:
      "Open-Meteo's Forecast API returns current precipitation and an hourly forecast, scanned for the first hour crossing a meaningful rain threshold.",
    output: "Current rainfall, forecast rainfall, rain probability, hours until rain.",
  },
  {
    icon: Mountain,
    title: "5. Terrain",
    input: "81 real elevation samples across a 9×9 grid (≈480m window) centered on the hazard.",
    process:
      "D8 steepest-descent flow routing, then flow accumulation processed highest-to-lowest elevation — computed locally, not an API call.",
    output: "Depression depth, upslope catchment size, mean slope, and a 0-1 flood exposure score.",
  },
  {
    icon: Calculator,
    title: "6. Risk Engine",
    input: "AI severity, weather, terrain, and the reporter's hazard category.",
    process:
      "A deterministic weighted sum, with every contribution logged as a RiskFactor. Forecast-driven escalation is only added when rainfall or probability clears a real significance threshold.",
    output: "Current risk, projected risk, and the full factor list behind both.",
  },
  {
    icon: Waves,
    title: "7. Cascade Detection",
    input: "Every hazard with real terrain data.",
    process:
      "Pairwise haversine distance, elevation drop, and gradient checks build a directed graph; connected components become hazard chains.",
    output: "Which hazards share a drainage path, in what order, and the outlet's compounded risk.",
  },
  {
    icon: Wrench,
    title: "8. Intervention Simulation",
    input: "The report's real RiskFactor list and a category-scoped intervention.",
    process:
      "Matched factor contributions are reduced by a fixed, documented fraction and the same clamp/combine logic the risk engine uses is re-run.",
    output: "A real simulated current/projected risk if the intervention were taken.",
  },
  {
    icon: ListOrdered,
    title: "9. Priority Action",
    input: "Projected risk, rainfall urgency, AI confidence, and cascade involvement.",
    process:
      "A transparent point formula (documented in lib/actionPriority.ts) — every point is named, not a black-box score.",
    output: "Low / Medium / High / Urgent, with the reasons listed alongside it.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="pt-32 pb-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1 text-xs text-emerald-300">
          Engineering breakdown, not marketing copy
        </span>
        <h1 className="mt-5 text-4xl font-semibold text-white tracking-tight">
          How EarthSight actually works
        </h1>
        <p className="mt-4 text-zinc-400">
          Nine real stages, each with a real input, a real process, and a real output. No stage
          here is decorative.
        </p>
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 mt-14 flex flex-col gap-4">
        {STAGES.map((stage, i) => {
          const Icon = stage.icon;
          return (
            <div key={stage.title} className="es-card rounded-3xl p-6 sm:p-7">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <h2 className="text-lg font-medium text-white">{stage.title}</h2>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">Input</p>
                  <p className="mt-1 text-zinc-300">{stage.input}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">Process</p>
                  <p className="mt-1 text-zinc-300">{stage.process}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-emerald-400">Output</p>
                  <p className="mt-1 text-white">{stage.output}</p>
                </div>
              </div>
              {i < STAGES.length - 1 && (
                <div className="mt-5 flex justify-center text-zinc-600">
                  <ArrowRight className="h-4 w-4 rotate-90" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 mt-12 text-center">
        <Link
          href="/report"
          className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-6 py-3 text-sm font-medium text-[#06120f] hover:bg-emerald-300 transition-colors"
        >
          Try it — Report a Hazard
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

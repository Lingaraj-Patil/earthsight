import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";

/**
 * Turns the AI's own returned confidence into honest, hedged language
 * instead of a bare percentage. The confidence value itself is never
 * altered here — this only changes how it's communicated.
 */
export default function ConfidenceNotice({ confidence }: { confidence: number }) {
  if (confidence < 50) {
    return (
      <div className="flex items-start gap-2.5 rounded-2xl border border-yellow-400/20 bg-yellow-400/[0.06] px-4 py-3">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-yellow-400" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-yellow-300">
            Low Confidence ({confidence}%)
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            The image doesn&apos;t provide enough clear visual evidence to confidently classify
            this hazard. Consider uploading a clearer or closer photo.
          </p>
        </div>
      </div>
    );
  }

  if (confidence < 75) {
    return (
      <div className="flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <HelpCircle className="h-4 w-4 shrink-0 mt-0.5 text-zinc-400" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Medium Confidence ({confidence}%)
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            Some visual indicators are ambiguous. The classification is reasonable but not
            certain.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3">
      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
          High Confidence ({confidence}%)
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          Multiple visual indicators support this classification.
        </p>
      </div>
    </div>
  );
}

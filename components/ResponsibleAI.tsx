import { ShieldAlert } from "lucide-react";

export default function ResponsibleAI() {
  return (
    <div className="rounded-3xl border border-white/8 bg-white/[0.02] p-6 sm:p-7">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-zinc-400" />
        <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
          Responsible Use
        </h3>
      </div>
      <ul className="mt-4 flex flex-col gap-2 text-xs text-zinc-500 leading-relaxed">
        <li>AI hazard analysis is advisory and based on a single photo — it is not ground truth.</li>
        <li>Visual model confidence reflects image clarity, not certainty about the real world.</li>
        <li>Weather forecasts are inherently uncertain and can change after this report was analyzed.</li>
        <li>Terrain analysis uses sampled elevation data — a real approximation, not a survey-grade model.</li>
        <li>Risk scores are decision-support estimates, not predictions of disaster with any stated accuracy.</li>
        <li>For active emergencies, contact local authorities — do not rely on this tool alone.</li>
      </ul>
    </div>
  );
}

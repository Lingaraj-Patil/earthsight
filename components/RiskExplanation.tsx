"use client";

import { RiskFactor } from "@/types/hazard";
import { Plus } from "lucide-react";

export default function RiskExplanation({ factors }: { factors: RiskFactor[] }) {
  if (!factors.length) return null;

  return (
    <div className="es-card rounded-3xl p-6 sm:p-7">
      <h3 className="text-xs font-medium uppercase tracking-wider text-emerald-400">
        Why did the risk change?
      </h3>
      <ul className="mt-5 flex flex-col gap-4">
        {factors.map((factor, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-400">
              <Plus className="h-3 w-3" strokeWidth={3} />
            </span>
            <div>
              <p className="text-sm text-white">
                {factor.label}
                <span className="ml-2 text-xs font-medium text-emerald-400">
                  +{factor.contribution}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-zinc-500 leading-relaxed">{factor.explanation}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

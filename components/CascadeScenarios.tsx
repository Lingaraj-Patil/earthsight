"use client";

import { HazardChain, HazardNetwork } from "@/lib/cascade";
import { HazardReport } from "@/types/hazard";
import { planCascadeInterventions } from "@/lib/cascadeIntervention";
import { riskTextClass } from "@/lib/riskDisplay";
import { Waves } from "lucide-react";

export default function CascadeScenarios({
  chain,
  network,
  hazards,
}: {
  chain: HazardChain;
  network: HazardNetwork;
  hazards: HazardReport[];
}) {
  const scenarios = planCascadeInterventions(chain, network, hazards);
  if (!scenarios.length) return null;

  const worst = Math.max(...scenarios.map((s) => s.projectedOutletRisk));

  return (
    <div className="es-card rounded-3xl p-6 sm:p-7">
      <div className="flex items-center gap-2">
        <Waves className="h-4 w-4 text-sky-300" />
        <h3 className="text-xs font-medium uppercase tracking-wider text-emerald-400">
          Cascade Response — Outlet Scenarios
        </h3>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        {chain.memberIds.length} hazards connected. Each scenario below is a real recalculation
        of the outlet&apos;s compounded risk — not a ranked recommendation.
      </p>

      <div className="mt-5 flex flex-col gap-3">
        {scenarios.map((s) => (
          <div
            key={s.id}
            className="rounded-2xl border border-white/8 bg-white/[0.02] p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-white">{s.label}</p>
              {s.simulatable ? (
                <p className={`text-lg font-semibold ${riskTextClass(s.projectedOutletLabel)}`}>
                  {s.projectedOutletRisk}
                </p>
              ) : (
                <span className="text-xs text-zinc-500">not simulatable</span>
              )}
            </div>

            {s.simulatable && (
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400"
                  style={{ width: `${(s.projectedOutletRisk / Math.max(worst, 1)) * 100}%` }}
                />
              </div>
            )}

            <p className="mt-2 text-xs text-zinc-500">{s.description || s.note}</p>

            {s.simulatable && s.id !== "do-nothing" && (
              <p className="mt-1 text-xs text-emerald-400">−{s.riskReduction} points vs. doing nothing</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

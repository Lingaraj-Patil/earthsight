"use client";

import { HazardNetwork } from "@/lib/cascade";
import { HazardReport } from "@/types/hazard";
import { Waves, ArrowRight } from "lucide-react";
import Link from "next/link";

/**
 * Surfaces the systemic insight that a per-hazard list can't: groups of
 * blockages that sit on the same downhill drainage path, where clearing
 * order actually matters.
 */
export default function ChainAlert({
  network,
  hazards,
}: {
  network: HazardNetwork;
  hazards: HazardReport[];
}) {
  if (!network.chains.length) return null;

  const byId = new Map(hazards.map((h) => [h.id, h]));
  const chain = network.chains[0]; // highest peak projected risk
  const outlet = byId.get(chain.outletId);
  const outletNode = network.nodes[chain.outletId];

  if (!outlet || !outletNode) return null;

  return (
    <div className="mx-3 mb-2 rounded-2xl border border-sky-400/25 bg-sky-400/[0.06] p-3.5">
      <div className="flex items-center gap-1.5">
        <Waves className="h-3.5 w-3.5 text-sky-300" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-sky-300">
          Hazard chain detected
        </span>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-zinc-300">
        {chain.memberIds.length} hazards share one drainage path. Water from the upstream
        blockages arrives at{" "}
        <span className="font-medium text-white">{outlet.analysis.hazardType}</span>, which is
        already obstructed.
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-1 text-[11px] text-zinc-400">
        {chain.orderedIds.map((id, i) => {
          const h = byId.get(id);
          if (!h) return null;
          const isOutlet = id === chain.outletId;
          return (
            <span key={id} className="flex items-center gap-1">
              {i > 0 && <ArrowRight className="h-3 w-3 text-sky-400/60" />}
              <span
                className={
                  isOutlet
                    ? "rounded bg-sky-400/20 px-1.5 py-0.5 font-medium text-sky-200"
                    : "rounded bg-white/5 px-1.5 py-0.5"
                }
              >
                {h.terrain ? `${Math.round(h.terrain.centerElevation)}m` : "—"}
              </span>
            </span>
          );
        })}
      </div>

      {outletNode.amplification > 0 && (
        <p className="mt-2.5 text-xs text-zinc-400">
          Compounded risk at the outlet:{" "}
          <span className="font-semibold text-sky-300">
            {outletNode.compoundedProjectedRisk}
          </span>{" "}
          <span className="text-zinc-600">
            ({outlet.risk.projectedRisk} + {outletNode.amplification} from{" "}
            {outletNode.upstreamCount} upstream)
          </span>
        </p>
      )}

      <p className="mt-2 text-[11px] text-zinc-500">
        Clear upstream first — clearing the outlet alone will refill.
      </p>

      <Link
        href={`/report?id=${outlet.id}`}
        className="mt-2.5 inline-block text-[11px] font-medium text-sky-300 hover:text-sky-200"
      >
        View outlet hazard →
      </Link>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { getHazards } from "@/lib/storage";
import { buildHazardNetwork } from "@/lib/cascade";
import { HazardReport } from "@/types/hazard";

/**
 * Reads real persisted hazards from localStorage and shows real counts.
 * No number here is invented — if storage is empty, this shows an honest
 * empty state rather than a placeholder metric.
 */
export default function LiveStats() {
  const [hazards, setHazards] = useState<HazardReport[] | null>(null);

  useEffect(() => {
    setHazards(getHazards());
  }, []);

  if (hazards === null) return null; // avoid SSR/CSR flash of zero

  const community = hazards.filter((h) => !h.isSeed);
  const critical = hazards.filter((h) => h.risk.projectedLabel === "Critical");
  const network = buildHazardNetwork(hazards);

  if (community.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-8 text-center">
        <p className="text-sm text-zinc-400">
          No community reports yet on this device.{" "}
          <span className="text-emerald-400">Be the first to report a hazard.</span>
        </p>
        <p className="mt-1 text-xs text-zinc-600">
          ({hazards.length} sample incident{hazards.length === 1 ? "" : "s"} shown on the map for
          demonstration.)
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <Stat value={community.length} label="Community Reports" />
      <Stat value={critical.length} label="Critical Risks" />
      <Stat value={network.chains.length} label="Active Cascades" />
      <Stat value={hazards.length} label="Reports Analyzed" />
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-5 text-center">
      <p className="text-2xl font-semibold text-emerald-400">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{label}</p>
    </div>
  );
}

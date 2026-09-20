"use client";

import { getHazardTypeIdFromLabel } from "@/lib/hazardTypes";
import { consequencesFor } from "@/lib/environmentalConsequences";
import { ArrowDownRight } from "lucide-react";

export default function WhyThisMatters({ hazardTypeLabel }: { hazardTypeLabel: string }) {
  const categoryId = getHazardTypeIdFromLabel(hazardTypeLabel);
  const consequences = consequencesFor(categoryId);

  return (
    <div className="es-card rounded-3xl p-6 sm:p-7">
      <h3 className="text-xs font-medium uppercase tracking-wider text-emerald-400">
        Why This Matters
      </h3>
      <ul className="mt-4 flex flex-col gap-2.5">
        {consequences.map((c) => (
          <li key={c} className="flex items-start gap-2 text-sm text-zinc-300">
            <ArrowDownRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-zinc-500" />
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}

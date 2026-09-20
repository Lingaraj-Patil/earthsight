"use client";

import { HazardReport } from "@/types/hazard";
import { getRecommendedAction } from "@/lib/recommendedAction";
import { ClipboardCheck } from "lucide-react";

export default function RecommendedAction({ report }: { report: HazardReport }) {
  const action = getRecommendedAction(report.type, report.risk);

  return (
    <div className="es-card rounded-3xl p-6 sm:p-7">
      <h3 className="text-xs font-medium uppercase tracking-wider text-emerald-400">
        Recommended Action
      </h3>
      <div className="mt-4 flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-400">
          <ClipboardCheck className="h-4 w-4" />
        </span>
        <p className="text-sm text-white leading-relaxed">{action}</p>
      </div>
    </div>
  );
}

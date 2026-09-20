"use client";

import { CloudRain, MapPin, TrendingUp, TriangleAlert } from "lucide-react";

/**
 * Purely visual dashboard preview for the homepage hero. Static, illustrative
 * data only — not connected to live storage. Communicates the product at a
 * glance: a map with risk markers, a rain-approaching signal, and hazard
 * cards showing current vs projected risk.
 */
export default function HeroDashboard() {
  return (
    <div className="relative rounded-3xl border border-white/10 bg-[#0c1916]/80 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden es-fade-up">
      {/* top bar */}
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald-300/90">
          <CloudRain className="h-3.5 w-3.5" />
          Rain forecast in 6h
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5">
        {/* illustrative static map area, not connected to real data */}
        <div className="sm:col-span-3 relative h-64 sm:h-80 bg-[radial-gradient(circle_at_30%_20%,rgba(52,211,153,0.12),transparent_55%),radial-gradient(circle_at_70%_70%,rgba(248,113,113,0.10),transparent_50%)] border-b sm:border-b-0 sm:border-r border-white/5">
          <svg className="absolute inset-0 h-full w-full opacity-30" aria-hidden="true">
            <defs>
              <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
                <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* markers */}
          <div className="absolute left-[22%] top-[35%] flex flex-col items-center">
            <span className="h-4 w-4 rounded-full bg-red-400 es-pulse ring-2 ring-red-300/50" />
          </div>
          <div className="absolute left-[55%] top-[55%] flex flex-col items-center">
            <span className="h-3.5 w-3.5 rounded-full bg-orange-400 ring-2 ring-orange-300/40" />
          </div>
          <div className="absolute left-[70%] top-[25%] flex flex-col items-center">
            <span className="h-3 w-3 rounded-full bg-yellow-400 ring-2 ring-yellow-300/40" />
          </div>
          <div className="absolute left-[40%] top-[70%] flex flex-col items-center">
            <span className="h-3 w-3 rounded-full bg-green-400 ring-2 ring-green-300/40" />
          </div>

          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-[10px] text-zinc-300 backdrop-blur">
            <MapPin className="h-3 w-3 text-emerald-400" />
            Bengaluru Priority Map
          </div>
        </div>

        {/* hazard cards */}
        <div className="sm:col-span-2 flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-zinc-500">
            <span>Priority Incidents</span>
            <span className="text-emerald-400">Projected</span>
          </div>

          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wide text-red-300">
                Priority 1
              </span>
              <TriangleAlert className="h-3.5 w-3.5 text-red-300" />
            </div>
            <p className="mt-1 text-sm font-medium text-white">Drainage Obstruction</p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-lg font-semibold text-red-300">91</span>
              <span className="text-[11px] text-red-300/80">CRITICAL</span>
              <span className="ml-auto flex items-center gap-1 text-[10px] text-zinc-400">
                <TrendingUp className="h-3 w-3" /> from 54
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-orange-400/20 bg-orange-400/[0.06] p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wide text-orange-300">
                Priority 2
              </span>
            </div>
            <p className="mt-1 text-sm font-medium text-white">Illegal Waste Dumping</p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-lg font-semibold text-orange-300">82</span>
              <span className="text-[11px] text-orange-300/80">HIGH</span>
            </div>
          </div>

          <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/[0.06] p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wide text-yellow-300">
                Priority 3
              </span>
            </div>
            <p className="mt-1 text-sm font-medium text-white">Blocked Runoff Channel</p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-lg font-semibold text-yellow-300">76</span>
              <span className="text-[11px] text-yellow-300/80">HIGH</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

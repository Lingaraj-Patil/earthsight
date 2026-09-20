"use client";

import { HazardReport, RiskLabel } from "@/types/hazard";
import { HAZARD_TYPES, getHazardTypeIdFromLabel } from "@/lib/hazardTypes";
import { SlidersHorizontal, X } from "lucide-react";

export type MapFilterState = {
  riskLevel: RiskLabel | "all";
  source: "all" | "community" | "sample";
  hazardTypeIds: Set<string>; // empty set = all
  weatherSensitiveOnly: boolean;
  terrainSensitiveOnly: boolean;
  chainMembersOnly: boolean;
};

export const DEFAULT_MAP_FILTERS: MapFilterState = {
  riskLevel: "all",
  source: "all",
  hazardTypeIds: new Set(),
  weatherSensitiveOnly: false,
  terrainSensitiveOnly: false,
  chainMembersOnly: false,
};

/** Real thresholds, not decorative — same scale the risk engine itself
 * uses for hazard-category sensitivity and terrain flood exposure. */
const WEATHER_SENSITIVE_THRESHOLD = 0.7;
const TERRAIN_SENSITIVE_THRESHOLD = 0.5;

export function applyMapFilters(
  hazards: HazardReport[],
  filters: MapFilterState,
  mode: "current" | "projected",
  chainMemberIds: Set<string>
): HazardReport[] {
  return hazards.filter((h) => {
    const label = mode === "current" ? h.risk.currentLabel : h.risk.projectedLabel;
    if (filters.riskLevel !== "all" && label !== filters.riskLevel) return false;

    if (filters.source === "community" && h.isSeed) return false;
    if (filters.source === "sample" && !h.isSeed) return false;

    if (filters.hazardTypeIds.size > 0) {
      const catId = getHazardTypeIdFromLabel(h.type);
      if (!filters.hazardTypeIds.has(catId)) return false;
    }

    if (filters.weatherSensitiveOnly) {
      const catId = getHazardTypeIdFromLabel(h.type);
      const sensitivity = HAZARD_TYPES.find((t) => t.id === catId)?.rainSensitivity ?? 0;
      if (sensitivity < WEATHER_SENSITIVE_THRESHOLD) return false;
    }

    if (filters.terrainSensitiveOnly) {
      if (!h.terrain || h.terrain.floodExposure < TERRAIN_SENSITIVE_THRESHOLD) return false;
    }

    if (filters.chainMembersOnly && !chainMemberIds.has(h.id)) return false;

    return true;
  });
}

export default function MapFilters({
  filters,
  onChange,
  open,
  onClose,
}: {
  filters: MapFilterState;
  onChange: (f: MapFilterState) => void;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  const toggleHazardType = (id: string) => {
    const next = new Set(filters.hazardTypeIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ ...filters, hazardTypeIds: next });
  };

  return (
    <div className="border-b border-white/5 bg-[#0c1916] px-4 sm:px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onChange(DEFAULT_MAP_FILTERS)}
            className="text-xs text-zinc-500 hover:text-white"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="text-zinc-500 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-4">
        <FilterGroup label="Risk Level">
          {(["all", "Low", "Moderate", "High", "Critical"] as const).map((level) => (
            <Pill
              key={level}
              active={filters.riskLevel === level}
              onClick={() => onChange({ ...filters, riskLevel: level })}
            >
              {level === "all" ? "All" : level}
            </Pill>
          ))}
        </FilterGroup>

        <FilterGroup label="Source">
          <Pill active={filters.source === "all"} onClick={() => onChange({ ...filters, source: "all" })}>
            All
          </Pill>
          <Pill
            active={filters.source === "community"}
            onClick={() => onChange({ ...filters, source: "community" })}
          >
            Community
          </Pill>
          <Pill
            active={filters.source === "sample"}
            onClick={() => onChange({ ...filters, source: "sample" })}
          >
            Sample
          </Pill>
        </FilterGroup>

        <FilterGroup label="Hazard Type">
          {HAZARD_TYPES.map((t) => (
            <Pill key={t.id} active={filters.hazardTypeIds.has(t.id)} onClick={() => toggleHazardType(t.id)}>
              {t.label}
            </Pill>
          ))}
        </FilterGroup>

        <FilterGroup label="Sensitivity">
          <Pill
            active={filters.weatherSensitiveOnly}
            onClick={() =>
              onChange({ ...filters, weatherSensitiveOnly: !filters.weatherSensitiveOnly })
            }
          >
            Weather-sensitive
          </Pill>
          <Pill
            active={filters.terrainSensitiveOnly}
            onClick={() =>
              onChange({ ...filters, terrainSensitiveOnly: !filters.terrainSensitiveOnly })
            }
          >
            Terrain-sensitive
          </Pill>
          <Pill
            active={filters.chainMembersOnly}
            onClick={() => onChange({ ...filters, chainMembersOnly: !filters.chainMembersOnly })}
          >
            In a hazard chain
          </Pill>
        </FilterGroup>
      </div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-zinc-600 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5 max-w-md">{children}</div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors es-focus-ring ${
        active
          ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300"
          : "border-white/10 bg-white/[0.02] text-zinc-400 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

"use client";

import { Suspense, useEffect, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import type { Map as LeafletMap } from "leaflet";
import { CheckCircle2, X, Radar, TrendingUp, Gauge, Waves, SlidersHorizontal } from "lucide-react";

import { getHazards, clearNewStatus } from "@/lib/storage";
import { HazardReport, RiskMode } from "@/types/hazard";
import PriorityPanel from "@/components/PriorityPanel";
import { buildHazardNetwork } from "@/lib/cascade";
import ChainAlert from "@/components/ChainAlert";
import CascadeScenarios from "@/components/CascadeScenarios";
import MapFilters, { DEFAULT_MAP_FILTERS, MapFilterState, applyMapFilters } from "@/components/MapFilters";
import HazardQuickPanel from "@/components/HazardQuickPanel";

const PriorityMap = dynamic(() => import("@/components/PriorityMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-zinc-500 text-sm">
      Loading environmental intelligence...
    </div>
  ),
});

function MapPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const focusId = searchParams.get("focus") ?? undefined;
  const showToast = searchParams.get("toast") === "1";

  const [hazards, setHazards] = useState<HazardReport[]>([]);
  const [mode, setMode] = useState<RiskMode>("projected");
  const [selectedId, setSelectedId] = useState<string | undefined>(focusId);
  const [toastVisible, setToastVisible] = useState(showToast);
  const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null);
  const [showChains, setShowChains] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<MapFilterState>(DEFAULT_MAP_FILTERS);

  useEffect(() => {
    setHazards(getHazards());
  }, []);

  useEffect(() => {
    if (focusId) {
      setSelectedId(focusId);
      clearNewStatus(focusId);
    }
  }, [focusId]);

  useEffect(() => {
    if (!toastVisible) return;
    const t = setTimeout(() => setToastVisible(false), 5000);
    return () => clearTimeout(t);
  }, [toastVisible]);

  const dismissToast = () => {
    setToastVisible(false);
    router.replace("/map", { scroll: false });
  };

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedId(id);
      const report = hazards.find((h) => h.id === id);
      if (report && mapInstance) {
        mapInstance.flyTo([report.latitude, report.longitude], 15, { duration: 1 });
      }
    },
    [hazards, mapInstance]
  );

  // Chain membership is a physical fact about the full dataset, computed
  // before filtering so the "in a chain" filter can actually select for it.
  const fullNetwork = useMemo(() => buildHazardNetwork(hazards), [hazards]);
  const chainMemberIds = useMemo(
    () => new Set(fullNetwork.chains.flatMap((c) => c.memberIds)),
    [fullNetwork]
  );

  // Real filtering of the real displayed dataset — every toggle in
  // MapFilters changes what's actually rendered on the map and in the
  // priority panel, not just CSS.
  const filteredHazards = useMemo(
    () => applyMapFilters(hazards, filters, mode, chainMemberIds),
    [hazards, filters, mode, chainMemberIds]
  );

  // Map/panel/cascade features operate on the filtered set, so hazard
  // chains shown are always among what's actually visible.
  const network = useMemo(() => buildHazardNetwork(filteredHazards), [filteredHazards]);

  const activeFilterCount =
    (filters.riskLevel !== "all" ? 1 : 0) +
    (filters.source !== "all" ? 1 : 0) +
    filters.hazardTypeIds.size +
    (filters.weatherSensitiveOnly ? 1 : 0) +
    (filters.terrainSensitiveOnly ? 1 : 0) +
    (filters.chainMembersOnly ? 1 : 0);

  const selectedReport = filteredHazards.find((h) => h.id === selectedId);

  const stats = useMemo(() => {
    const critical = filteredHazards.filter((h) => (mode === "current" ? h.risk.currentLabel : h.risk.projectedLabel) === "Critical").length;
    const high = filteredHazards.filter((h) => (mode === "current" ? h.risk.currentLabel : h.risk.projectedLabel) === "High").length;
    return { total: filteredHazards.length, high, critical, allTotal: hazards.length };
  }, [filteredHazards, hazards, mode]);

  return (
    <div className="pt-16 h-screen flex flex-col">
      {/* Toolbar */}
      <div className="border-b border-white/5 bg-[#07110f] px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Radar className="h-5 w-5 text-emerald-400" />
          <h1 className="text-sm font-semibold text-white">Live Priority Map</h1>
          <span className="hidden sm:inline text-xs text-zinc-500">
            {stats.total} reports
            {stats.total !== stats.allTotal ? ` of ${stats.allTotal}` : ""} ·{" "}
            {stats.critical} critical · {stats.high} high
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-pressed={filtersOpen}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors es-focus-ring ${
              filtersOpen || activeFilterCount > 0
                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-0.5 rounded-full bg-emerald-400/20 px-1.5 text-[10px]">
                {activeFilterCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowChains((v) => !v)}
            aria-pressed={showChains}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors es-focus-ring ${
              showChains
                ? "border-sky-400/40 bg-sky-400/10 text-sky-300"
                : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white"
            }`}
          >
            <Waves className="h-3.5 w-3.5" />
            Hazard Chains
            {network.chains.length > 0 && (
              <span className="ml-0.5 rounded-full bg-sky-400/20 px-1.5 text-[10px]">
                {network.chains.length}
              </span>
            )}
          </button>

        <div className="flex items-center rounded-full border border-white/10 bg-white/[0.03] p-1 text-xs">
          <button
            type="button"
            onClick={() => setMode("current")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors es-focus-ring ${
              mode === "current" ? "bg-emerald-400 text-[#06120f]" : "text-zinc-400 hover:text-white"
            }`}
          >
            <Gauge className="h-3.5 w-3.5" />
            Current Risk
          </button>
          <button
            type="button"
            onClick={() => setMode("projected")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors es-focus-ring ${
              mode === "projected" ? "bg-emerald-400 text-[#06120f]" : "text-zinc-400 hover:text-white"
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Projected Risk
          </button>
        </div>
        </div>
      </div>

      <MapFilters
        filters={filters}
        onChange={setFilters}
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
      />

      {/* Map + panel */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <div className="relative flex-1 min-h-[50vh] lg:min-h-0">
          <PriorityMap
            hazards={filteredHazards}
            mode={mode}
            focusId={focusId}
            network={network}
            showChains={showChains}
            onMapReady={setMapInstance}
          />
          {selectedReport && (
            <HazardQuickPanel
              report={selectedReport}
              network={network}
              onClose={() => setSelectedId(undefined)}
            />
          )}
        </div>
        <aside className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-white/5 bg-[#07110f] min-h-[40vh] lg:min-h-0 overflow-y-auto">
          {filteredHazards.length === 0 && hazards.length > 0 && (
            <p className="px-4 py-6 text-center text-xs text-zinc-500">
              No hazards match the current filters.
            </p>
          )}
          {showChains && <ChainAlert network={network} hazards={filteredHazards} />}
          {showChains && network.chains[0] && (
            <div className="mx-3 mb-2">
              <CascadeScenarios chain={network.chains[0]} network={network} hazards={filteredHazards} />
            </div>
          )}
          <PriorityPanel
            hazards={filteredHazards}
            mode={mode}
            network={network}
            onSelect={handleSelect}
            selectedId={selectedId}
          />
        </aside>
      </div>

      {/* Success toast */}
      {toastVisible && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000] es-fade-up"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-[#0c1916] px-4 py-3 shadow-xl shadow-black/40">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-white">Hazard added successfully</p>
              <p className="text-xs text-zinc-500">EarthSight updated the priority map.</p>
            </div>
            <button
              type="button"
              onClick={dismissToast}
              aria-label="Dismiss"
              className="ml-2 text-zinc-500 hover:text-white es-focus-ring rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<div className="pt-32 text-center text-zinc-500">Loading map...</div>}>
      <MapPageInner />
    </Suspense>
  );
}

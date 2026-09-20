"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMap } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import Link from "next/link";
import { HazardReport, RiskMode } from "@/types/hazard";
import { RISK_COLOR } from "@/lib/riskDisplay";
import ReportSourceBadge from "@/components/ReportSourceBadge";
import { HazardNetwork } from "@/lib/cascade";

const BENGALURU_CENTER: [number, number] = [12.9716, 77.5946];

function scoreFor(report: HazardReport, mode: RiskMode): number {
  return mode === "current" ? report.risk.currentRisk : report.risk.projectedRisk;
}

function labelFor(report: HazardReport, mode: RiskMode) {
  return mode === "current" ? report.risk.currentLabel : report.risk.projectedLabel;
}

/** Imperative helper: flies the map to a hazard's coordinates once, when a
 * focusId is provided (e.g. right after a new report is submitted). */
function FlyToFocus({ report }: { report: HazardReport | undefined }) {
  const map = useMap();
  const hasFlown = useRef<string | null>(null);

  useEffect(() => {
    if (!report) return;
    if (hasFlown.current === report.id) return;
    hasFlown.current = report.id;
    map.flyTo([report.latitude, report.longitude], 15, { duration: 1.2 });
  }, [report, map]);

  return null;
}

/** Exposes the underlying Leaflet map instance to the parent so priority
 * cards can trigger flyTo on click. */
function MapRefBridge({ onReady }: { onReady: (map: LeafletMap) => void }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
}

export default function PriorityMap({
  hazards,
  mode,
  focusId,
  network,
  showChains,
  onMapReady,
}: {
  hazards: HazardReport[];
  mode: RiskMode;
  focusId?: string;
  network: HazardNetwork;
  showChains: boolean;
  onMapReady?: (map: LeafletMap) => void;
}) {
  const byId = new Map(hazards.map((h) => [h.id, h]));
  const focusReport = useMemo(
    () => hazards.find((h) => h.id === focusId),
    [hazards, focusId]
  );

  const center: [number, number] = focusReport
    ? [focusReport.latitude, focusReport.longitude]
    : BENGALURU_CENTER;

  return (
    <MapContainer
      center={center}
      zoom={12}
      scrollWheelZoom
      className="h-full w-full"
      attributionControl
    >
      <TileLayer
        // Standard OpenStreetMap raster tiles — no API key, no account,
        // and no "for evaluation only" watermark. The dark visual identity
        // comes from a CSS filter applied per-tile (see .map-tiles-dark in
        // globals.css), not from a paid/keyed dark-tile provider.
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        className="map-tiles-dark"
      />

      {onMapReady && <MapRefBridge onReady={onMapReady} />}
      <FlyToFocus report={focusReport} />

      {showChains &&
        network.links.map((link) => {
          const from = byId.get(link.fromId);
          const to = byId.get(link.toId);
          if (!from || !to) return null;
          return (
            <Polyline
              key={`${link.fromId}-${link.toId}`}
              positions={[
                [from.latitude, from.longitude],
                [to.latitude, to.longitude],
              ]}
              pathOptions={{
                color: "#38bdf8",
                weight: 2,
                opacity: 0.7,
                dashArray: "6 6",
              }}
            />
          );
        })}

      {hazards.map((report) => {
        const score = scoreFor(report, mode);
        const label = labelFor(report, mode);
        const color = RISK_COLOR[label];
        const isFocused = report.id === focusId;

        return (
          <CircleMarker
            key={report.id}
            center={[report.latitude, report.longitude]}
            radius={isFocused ? 14 : 9}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: isFocused ? 0.85 : 0.65,
              weight: isFocused ? 3 : 1.5,
            }}
          >
            <Popup>
              <div className="min-w-[200px]">
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <ReportSourceBadge isSeed={report.isSeed} />
                  {report.isNew && (
                    <span className="inline-block rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                      New
                    </span>
                  )}
                </div>
                <p className="font-medium text-white text-sm">{report.analysis.hazardType}</p>
                <p className="mt-1 text-xs text-zinc-400 line-clamp-2">
                  {report.description || report.locationLabel}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-lg font-semibold" style={{ color }}>
                    {score}
                  </span>
                  <span className="text-[11px] font-medium" style={{ color }}>
                    {label.toUpperCase()}
                  </span>
                </div>
                {(() => {
                  const node = network.nodes[report.id];
                  if (!node || node.upstreamCount === 0) return null;
                  return (
                    <p className="mt-1.5 rounded-lg bg-sky-400/10 px-2 py-1 text-[11px] text-sky-300">
                      {node.upstreamCount} blockage
                      {node.upstreamCount === 1 ? "" : "s"} upstream · compounded{" "}
                      {node.compoundedProjectedRisk}
                    </p>
                  );
                })()}
                <Link
                  href={`/report?id=${report.id}`}
                  className="mt-3 inline-flex items-center justify-center w-full rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-medium text-[#06120f] hover:bg-emerald-300"
                >
                  View Intelligence
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}

"use client";

import { HazardReport } from "@/types/hazard";
import { Sparkles, CloudRain, Mountain, MapPin, Cpu } from "lucide-react";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function DataProvenance({ report }: { report: HazardReport }) {
  const { provenance, terrain, locationSource } = report;

  return (
    <div className="es-card rounded-3xl p-6 sm:p-7">
      <h3 className="text-xs font-medium uppercase tracking-wider text-emerald-400">
        Data Provenance
      </h3>
      <p className="mt-2 text-xs text-zinc-500">
        Where every number on this page actually came from.
      </p>

      <div className="mt-4 flex flex-col gap-3 text-sm">
        <Row
          icon={<Sparkles className="h-3.5 w-3.5 text-emerald-400" />}
          label="AI Vision"
          value={`Google Gemini · analyzed ${timeAgo(provenance.aiAnalyzedAt)}`}
        />
        <Row
          icon={<CloudRain className="h-3.5 w-3.5 text-sky-300" />}
          label="Weather"
          value={`Open-Meteo · fetched ${timeAgo(provenance.weatherFetchedAt)}${
            report.weather.isFallback ? " (fallback data)" : ""
          }`}
        />
        <Row
          icon={<Mountain className="h-3.5 w-3.5 text-zinc-400" />}
          label="Terrain"
          value={
            terrain
              ? `Open-Meteo Elevation · ${terrain.gridSize * terrain.gridSize} samples · ~${
                  terrain.gridSize * terrain.cellSizeMeters
                }m window · analyzed ${
                  provenance.terrainAnalyzedAt ? timeAgo(provenance.terrainAnalyzedAt) : "—"
                }`
              : "Unavailable at analysis time"
          }
        />
        <Row
          icon={<MapPin className="h-3.5 w-3.5 text-zinc-400" />}
          label="Location"
          value={
            locationSource === "gps"
              ? "Device GPS"
              : locationSource === "geocoded"
                ? "Geocoded from typed address"
                : "Seed location (predefined)"
          }
        />
        <Row
          icon={<Cpu className="h-3.5 w-3.5 text-zinc-400" />}
          label="Risk Model"
          value={`EarthSight Risk Engine ${provenance.riskEngineVersion} · deterministic · calculated ${timeAgo(
            provenance.riskCalculatedAt
          )}`}
        />
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5">{icon}</span>
      <div>
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="text-white">{value}</p>
      </div>
    </div>
  );
}

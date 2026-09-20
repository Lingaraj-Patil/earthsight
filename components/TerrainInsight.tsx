"use client";

import { TerrainAnalysis } from "@/types/hazard";
import { Mountain, Droplets, TriangleAlert } from "lucide-react";

/**
 * Renders the sampled elevation grid as a heatmap with D8 flow-direction
 * arrows overlaid, plus the derived hydrology metrics. Everything drawn
 * here comes from the stored TerrainAnalysis — no re-computation, no
 * decorative/random values.
 */
export default function TerrainInsight({ terrain }: { terrain: TerrainAnalysis | null }) {
  if (!terrain) {
    return (
      <div className="es-card rounded-3xl p-6 sm:p-7">
        <h3 className="text-xs font-medium uppercase tracking-wider text-emerald-400">
          Terrain &amp; Water Flow
        </h3>
        <p className="mt-4 flex items-start gap-2 text-sm text-zinc-400">
          <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5 text-yellow-400" />
          Elevation data was unavailable for this location, so terrain-based flood accumulation
          was excluded from the risk score.
        </p>
      </div>
    );
  }

  const { elevations, flowDirections, gridSize } = terrain;
  const min = Math.min(...elevations);
  const max = Math.max(...elevations);
  const range = Math.max(max - min, 0.1);

  const cell = 30;
  const size = gridSize * cell;
  const centerIdx = Math.floor(gridSize / 2) * gridSize + Math.floor(gridSize / 2);

  return (
    <div className="es-card rounded-3xl p-6 sm:p-7">
      <h3 className="text-xs font-medium uppercase tracking-wider text-emerald-400">
        Terrain &amp; Water Flow
      </h3>
      <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
        Real elevations sampled across a {gridSize}×{gridSize} grid ({terrain.cellSizeMeters}m
        spacing), with D8 steepest-descent flow routing computed locally to find where water
        collects.
      </p>

      <div className="mt-5 flex flex-col lg:flex-row gap-6 items-start">
        <div className="mx-auto lg:mx-0 shrink-0">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="rounded-xl border border-white/10"
            role="img"
            aria-label={`Elevation grid around the hazard. Flood exposure score ${terrain.floodExposure} out of 1.`}
          >
            {elevations.map((elevation, i) => {
              const row = Math.floor(i / gridSize);
              const col = i % gridSize;
              const norm = (elevation - min) / range;
              // Low ground (where water collects) renders blue; high
              // ground renders warm. This is the standard hypsometric
              // intuition inverted for a flood-risk read.
              const hue = 200 - norm * 170;
              const light = 22 + norm * 38;
              return (
                <rect
                  key={i}
                  x={col * cell}
                  y={row * cell}
                  width={cell}
                  height={cell}
                  fill={`hsl(${hue}, 45%, ${light}%)`}
                />
              );
            })}

            {flowDirections.map((receiver, i) => {
              if (receiver < 0) return null;
              const row = Math.floor(i / gridSize);
              const col = i % gridSize;
              const rRow = Math.floor(receiver / gridSize);
              const rCol = receiver % gridSize;

              const x1 = col * cell + cell / 2;
              const y1 = row * cell + cell / 2;
              const dx = (rCol - col) * cell * 0.34;
              const dy = (rRow - row) * cell * 0.34;

              return (
                <line
                  key={`f-${i}`}
                  x1={x1 - dx}
                  y1={y1 - dy}
                  x2={x1 + dx}
                  y2={y1 + dy}
                  stroke="rgba(255,255,255,0.45)"
                  strokeWidth={1.1}
                  markerEnd="url(#flowArrow)"
                />
              );
            })}

            <defs>
              <marker
                id="flowArrow"
                markerWidth="4"
                markerHeight="4"
                refX="3"
                refY="2"
                orient="auto"
              >
                <path d="M0,0 L4,2 L0,4 Z" fill="rgba(255,255,255,0.55)" />
              </marker>
            </defs>

            <circle
              cx={(centerIdx % gridSize) * cell + cell / 2}
              cy={Math.floor(centerIdx / gridSize) * cell + cell / 2}
              r={7}
              fill="none"
              stroke="#34d399"
              strokeWidth={2.5}
            />
          </svg>
          <p className="mt-2 text-center text-[10px] text-zinc-600">
            Blue = lower ground · arrows = water flow · green ring = hazard
          </p>
        </div>

        <dl className="flex-1 w-full flex flex-col gap-3 text-sm">
          <Metric
            icon={<Droplets className="h-3.5 w-3.5 text-sky-300" />}
            label="Flood exposure"
            value={`${terrain.floodExposure.toFixed(2)} / 1.00`}
            emphasis
          />
          <Metric
            icon={<Mountain className="h-3.5 w-3.5 text-zinc-400" />}
            label="Elevation"
            value={`${terrain.centerElevation} m`}
          />
          <Metric
            label="Depth below surroundings"
            value={
              terrain.depressionDepth > 0
                ? `${terrain.depressionDepth.toFixed(1)} m lower`
                : `${Math.abs(terrain.depressionDepth).toFixed(1)} m higher`
            }
          />
          <Metric
            label="Upslope catchment"
            value={`${terrain.upslopeCells} cells (${Math.round(terrain.upslopeFraction * 100)}%)`}
          />
          <Metric label="Mean slope" value={`${terrain.meanSlope}°`} />
        </dl>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  emphasis,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-2 last:border-0">
      <dt className="flex items-center gap-1.5 text-zinc-500">
        {icon}
        {label}
      </dt>
      <dd className={`text-right font-medium ${emphasis ? "text-emerald-400" : "text-white"}`}>
        {value}
      </dd>
    </div>
  );
}

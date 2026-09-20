import { HazardReport } from "@/types/hazard";
import { SEED_HAZARDS } from "@/lib/demoData";

/**
 * Centralized localStorage access. No other file in the app should call
 * window.localStorage directly — this keeps persistence logic in one
 * place and makes it trivial to swap in a real backend later.
 *
 * Write failures (quota exceeded, private browsing, disabled storage) are
 * surfaced to the caller as a StorageError rather than swallowed, so the
 * UI can show the user a real error instead of pretending a save
 * succeeded.
 *
 * SCHEMA SAFETY: localStorage has no schema. As HazardReport has grown
 * fields (terrain, provenance, locationSource, isSeed, weatherEscalation),
 * a report saved by an older version of this app can be missing keys the
 * current code assumes exist — JSON.parse won't catch that, and
 * TypeScript can't check the shape of data crossing a runtime boundary.
 * That mismatch is exactly what caused a real crash: code elsewhere
 * checked `report.terrain !== null`, which is true for `undefined` too,
 * letting a legacy record through and then failing on a non-null
 * assertion. Rather than patch each consumer defensively forever,
 * `readAll()` validates every record's shape once, here, and silently
 * drops anything malformed — so the rest of the app can keep trusting the
 * HazardReport type without runtime guards scattered everywhere.
 */

const STORAGE_KEY = "earthsight.hazards.v2";
const SEEDED_KEY = "earthsight.seeded.v2";

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** Structural check against every field the current app actually reads.
 * Not a full deep validation of every nested value — just enough to
 * guarantee the top-level shape consumers rely on (including fields that
 * didn't exist in earlier versions of this schema) is really present. */
function isValidHazardReport(value: unknown): value is HazardReport {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;

  const risk = r.risk as Record<string, unknown> | undefined;
  const analysis = r.analysis as Record<string, unknown> | undefined;
  const weather = r.weather as Record<string, unknown> | undefined;
  const provenance = r.provenance as Record<string, unknown> | undefined;

  return (
    typeof r.id === "string" &&
    typeof r.createdAt === "string" &&
    typeof r.latitude === "number" &&
    typeof r.longitude === "number" &&
    (r.locationSource === "gps" ||
      r.locationSource === "geocoded" ||
      r.locationSource === "seed") &&
    typeof r.isSeed === "boolean" &&
    typeof analysis === "object" &&
    analysis !== null &&
    typeof analysis.severityScore === "number" &&
    typeof analysis.confidence === "number" &&
    typeof weather === "object" &&
    weather !== null &&
    typeof weather.fetchedAt === "string" &&
    (r.terrain === null || (typeof r.terrain === "object" && r.terrain !== null)) &&
    typeof provenance === "object" &&
    provenance !== null &&
    typeof provenance.riskEngineVersion === "string" &&
    typeof risk === "object" &&
    risk !== null &&
    typeof risk.currentRisk === "number" &&
    typeof risk.projectedRisk === "number" &&
    (risk.weatherEscalation === "significant" || risk.weatherEscalation === "minimal") &&
    Array.isArray(risk.factors)
  );
}

function readAll(): HazardReport[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const valid = parsed.filter(isValidHazardReport);
    if (valid.length !== parsed.length) {
      console.warn(
        `EarthSight: dropped ${parsed.length - valid.length} stored report(s) that no longer match the current data schema.`
      );
    }
    return valid;
  } catch {
    return [];
  }
}

function writeAll(reports: HazardReport[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  } catch {
    throw new StorageError(
      "Could not save to local storage — it may be full or blocked (e.g. private browsing)."
    );
  }
}

/** Seeds built-in sample incidents on first load so the map isn't empty.
 * These are clearly flagged with isSeed: true and are never mixed with
 * real user-submitted reports in any statistic without disclosure. */
export function ensureSeeded(): void {
  if (!isBrowser()) return;
  const alreadySeeded = window.localStorage.getItem(SEEDED_KEY);
  if (alreadySeeded) return;

  const existing = readAll();
  if (existing.length === 0) {
    try {
      writeAll(SEED_HAZARDS);
    } catch {
      // If seeding fails (e.g. storage disabled), the app still functions —
      // the map will just start empty rather than crash.
    }
  }
  window.localStorage.setItem(SEEDED_KEY, "true");
}

export function getHazards(): HazardReport[] {
  ensureSeeded();
  return readAll().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getHazardById(id: string): HazardReport | undefined {
  return readAll().find((h) => h.id === id);
}

/** Throws StorageError if the write fails — callers must handle this and
 * show the user a real error rather than assuming success. */
export function saveHazard(report: HazardReport): void {
  const all = readAll();
  const existingIndex = all.findIndex((h) => h.id === report.id);
  if (existingIndex >= 0) {
    all[existingIndex] = report;
  } else {
    all.push(report);
  }
  writeAll(all);
}

/** Deletes exactly one hazard report by id. Never affects other reports. */
export function deleteHazard(id: string): void {
  const all = readAll();
  const updated = all.filter((h) => h.id !== id);
  writeAll(updated);
}

export function clearNewStatus(id: string): void {
  const all = readAll();
  const updated = all.map((h) => (h.id === id ? { ...h, isNew: false } : h));
  writeAll(updated);
}

/** Wipes every report, including seed data, and allows reseeding. Used only
 * for a full local reset — never call this to delete a single report. */
export function clearAllHazards(): void {
  writeAll([]);
  if (isBrowser()) {
    window.localStorage.removeItem(SEEDED_KEY);
  }
}

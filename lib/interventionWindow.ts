import { WeatherData } from "@/types/hazard";

/**
 * Derives an absolute rain-arrival timestamp from the weather snapshot's
 * real fetch time plus the forecast's relative rainfallHours. This is the
 * only honest way to power a live countdown: rainfallHours alone is only
 * meaningful relative to when it was fetched, so a countdown that just
 * ticks that integer down would drift from reality. Anchoring it to a real
 * timestamp means the countdown is always correct regardless of how long
 * ago the report was created or how long the page has been open.
 *
 * Returns null when there's nothing to count down to — either no rain is
 * expected, or escalation is minimal and a countdown would misleadingly
 * imply urgency that isn't real (see lib/riskEngine.ts weatherEscalation).
 */
export function rainArrivalTimestamp(weather: WeatherData): Date | null {
  if (weather.rainfallHours === null) return null;
  const fetchedAt = new Date(weather.fetchedAt).getTime();
  if (Number.isNaN(fetchedAt)) return null;
  return new Date(fetchedAt + weather.rainfallHours * 60 * 60 * 1000);
}

export type InterventionWindow =
  | { status: "no-significant-rain" }
  | { status: "already-past"; arrivedMinutesAgo: number }
  | { status: "counting-down"; targetTime: string; msRemaining: number };

/** Pure function of (weather, now) — no hidden state, no randomness. The
 * caller (a client component) re-invokes this every tick with the current
 * real clock time to produce a genuinely live countdown. */
export function computeInterventionWindow(
  weather: WeatherData,
  significant: boolean,
  now: Date = new Date()
): InterventionWindow {
  if (!significant) return { status: "no-significant-rain" };

  const target = rainArrivalTimestamp(weather);
  if (!target) return { status: "no-significant-rain" };

  const msRemaining = target.getTime() - now.getTime();
  if (msRemaining <= 0) {
    return { status: "already-past", arrivedMinutesAgo: Math.round(-msRemaining / 60000) };
  }
  return { status: "counting-down", targetTime: target.toISOString(), msRemaining };
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

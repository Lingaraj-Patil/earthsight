/**
 * Real geocoding services. No API key required for either provider, which
 * keeps the same keyless architecture pattern already used for weather.
 *
 * Forward geocoding (place name → coordinates): Open-Meteo Geocoding API.
 * Reverse geocoding (coordinates → place name): BigDataCloud's free
 * client-side reverse-geocode endpoint (no key, CORS-friendly).
 *
 * Neither function invents a location. Both return `null` on failure so
 * callers can show an honest error instead of silently substituting a
 * default coordinate.
 */

export type GeocodeResult = {
  latitude: number;
  longitude: number;
  label: string;
};

const FORWARD_GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const REVERSE_GEOCODE_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client";

/** Converts a manually-typed place name into real coordinates. */
export async function forwardGeocode(query: string): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  try {
    const params = new URLSearchParams({
      name: trimmed,
      count: "1",
      language: "en",
      format: "json",
    });
    const response = await fetch(`${FORWARD_GEOCODE_URL}?${params.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;

    const data = await response.json();
    const first = data?.results?.[0];
    if (!first || typeof first.latitude !== "number" || typeof first.longitude !== "number") {
      return null;
    }

    const parts = [first.name, first.admin1, first.country].filter(Boolean);
    return {
      latitude: first.latitude,
      longitude: first.longitude,
      label: parts.join(", ") || trimmed,
    };
  } catch {
    return null;
  }
}

/** Converts real GPS coordinates into a human-readable place name. */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      localityLanguage: "en",
    });
    const response = await fetch(`${REVERSE_GEOCODE_URL}?${params.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;

    const data = await response.json();
    const parts = [data?.locality, data?.principalSubdivision, data?.countryName].filter(Boolean);
    if (!parts.length) return null;

    return parts.join(", ");
  } catch {
    return null;
  }
}

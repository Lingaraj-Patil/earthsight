import { WeatherData } from "@/types/hazard";

/**
 * Environmental conditions service, backed by Open-Meteo (no API key
 * required). All network access for weather is isolated here — UI
 * components must never call fetch() for weather directly.
 *
 * If the live API is unreachable, an isolated fallback dataset is returned
 * so the app keeps working during a live demo. The fallback is clearly
 * flagged with `isFallback: true` and is never disguised as live data.
 */

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

// Isolated fallback dataset. Chosen to reflect the flagship demo scenario:
// low current rainfall, but heavy rain forecast a few hours out.
const FALLBACK_WEATHER: Omit<WeatherData, "fetchedAt"> = {
  currentRainfall: 1.2,
  forecastRainfall: 18,
  rainProbability: 78,
  rainfallHours: 6,
  weatherDescription: "Partly cloudy, rain developing later",
  temperatureC: 27,
  isFallback: true,
};

function describeWeatherCode(code: number): string {
  if (code === 0) return "Clear sky";
  if ([1, 2, 3].includes(code)) return "Partly cloudy";
  if ([45, 48].includes(code)) return "Foggy";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67].includes(code)) return "Rain";
  if ([71, 73, 75, 77].includes(code)) return "Snow";
  if ([80, 81, 82].includes(code)) return "Rain showers";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Mixed conditions";
}

/** Finds how many hours from now until rainfall probability/amount crosses
 * a meaningful threshold, scanning the hourly forecast. */
function findHoursUntilRain(
  times: string[],
  precipitation: number[],
  probability: number[] | undefined
): { hours: number | null; forecastRainfall: number; rainProbability: number } {
  const now = Date.now();
  let hoursUntilRain: number | null = null;
  let peakRainfall = 0;
  let peakProbability = 0;

  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]).getTime();
    const hoursFromNow = (t - now) / (1000 * 60 * 60);
    if (hoursFromNow < 0 || hoursFromNow > 24) continue;

    const precip = precipitation[i] ?? 0;
    const prob = probability?.[i] ?? 0;

    if (precip > peakRainfall) peakRainfall = precip;
    if (prob > peakProbability) peakProbability = prob;

    const isRainy = precip >= 1 || prob >= 50;
    if (isRainy && hoursUntilRain === null) {
      hoursUntilRain = Math.max(0, Math.round(hoursFromNow));
    }
  }

  return {
    hours: hoursUntilRain,
    forecastRainfall: Math.round(peakRainfall * 10) / 10,
    rainProbability: Math.round(peakProbability),
  };
}

export async function fetchWeatherData(
  latitude: number,
  longitude: number
): Promise<WeatherData> {
  try {
    const params = new URLSearchParams({
      latitude: latitude.toFixed(4),
      longitude: longitude.toFixed(4),
      current: "precipitation,weather_code,temperature_2m",
      hourly: "precipitation,precipitation_probability,weather_code",
      forecast_days: "2",
      timezone: "auto",
    });

    const response = await fetch(`${OPEN_METEO_URL}?${params.toString()}`, {
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`Open-Meteo responded with ${response.status}`);

    const data = await response.json();

    const currentRainfall: number = data?.current?.precipitation ?? 0;
    const currentCode: number = data?.current?.weather_code ?? 0;
    const temperatureC: number | undefined = data?.current?.temperature_2m;

    const hourlyTimes: string[] = data?.hourly?.time ?? [];
    const hourlyPrecip: number[] = data?.hourly?.precipitation ?? [];
    const hourlyProb: number[] | undefined = data?.hourly?.precipitation_probability;

    if (!hourlyTimes.length) throw new Error("Open-Meteo returned no hourly forecast");

    const { hours, forecastRainfall, rainProbability } = findHoursUntilRain(
      hourlyTimes,
      hourlyPrecip,
      hourlyProb
    );

    return {
      currentRainfall: Math.round(currentRainfall * 10) / 10,
      forecastRainfall,
      rainProbability,
      rainfallHours: hours,
      weatherDescription: describeWeatherCode(currentCode),
      temperatureC,
      fetchedAt: new Date().toISOString(),
      isFallback: false,
    };
  } catch {
    return { ...FALLBACK_WEATHER, fetchedAt: new Date().toISOString() };
  }
}

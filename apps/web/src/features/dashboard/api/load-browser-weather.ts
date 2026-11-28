import {
  SECTION_ERROR_MESSAGE,
  weatherLocationResponseSchema,
  weatherSnapshotSchema,
  type WeatherPlace,
  type WeatherSection,
  type WeatherSnapshot
} from "@dashboard/contracts";

import { buildOpenMeteoForecastUrl, parseOpenMeteoForecast } from "./parse-open-meteo";

export async function loadBrowserWeatherSection(
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal
): Promise<WeatherSection> {
  try {
    const place = await readSavedPlace(fetchImpl, signal);

    if (!place) {
      return { status: "unavailable" };
    }

    const unit: WeatherSnapshot["unit"] = "celsius";
    const timeZone = safeTimeZone(browserTimeZone());
    const response = await fetchImpl(buildOpenMeteoForecastUrl(place, unit, timeZone), {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      ...(signal ? { signal } : {})
    });

    if (!response.ok) {
      return { status: "error", message: SECTION_ERROR_MESSAGE };
    }

    const weather = parseOpenMeteoForecast(await response.json(), place, unit, new Date());
    const parsed = weather ? weatherSnapshotSchema.safeParse(weather) : null;

    if (!parsed?.success) {
      return { status: "error", message: SECTION_ERROR_MESSAGE };
    }

    return {
      status: "ready",
      updatedAt: new Date().toISOString(),
      weather: parsed.data
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }

    return { status: "error", message: SECTION_ERROR_MESSAGE };
  }
}

async function readSavedPlace(
  fetchImpl: typeof fetch,
  signal?: AbortSignal
): Promise<WeatherPlace | null> {
  const response = await fetchImpl("/api/v1/weather/location", {
    cache: "no-store",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    ...(signal ? { signal } : {})
  });

  if (!response.ok) {
    return null;
  }

  const parsed = weatherLocationResponseSchema.safeParse(await response.json());
  return parsed.success ? parsed.data.data.location : null;
}

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function safeTimeZone(value: string): string {
  return /^[A-Za-z0-9_+-]{1,32}(?:\/[A-Za-z0-9_+-]{1,32}){0,2}$/.test(value) ? value : "UTC";
}

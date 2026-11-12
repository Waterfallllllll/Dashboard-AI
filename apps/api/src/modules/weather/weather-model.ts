import type { WeatherPlace, WeatherScene, WeatherSnapshot } from "@dashboard/contracts";

const FRESH_MS = 15 * 60 * 1000;
const STALE_MS = 6 * 60 * 60 * 1000;

export function roundCoordinate(value: number): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.round(value * 100) / 100;

  return Number.isFinite(rounded) ? rounded : null;
}

export function roundPlace(
  latitude: number,
  longitude: number,
  label: string
): WeatherPlace | null {
  const lat = roundCoordinate(latitude);
  const lon = roundCoordinate(longitude);
  const name = label.trim().slice(0, 80);

  if (
    lat === null ||
    lon === null ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180 ||
    name.length === 0
  ) {
    return null;
  }

  return { latitude: lat, longitude: lon, label: name };
}

export function weatherScene(code: number, isDay: boolean): WeatherScene {
  if (code === 0) {
    return isDay ? "clear" : "night";
  }

  if (code === 1 || code === 2 || code === 3) {
    return isDay ? "cloudy" : "night";
  }

  if (code === 45 || code === 48) {
    return "fog";
  }

  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return "rain";
  }

  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return "snow";
  }

  if (code >= 95) {
    return "storm";
  }

  return isDay ? "cloudy" : "night";
}

export function weatherDescription(scene: WeatherScene): string {
  switch (scene) {
    case "clear":
      return "Ясно";
    case "cloudy":
      return "Облачно";
    case "rain":
      return "Дождь";
    case "storm":
      return "Гроза";
    case "snow":
      return "Снег";
    case "fog":
      return "Туман";
    case "night":
      return "Ночь";
  }
}

export function cacheKey(place: WeatherPlace, unit: WeatherSnapshot["unit"]): string {
  return `${place.latitude.toFixed(2)}:${place.longitude.toFixed(2)}:${unit}`;
}

export type CachedWeather = {
  readonly expiresAt: number;
  readonly staleUntil: number;
  readonly updatedAt: string;
  readonly weather: WeatherSnapshot;
};

export class WeatherCache {
  private readonly entries = new Map<string, CachedWeather>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  fresh(key: string): CachedWeather | null {
    const entry = this.entries.get(key);

    if (!entry || entry.expiresAt <= this.now()) {
      return null;
    }

    return entry;
  }

  stale(key: string): CachedWeather | null {
    const entry = this.entries.get(key);

    if (!entry || entry.staleUntil <= this.now()) {
      return null;
    }

    return entry;
  }

  put(key: string, weather: WeatherSnapshot, updatedAt: string): void {
    const now = this.now();
    this.entries.set(key, {
      expiresAt: now + FRESH_MS,
      staleUntil: now + STALE_MS,
      updatedAt,
      weather
    });
  }
}

export function forecastUrl(
  baseUrl: string,
  place: WeatherPlace,
  unit: WeatherSnapshot["unit"],
  timeZone: string
): URL {
  const url = new URL("/v1/forecast", baseUrl);
  url.searchParams.set("latitude", place.latitude.toFixed(2));
  url.searchParams.set("longitude", place.longitude.toFixed(2));
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,is_day"
  );
  url.searchParams.set("hourly", "temperature_2m,precipitation_probability,weather_code");
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min");
  url.searchParams.set("forecast_days", "2");
  url.searchParams.set("timezone", timeZone);
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("temperature_unit", unit);
  return url;
}

export function geocodingUrl(query: string): URL {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "ru");
  return url;
}

export function parseForecast(
  payload: unknown,
  place: WeatherPlace,
  unit: WeatherSnapshot["unit"],
  now: Date
): WeatherSnapshot | null {
  if (!isRecord(payload)) {
    return null;
  }

  const current = isRecord(payload.current) ? payload.current : null;
  const hourly = isRecord(payload.hourly) ? payload.hourly : null;
  const daily = isRecord(payload.daily) ? payload.daily : null;

  if (!current || !hourly || !daily) {
    return null;
  }

  const temperature = numberOf(current.temperature_2m);
  const apparent = numberOf(current.apparent_temperature);
  const precipitation = probabilityOf(current.precipitation_probability);
  const code = codeOf(current.weather_code);
  const wind = numberOf(current.wind_speed_10m);
  const isDay = current.is_day === 1 || current.is_day === true;
  const minimum = firstNumber(daily.temperature_2m_min);
  const maximum = firstNumber(daily.temperature_2m_max);
  const times = stringArray(hourly.time);

  if (
    temperature === null ||
    apparent === null ||
    precipitation === null ||
    code === null ||
    wind === null ||
    minimum === null ||
    maximum === null ||
    times === null
  ) {
    return null;
  }

  const scene = weatherScene(code, isDay);
  const hourlyForecast = nextHours(times, hourly, now);

  return {
    locationLabel: place.label,
    temperature: round1(temperature),
    apparentTemperature: round1(apparent),
    description: weatherDescription(scene),
    precipitationProbability: precipitation,
    windSpeedKmh: round1(Math.max(0, wind)),
    min: round1(minimum),
    max: round1(maximum),
    weatherCode: code,
    isDay,
    scene,
    unit,
    hourly: hourlyForecast
  };
}

export function parsePlaces(payload: unknown): WeatherPlace[] {
  if (!isRecord(payload) || !Array.isArray(payload.results)) {
    return [];
  }

  const places: WeatherPlace[] = [];

  for (const item of payload.results) {
    if (!isRecord(item) || places.length >= 5) {
      continue;
    }

    const name = typeof item.name === "string" ? item.name : "";
    const country = typeof item.country === "string" ? item.country : "";
    const latitude = numberOf(item.latitude);
    const longitude = numberOf(item.longitude);

    if (latitude === null || longitude === null || name.length === 0) {
      continue;
    }

    const label = country.length > 0 ? `${name}, ${country}` : name;
    const place = roundPlace(latitude, longitude, label);

    if (place) {
      places.push(place);
    }
  }

  return places;
}

function nextHours(
  times: readonly string[],
  hourly: Record<string, unknown>,
  now: Date
): WeatherSnapshot["hourly"] {
  const start = times.findIndex((time) => {
    const instant = timeToUtc(time);
    return instant !== null && instant.getTime() >= now.getTime() - 60 * 60 * 1000;
  });
  const from = start === -1 ? 0 : start;
  const hours: WeatherSnapshot["hourly"][number][] = [];

  for (let index = from; index < times.length && hours.length < 6; index += 1) {
    const at = timeToUtc(times[index] ?? "");
    const temperature = arrayNumber(hourly.temperature_2m, index);
    const weatherCode = codeOf(arrayNumber(hourly.weather_code, index));
    const probability = probabilityOf(arrayNumber(hourly.precipitation_probability, index));

    if (!at || temperature === null || weatherCode === null || probability === null) {
      continue;
    }

    hours.push({
      at: at.toISOString(),
      temperature: round1(temperature),
      precipitationProbability: probability,
      weatherCode
    });
  }

  return hours;
}

function timeToUtc(value: string): Date | null {
  const normalized = value.length === 16 ? `${value}:00.000Z` : value;
  const instant = new Date(normalized);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

function firstNumber(value: unknown): number | null {
  return Array.isArray(value) ? numberOf(value[0]) : null;
}

function arrayNumber(value: unknown, index: number): number | null {
  return Array.isArray(value) ? numberOf(value[index]) : null;
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return null;
  }

  return value;
}

function numberOf(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function probabilityOf(value: unknown): number | null {
  if (value === null || value === undefined) {
    return 0;
  }

  const number = numberOf(value);

  if (number === null) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(number)));
}

function codeOf(value: unknown): number | null {
  const number = numberOf(value);

  if (number === null || !Number.isInteger(number) || number < 0 || number > 99) {
    return null;
  }

  return number;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

import type { WeatherPlace, WeatherSnapshot } from "@dashboard/contracts";

const OPEN_METEO_FORECAST = "https://api.open-meteo.com/v1/forecast";

export function buildOpenMeteoForecastUrl(
  place: WeatherPlace,
  unit: WeatherSnapshot["unit"],
  timeZone: string
): string {
  const url = new URL(OPEN_METEO_FORECAST);
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
  return url.toString();
}

export function parseOpenMeteoForecast(
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
    hourly: nextHours(times, hourly, now)
  };
}

function weatherScene(code: number, isDay: boolean): WeatherSnapshot["scene"] {
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

function weatherDescription(scene: WeatherSnapshot["scene"]): string {
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
  return number === null ? null : Math.max(0, Math.min(100, Math.round(number)));
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

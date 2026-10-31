import { toZonedDate } from "@/lib/format/date-time";

import { getWeatherScene } from "./weather-scene";
import type { HourlyForecast, WeatherSnapshot } from "./weather-types";

export function createMockWeather(
  now = Date.now(),
  timeZone = "Europe/Moscow"
): WeatherSnapshot {
  const zoned = toZonedDate(now, timeZone);
  const currentHour = zoned.getHours();
  const hourly: HourlyForecast[] = Array.from({ length: 6 }, (_, index) => {
    const hour = (currentHour + index + 1) % 24;
    const padded = String(hour).padStart(2, "0");

    return {
      hourLabel: `${padded}:00`,
      temperatureC: 11 - index,
      precipitationProbability: 20 + index * 8,
      weatherCode: index > 3 ? 61 : 2
    };
  });

  const weatherCode = 2;

  return {
    locationLabel: "Москва",
    temperatureC: 11,
    apparentTemperatureC: 8,
    description: "Облачно с прояснениями",
    precipitationProbability: 30,
    windSpeedKmh: 14,
    minC: 7,
    maxC: 13,
    weatherCode,
    isDay: currentHour >= 7 && currentHour < 20,
    scene: getWeatherScene(weatherCode, currentHour >= 7 && currentHour < 20),
    updatedAt: now - 8 * 60 * 1000,
    hourly
  };
}

export const MOCK_WEATHER = createMockWeather();

export function formatTemperature(value: number): string {
  return `${value > 0 ? "+" : ""}${Math.round(value)}°`;
}

export function formatWind(value: number): string {
  return `${Math.round(value)} км/ч`;
}

import { describe, expect, it, vi } from "vitest";

import { loadWeatherSection } from "./load-dashboard";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("догрузка погоды", () => {
  it("оставляет готовую секцию API без fallback", async () => {
    const weather = {
      locationLabel: "Москва",
      temperature: -3.9,
      apparentTemperature: -7.7,
      description: "Облачно",
      precipitationProbability: 0,
      windSpeedKmh: 5.6,
      min: -4.5,
      max: -2.1,
      weatherCode: 2,
      isDay: false,
      scene: "cloudy" as const,
      unit: "celsius" as const,
      hourly: []
    };
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      expect(String(input)).toBe("/api/v1/weather");
      return jsonResponse(200, {
        data: {
          status: "ready",
          updatedAt: "2026-11-28T17:00:00.000Z",
          weather
        },
        meta: { requestId: "request-1" }
      });
    });

    await expect(loadWeatherSection(fetchImpl)).resolves.toMatchObject({
      status: "ready",
      weather: { locationLabel: "Москва" }
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("при ошибке API догружает прогноз с IP браузера", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);

      if (url === "/api/v1/weather") {
        return jsonResponse(200, {
          data: { status: "error", message: "Не удалось загрузить раздел." },
          meta: { requestId: "request-1" }
        });
      }

      if (url === "/api/v1/weather/location") {
        return jsonResponse(200, {
          data: { location: { latitude: 55.75, longitude: 37.62, label: "Москва" } },
          meta: { requestId: "request-2" }
        });
      }

      if (url.startsWith("https://api.open-meteo.com/")) {
        return jsonResponse(200, {
          current: {
            temperature_2m: -3.9,
            apparent_temperature: -7.7,
            precipitation_probability: 0,
            weather_code: 2,
            wind_speed_10m: 5.6,
            is_day: 0
          },
          hourly: {
            time: ["2026-11-28T20:00"],
            temperature_2m: [-3.9],
            precipitation_probability: [0],
            weather_code: [2]
          },
          daily: {
            temperature_2m_max: [-2.1],
            temperature_2m_min: [-4.5]
          }
        });
      }

      throw new Error(`unexpected ${url}`);
    });

    await expect(loadWeatherSection(fetchImpl)).resolves.toMatchObject({
      status: "ready",
      weather: { locationLabel: "Москва", temperature: -3.9 }
    });
  });

  it("превращает сбой сети в ошибку секции", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error("offline");
    });

    await expect(loadWeatherSection(fetchImpl)).resolves.toMatchObject({ status: "error" });
  });
});

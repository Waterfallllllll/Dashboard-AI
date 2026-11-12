import { describe, expect, it } from "vitest";

import {
  WeatherCache,
  parseForecast,
  parsePlaces,
  roundCoordinate,
  roundPlace
} from "./weather-model.js";

const place = { latitude: 55.76, longitude: 37.62, label: "Москва" };

describe("погода Open-Meteo", () => {
  it("округляет координаты до двух знаков и не возвращает исходную точность", () => {
    expect(roundCoordinate(55.755826)).toBe(55.76);
    expect(roundCoordinate(37.6173)).toBe(37.62);
    expect(roundPlace(55.755826, 37.6173, " Москва ")).toEqual(place);
    expect(roundPlace(Number.NaN, 0, "Точка")).toBeNull();
    expect(JSON.stringify(roundPlace(55.755826, 37.62, "Москва"))).not.toContain("55.755826");
  });

  it("читает прогноз и отдаёт устаревший кэш после свежего срока", () => {
    let now = Date.parse("2026-11-12T09:00:00.000Z");
    const snapshot = parseForecast(
      {
        current: {
          temperature_2m: 3.2,
          apparent_temperature: 1,
          precipitation_probability: 40,
          weather_code: 61,
          wind_speed_10m: 12,
          is_day: 1
        },
        hourly: {
          time: ["2026-11-12T09:00"],
          temperature_2m: [3],
          precipitation_probability: [40],
          weather_code: [61]
        },
        daily: { temperature_2m_min: [0], temperature_2m_max: [5] }
      },
      place,
      "celsius",
      new Date(now)
    );
    expect(snapshot?.temperature).toBe(3.2);
    expect(snapshot?.scene).toBe("rain");
    expect(snapshot?.hourly).toHaveLength(1);

    if (!snapshot) {
      return;
    }

    const cache = new WeatherCache(() => now);
    cache.put("moscow", snapshot, "2026-11-12T09:00:00.000Z");
    expect(cache.fresh("moscow")?.weather.temperature).toBe(3.2);
    now += 16 * 60 * 1000;
    expect(cache.fresh("moscow")).toBeNull();
    expect(cache.stale("moscow")?.weather.scene).toBe("rain");
    now += 6 * 60 * 60 * 1000;
    expect(cache.stale("moscow")).toBeNull();
  });

  it("округляет найденные места", () => {
    expect(
      parsePlaces({
        results: [{ name: "Москва", country: "Россия", latitude: 55.755826, longitude: 37.6173 }]
      })
    ).toEqual([{ latitude: 55.76, longitude: 37.62, label: "Москва, Россия" }]);
  });
});

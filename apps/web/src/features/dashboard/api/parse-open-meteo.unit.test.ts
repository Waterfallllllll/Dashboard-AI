import { describe, expect, it } from "vitest";

import { buildOpenMeteoForecastUrl, parseOpenMeteoForecast } from "./parse-open-meteo";

const place = { latitude: 55.75, longitude: 37.62, label: "Москва" };

describe("парсер Open-Meteo в браузере", () => {
  it("собирает URL прогноза", () => {
    const url = buildOpenMeteoForecastUrl(place, "celsius", "Europe/Moscow");
    expect(url).toContain("latitude=55.75");
    expect(url).toContain("longitude=37.62");
    expect(url).toContain("temperature_unit=celsius");
    expect(url).toContain("timezone=Europe%2FMoscow");
  });

  it("разбирает текущий прогноз", () => {
    const weather = parseOpenMeteoForecast(
      {
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
      },
      place,
      "celsius",
      new Date("2026-11-28T17:00:00.000Z")
    );

    expect(weather).toMatchObject({
      locationLabel: "Москва",
      temperature: -3.9,
      description: "Ночь",
      scene: "night",
      unit: "celsius"
    });
  });
});

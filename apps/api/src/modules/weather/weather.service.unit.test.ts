import { describe, expect, it } from "vitest";

import type { FetchLike } from "../../infrastructure/http/provider-guard.js";
import type { Viewer } from "../../shared/http/require-actor.js";
import { WeatherService } from "./weather.service.js";

const viewer: Viewer = {
  userId: "a".repeat(24),
  sessionId: "session",
  timezone: "Europe/Moscow",
  timeFormat: "24"
};

const place = { latitude: 55.76, longitude: 37.62, label: "Москва" };

describe("погода на дашборде", () => {
  it("не держит общий ответ, пока Open-Meteo молчит", async () => {
    const service = createService(hangingFetch);
    const started = Date.now();

    await expect(service.loadForDashboard(viewer)).resolves.toEqual({ status: "unavailable" });
    expect(Date.now() - started).toBeLessThan(700);
  });

  it("в бюджете дашборда отдаёт unavailable при отказе провайдера", async () => {
    const service = createService(async () => {
      throw new Error("provider down");
    });

    await expect(service.loadForDashboard(viewer)).resolves.toEqual({ status: "unavailable" });
  });

  it("в полном запросе сообщает об ошибке, если провайдер отказал", async () => {
    const service = createService(async () => {
      throw new Error("provider down");
    });

    await expect(service.load(viewer)).resolves.toMatchObject({ status: "error" });
  });
});

function createService(fetchImpl: FetchLike): WeatherService {
  return new WeatherService(
    { read: async () => place, write: async () => true },
    { unit: async () => "celsius" },
    fetchImpl,
    "https://api.open-meteo.com"
  );
}

const hangingFetch: FetchLike = () => new Promise(() => undefined);

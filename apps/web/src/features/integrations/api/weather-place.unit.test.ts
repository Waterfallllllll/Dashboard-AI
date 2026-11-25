import { CSRF_HEADER } from "@dashboard/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  WeatherPlaceError,
  clearWeatherPlace,
  loadWeatherPlace,
  saveWeatherPlace,
  searchWeatherPlaces
} from "./weather-place";

const session = {
  data: {
    user: {
      id: "64b7f0c2a1d4e8f01a2b3c4d",
      displayName: "Илья",
      avatarUrl: null,
      locale: "ru",
      timezone: "Europe/Moscow",
      timeFormat: "24",
      theme: "light",
      createdAt: "2026-11-11T08:30:00.000Z",
      updatedAt: "2026-11-11T08:30:00.000Z"
    },
    expiresAt: "2026-11-25T08:30:00.000Z",
    csrfToken: "a".repeat(43)
  },
  meta: { requestId: "request-1" }
};

const moscow = { latitude: 55.75, longitude: 37.62, label: "Москва, Россия" };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("место для погоды", () => {
  it("читает сохранённую точку и ищет город без записи координат в браузер", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);

      if (url === "/api/v1/weather/location") {
        return jsonResponse(200, { data: { location: null }, meta: { requestId: "request-1" } });
      }

      expect(url).toBe(`/api/v1/weather/places?query=${encodeURIComponent("Москва")}`);
      return jsonResponse(200, {
        data: { places: [moscow] },
        meta: { requestId: "request-2" }
      });
    });

    await expect(loadWeatherPlace(fetchImpl)).resolves.toBeNull();
    await expect(searchWeatherPlaces("Москва", fetchImpl)).resolves.toEqual([moscow]);
  });

  it("сохраняет и удаляет место с токеном защиты", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      if (input === "/api/v1/auth/session") {
        return jsonResponse(200, session);
      }

      expect(input).toBe("/api/v1/weather/location");
      expect(new Headers(init?.headers).get(CSRF_HEADER)).toBe(session.data.csrfToken);

      if (init?.method === "DELETE") {
        return jsonResponse(200, { data: { location: null }, meta: { requestId: "request-3" } });
      }

      expect(init?.method).toBe("PUT");
      expect(JSON.parse(String(init?.body))).toEqual(moscow);
      return jsonResponse(200, { data: { location: moscow }, meta: { requestId: "request-2" } });
    });

    await expect(saveWeatherPlace(moscow, fetchImpl)).resolves.toEqual(moscow);
    await expect(clearWeatherPlace(fetchImpl)).resolves.toBeUndefined();
  });

  it("требует вход", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(401, {}));

    await expect(loadWeatherPlace(fetchImpl)).rejects.toBeInstanceOf(WeatherPlaceError);
    await expect(loadWeatherPlace(fetchImpl)).rejects.toMatchObject({ code: "unauthenticated" });
  });
});

import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithUser } from "@/test/render";

import { resetNotificationStoreForTests } from "@/features/notifications";

import { DevicePermissions } from "./device-permissions";

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

describe("сохранение места для погоды", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetNotificationStoreForTests();
  });

  it("записывает найденный город в аккаунт", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);

      if (url === "/api/v1/weather/location" && init?.method === undefined) {
        return jsonResponse(200, { data: { location: null }, meta: { requestId: "request-1" } });
      }

      if (url === "/api/v1/auth/session") {
        return jsonResponse(200, session);
      }

      if (url.startsWith("/api/v1/weather/places")) {
        return jsonResponse(200, {
          data: { places: [moscow] },
          meta: { requestId: "request-2" }
        });
      }

      return jsonResponse(200, { data: { location: moscow }, meta: { requestId: "request-3" } });
    });
    vi.stubGlobal("fetch", fetchImpl);
    const { user } = renderWithUser(<DevicePermissions />);

    await user.type(screen.getByLabelText("Город"), "Москва");
    await user.click(screen.getByRole("button", { name: "Сохранить город" }));

    expect(await screen.findByText("Сейчас: Москва, Россия")).toBeInTheDocument();
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/weather/location",
      expect.objectContaining({ method: "PUT" })
    );
  });
});

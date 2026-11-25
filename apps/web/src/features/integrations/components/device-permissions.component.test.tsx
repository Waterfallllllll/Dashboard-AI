import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithUser } from "@/test/render";

import { resetNotificationStoreForTests } from "@/features/notifications";

import { DevicePermissions } from "./device-permissions";
import { WeatherPlaceForm } from "./weather-place-form";

describe("DevicePermissions", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetNotificationStoreForTests();
  });

  it("запрашивает геолокацию только после нажатия", async () => {
    const getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition }
    });
    const { user } = renderWithUser(<WeatherPlaceForm />);

    expect(getCurrentPosition).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Определить место" }));
    expect(getCurrentPosition).toHaveBeenCalledOnce();
  });

  it("показывает инструкцию, если браузер запретил уведомления", async () => {
    const requestPermission = vi.fn().mockResolvedValue("denied");
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission
    });
    const { user } = renderWithUser(<DevicePermissions />);

    expect(requestPermission).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Разрешить уведомления" }));

    expect(requestPermission).toHaveBeenCalledOnce();
    expect(await screen.findByText(/Браузер запретил уведомления/)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});

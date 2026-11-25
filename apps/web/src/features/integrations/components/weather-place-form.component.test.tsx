import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithUser } from "@/test/render";

import { WeatherPlaceForm } from "./weather-place-form";

describe("место для погоды", () => {
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
});

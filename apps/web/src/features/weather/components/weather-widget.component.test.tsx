import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithUser } from "@/test/render";

import { createMockWeather } from "../model/mock-weather";

import { WeatherWidget } from "./weather-widget";

describe("WeatherWidget", () => {
  it("показывает текущую погоду и раскрывает почасовой прогноз", async () => {
    const weather = createMockWeather(Date.UTC(2026, 9, 31, 8, 0, 0));
    const { user } = renderWithUser(<WeatherWidget weather={weather} />);

    expect(screen.getByText("Москва")).toBeInTheDocument();
    expect(screen.getByText("+11°")).toBeInTheDocument();
    expect(screen.getByText("Облачно с прояснениями")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Прогноз на 6 часов" }));

    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getByText("12:00")).toBeInTheDocument();
  });
});

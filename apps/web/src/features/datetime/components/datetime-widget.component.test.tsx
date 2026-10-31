import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithUser } from "@/test/render";

import { CLOCK_SKEW_NOTICE } from "../model/clock-skew";

import { DateTimeWidget } from "./datetime-widget";

const moscowMorning = Date.UTC(2026, 9, 31, 8, 42, 7);

describe("DateTimeWidget", () => {
  it("показывает дату и время в выбранном поясе", () => {
    renderWithUser(
      <DateTimeWidget
        now={moscowMorning}
        systemTimeZone="UTC"
        timeFormat="24"
        timeZone="Europe/Moscow"
      />
    );

    expect(screen.getByText("11:42:07")).toBeInTheDocument();
    expect(screen.getByText("Суббота, 31 октября")).toBeInTheDocument();
    expect(screen.getByText("Москва")).toBeInTheDocument();
  });

  it("предупреждает о расхождении часов", () => {
    renderWithUser(
      <DateTimeWidget
        now={moscowMorning}
        serverNow={moscowMorning + 90_000}
        systemTimeZone="Europe/Moscow"
        timeFormat="24"
        timeZone="Europe/Moscow"
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent(CLOCK_SKEW_NOTICE);
  });
});

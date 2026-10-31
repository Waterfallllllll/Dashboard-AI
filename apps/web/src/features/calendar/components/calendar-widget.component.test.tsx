import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithUser } from "@/test/render";

import { CalendarWidget } from "./calendar-widget";

const moscowMorning = Date.UTC(2026, 9, 31, 8, 42, 7);

describe("CalendarWidget", () => {
  it("показывает события дня и прячет завершившиеся", () => {
    renderWithUser(<CalendarWidget now={moscowMorning} timeZone="Europe/Moscow" />);

    expect(screen.getByText("День рождения Марии")).toBeInTheDocument();
    expect(screen.getByText("Весь день")).toBeInTheDocument();
    expect(screen.getByText("Стендап команды")).toBeInTheDocument();
    expect(screen.queryByText("Утренняя пробежка")).not.toBeInTheDocument();
    expect(screen.getAllByText("Ближайшее")[0]).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Встреча" })[0]).toHaveAttribute(
      "href",
      "https://meet.google.com/abc-defg-hij"
    );
  });
});

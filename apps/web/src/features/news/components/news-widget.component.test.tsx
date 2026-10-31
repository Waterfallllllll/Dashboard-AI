import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithUser } from "@/test/render";

import { NewsWidget } from "./news-widget";

const now = Date.UTC(2026, 9, 31, 12, 0, 0);

describe("NewsWidget", () => {
  it("показывает ленту и скрывает материал", async () => {
    const { user } = renderWithUser(<NewsWidget now={now} timeZone="Europe/Moscow" />);

    expect(
      screen.getByRole("link", {
        name: /OpenAI расширила инструменты для агентных рабочих процессов/
      })
    ).toBeInTheDocument();
    expect(screen.getAllByText("за последние 24 часа").length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole("button", { name: "Не интересно" })[0]!);

    expect(
      screen.queryByRole("link", {
        name: /OpenAI расширила инструменты для агентных рабочих процессов/
      })
    ).not.toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it("показывает статус и тон", () => {
    render(<StatusBadge tone="warning">Не подключено</StatusBadge>);

    const badge = screen.getByText("Не подключено");

    expect(badge).toHaveAttribute("data-tone", "warning");
  });

  it("по умолчанию использует нейтральный тон", () => {
    render(<StatusBadge>Черновик</StatusBadge>);

    expect(screen.getByText("Черновик")).toHaveAttribute("data-tone", "neutral");
  });
});

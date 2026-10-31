import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithUser } from "@/test/render";

import { RoutinesWidget } from "./routines-widget";

describe("RoutinesWidget", () => {
  it("переключает выполнение и даёт отменить", async () => {
    const { user } = renderWithUser(<RoutinesWidget />);

    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Погладить кота" }));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Отменить" }));
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("переключает дату и добавляет быстрое дело", async () => {
    const { user } = renderWithUser(<RoutinesWidget />);

    await user.click(screen.getByRole("radio", { name: "Вчера" }));
    expect(screen.getByText("Пропущено")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Завтра" }));
    await user.type(screen.getByLabelText("Быстрое дело"), "Вынести мусор");
    await user.click(screen.getByRole("button", { name: "Добавить дело" }));
    expect(screen.getByRole("checkbox", { name: "Вынести мусор" })).toBeInTheDocument();
  });
});

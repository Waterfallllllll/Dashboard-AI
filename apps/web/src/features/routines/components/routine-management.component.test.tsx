import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithUser } from "@/test/render";

import { RoutineManagement } from "./routine-management";

describe("RoutineManagement", () => {
  it("показывает активные рутины и блокирует создание до API", () => {
    renderWithUser(<RoutineManagement />);

    expect(screen.getByRole("heading", { name: "Утренняя зарядка" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Читать 20 минут" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Создать рутину" })).toBeDisabled();
  });

  it("фильтрует по статусу и поиску", async () => {
    const { user } = renderWithUser(<RoutineManagement />);

    await user.click(screen.getByRole("radio", { name: "Приостановленные" }));
    expect(screen.getByRole("heading", { name: "Читать 20 минут" })).toBeInTheDocument();
    expect(screen.getByText("Найдено: 1")).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Поиск по названию" }), "бюджет");
    expect(screen.getByRole("heading", { name: "Ничего не найдено" })).toBeInTheDocument();
  });
});

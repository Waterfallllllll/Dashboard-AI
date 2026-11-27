import type { RoutineRule } from "@dashboard/contracts";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithUser } from "@/test/render";

import { RoutineLibraryEditor } from "./routine-library-editor";
import { RoutineManagement } from "./routine-management";

const today = "2026-11-27";

function rule(patch: Partial<RoutineRule> & Pick<RoutineRule, "id" | "title">): RoutineRule {
  return {
    description: null,
    startDate: "2020-01-01",
    endDate: null,
    recurrence: { kind: "daily" },
    reminderLocalTime: null,
    timezone: "Europe/Moscow",
    status: "active",
    createdAt: "2026-11-01T05:00:00.000Z",
    updatedAt: "2026-11-01T05:00:00.000Z",
    ...patch
  };
}

const routines = [
  rule({ id: "550e8400-e29b-41d4-a716-446655440000", title: "Утренняя зарядка" }),
  rule({
    id: "550e8400-e29b-41d4-a716-446655440001",
    title: "Читать 20 минут",
    status: "paused"
  }),
  rule({
    id: "550e8400-e29b-41d4-a716-446655440002",
    title: "Проверить бюджет",
    startDate: "2020-10-21",
    endDate: "2020-10-21",
    recurrence: { kind: "once" }
  })
];

describe("RoutineManagement", () => {
  it("показывает активные рутины из API и открывает создание", async () => {
    renderWithUser(<RoutineManagement listRules={async () => routines} today={today} />);

    expect(await screen.findByRole("heading", { name: "Утренняя зарядка" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Читать 20 минут" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Создать рутину" })).toBeEnabled();
    expect(screen.queryByText("Доступно после подключения API")).not.toBeInTheDocument();
  });

  it("фильтрует по статусу и поиску", async () => {
    const { user } = renderWithUser(
      <RoutineManagement listRules={async () => routines} today={today} />
    );

    await user.click(await screen.findByRole("radio", { name: "Приостановленные" }));
    expect(screen.getByRole("heading", { name: "Читать 20 минут" })).toBeInTheDocument();
    expect(screen.getByText("Найдено: 1")).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Поиск по названию" }), "бюджет");
    expect(screen.getByRole("heading", { name: "Ничего не найдено" })).toBeInTheDocument();
  });

  it("ведёт к форме на странице и не открывает окно", async () => {
    const { user } = renderWithUser(
      <>
        <RoutineManagement listRules={async () => routines} today={today} />
        <RoutineLibraryEditor />
      </>
    );

    await user.click(await screen.findByRole("button", { name: "Создать рутину" }));

    expect(screen.queryByRole("heading", { name: "Новая рутина" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Название" })).toHaveFocus();
  });
});

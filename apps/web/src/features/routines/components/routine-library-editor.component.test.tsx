import type { RoutineRule } from "@dashboard/contracts";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithUser } from "@/test/render";

import { resetRoutineLibraryStoreForTests } from "../model/routine-library-store";

import { RoutineLibraryEditor } from "./routine-library-editor";
import { RoutineManagement } from "./routine-management";

const createdRule: RoutineRule = {
  id: "550e8400-e29b-41d4-a716-446655440010",
  title: "Вечерняя прогулка",
  description: null,
  startDate: "2026-11-27",
  endDate: null,
  recurrence: { kind: "daily" },
  reminderLocalTime: null,
  timezone: "Europe/Moscow",
  status: "active",
  createdAt: "2026-11-27T06:00:00.000Z",
  updatedAt: "2026-11-27T06:00:00.000Z"
};

describe("RoutineLibraryEditor", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetRoutineLibraryStoreForTests();
  });

  it("сохраняет новую рутину в аккаунт и показывает её среди активных", async () => {
    let saved = false;
    const createRule = vi.fn(async () => {
      saved = true;
      return createdRule;
    });
    const { user } = renderWithUser(
      <>
        <RoutineManagement listRules={async () => (saved ? [createdRule] : [])} today="2026-11-27" />
        <RoutineLibraryEditor createRule={createRule} />
      </>
    );

    expect(await screen.findByRole("heading", { name: "Рутин пока нет" })).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "Название" }), "Вечерняя прогулка");
    await user.click(screen.getByRole("button", { name: "Сохранить рутину" }));

    expect(createRule).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Вечерняя прогулка",
        recurrence: { kind: "daily" },
        status: "active",
        endDate: null
      }),
      expect.stringMatching(/^routine-/)
    );
    expect(await screen.findByRole("heading", { name: "Вечерняя прогулка" })).toBeInTheDocument();
    expect(screen.getByText("Найдено: 1")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "На этом устройстве" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Рутина добавлена в список активных.");
  });
});

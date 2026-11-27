import type { RoutineRule } from "@dashboard/contracts";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageScaffold } from "@/components/ui/page-scaffold";
import { renderWithUser } from "@/test/render";

import { RoutineManagement } from "./components/routine-management";

const completed: RoutineRule = {
  id: "550e8400-e29b-41d4-a716-446655440002",
  title: "Проверить бюджет",
  description: null,
  startDate: "2020-10-21",
  endDate: "2020-10-21",
  recurrence: { kind: "once" },
  reminderLocalTime: null,
  timezone: "Europe/Moscow",
  status: "active",
  createdAt: "2026-11-01T05:00:00.000Z",
  updatedAt: "2026-11-01T05:00:00.000Z"
};

describe("страница рутин", () => {
  it("соединяет каркас страницы с поиском и фильтрами рутин", async () => {
    const { user } = renderWithUser(
      <PageScaffold
        contentVariant="plain"
        description="Создавайте повторяющиеся дела и следите за выполнением на выбранную дату."
        eyebrow="Планирование"
        title="Рутинные дела"
      >
        <RoutineManagement listRules={async () => [completed]} today="2026-11-27" />
      </PageScaffold>
    );

    expect(screen.getByRole("heading", { level: 1, name: "Рутинные дела" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Рутинные дела" })).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Завершённые" }));

    expect(await screen.findByRole("heading", { name: "Проверить бюджет" })).toBeInTheDocument();
    expect(screen.getByText("Найдено: 1")).toBeInTheDocument();
  });
});

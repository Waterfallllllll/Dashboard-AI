import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageScaffold } from "@/components/ui/page-scaffold";
import { renderWithUser } from "@/test/render";

import { RoutineManagement } from "./components/routine-management";

describe("страница рутин", () => {
  it("соединяет каркас страницы с поиском и фильтрами рутин", async () => {
    const { user } = renderWithUser(
      <PageScaffold
        contentVariant="plain"
        description="Создавайте повторяющиеся дела и следите за выполнением на выбранную дату."
        eyebrow="Планирование"
        title="Рутинные дела"
      >
        <RoutineManagement />
      </PageScaffold>
    );

    expect(screen.getByRole("heading", { level: 1, name: "Рутинные дела" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Рутинные дела" })).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Завершённые" }));

    expect(screen.getByRole("heading", { name: "Проверить бюджет" })).toBeInTheDocument();
    expect(screen.getByText("Найдено: 1")).toBeInTheDocument();
  });
});

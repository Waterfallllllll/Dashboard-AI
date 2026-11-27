import { expect, test, type Page, type Route } from "@playwright/test";

const session = {
  data: {
    user: {
      id: "64b7f0c2a1d4e8f01a2b3c4d",
      displayName: "Илья",
      avatarUrl: null,
      locale: "ru",
      timezone: "Europe/Moscow",
      timeFormat: "24",
      theme: "light",
      createdAt: "2026-11-11T08:30:00.000Z",
      updatedAt: "2026-11-11T08:30:00.000Z"
    },
    expiresAt: "2026-11-25T08:30:00.000Z",
    csrfToken: "a".repeat(43)
  },
  meta: { requestId: "request-1" }
};

function rule(
  id: string,
  title: string,
  patch: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id,
    title,
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
  rule("550e8400-e29b-41d4-a716-446655440000", "Утренняя зарядка", {
    reminderLocalTime: "08:00"
  }),
  rule("550e8400-e29b-41d4-a716-446655440001", "Читать 20 минут", { status: "paused" }),
  rule("550e8400-e29b-41d4-a716-446655440002", "Проверить бюджет", {
    startDate: "2020-10-21",
    endDate: "2020-10-21",
    recurrence: { kind: "once" }
  })
];

async function fulfillJson(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body)
  });
}

async function mockRoutines(page: Page): Promise<void> {
  await page.route("**/api/v1/auth/session", (route) => fulfillJson(route, 200, session));
  await page.route("**/api/v1/routine-rules**", async (route) => {
    if (route.request().method() === "POST") {
      expect(route.request().headers()["x-csrf-token"]).toBe(session.data.csrfToken);
      expect(route.request().headers()["idempotency-key"]).toMatch(/^routine-/);
      const body = route.request().postDataJSON() as {
        title: string;
        startDate: string;
        recurrence: { kind: string };
      };
      await fulfillJson(route, 201, {
        data: rule("550e8400-e29b-41d4-a716-446655440003", body.title, {
          startDate: body.startDate,
          recurrence: body.recurrence,
          status: "active"
        }),
        meta: { requestId: "request-2" }
      });
      return;
    }

    await fulfillJson(route, 200, {
      data: routines,
      meta: { requestId: "request-1", page: { nextCursor: null } }
    });
  });
}

test.describe("рутины и интеграции", () => {
  test("фильтрует рутины и ведёт к форме на странице", async ({ page }) => {
    await mockRoutines(page);
    await page.goto("/settings/routines");

    await expect(page.getByRole("heading", { name: "Утренняя зарядка" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Создать рутину" })).toBeEnabled();
    await expect(page.getByText("Доступно после подключения API")).toHaveCount(0);

    await page.locator("label").filter({ hasText: "Приостановленные" }).click();
    await expect(page.getByRole("heading", { name: "Читать 20 минут" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Утренняя зарядка" })).toHaveCount(0);

    await page.getByRole("searchbox", { name: "Поиск по названию" }).fill("бюджет");
    await expect(page.getByRole("heading", { name: "Ничего не найдено" })).toBeVisible();

    await page.getByRole("searchbox", { name: "Поиск по названию" }).fill("");
    await page.getByRole("button", { name: "Создать рутину" }).click();
    await expect(page.getByRole("heading", { name: "Новая рутина" })).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "Название" })).toBeFocused();
  });

  test("показывает интеграции MVP и включает подключение календаря", async ({ page }) => {
    await page.goto("/settings/integrations");

    await expect(page.getByRole("heading", { name: "Google Calendar" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Telegram" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Местоположение" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Уведомления браузера" })).toBeVisible();

    await expect(page.getByRole("button", { name: "Подключить календарь" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Подключить Telegram" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Определить место" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Сохранить город" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Включить уведомления" })).toBeVisible();
  });
});

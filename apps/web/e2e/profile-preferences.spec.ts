import { expect, test, type Page, type Route } from "@playwright/test";

const session = {
  data: {
    user: {
      id: "64b7f0c2a1d4e8f01a2b3c4d",
      displayName: "Илья",
      avatarUrl: "https://lh3.googleusercontent.com/a/a",
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

async function fulfillJson(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body)
  });
}

async function showGuest(page: Page): Promise<void> {
  await page.route("**/api/v1/auth/session", (route) => fulfillJson(route, 401, {}));
}

test.describe("профиль", () => {
  test("сохраняет часовой пояс и тему между перезагрузками", async ({ page }) => {
    await showGuest(page);
    await page.goto("/settings/profile");

    await page.getByLabel("Часовой пояс").selectOption("Europe/Moscow");
    await page.getByRole("radio", { name: "12 часов" }).check();
    await page.getByLabel("Тема интерфейса").selectOption("dark");
    await page.getByRole("button", { name: "Сохранить предпочтения" }).click();

    await expect(page.getByText("Предпочтения сохранены в этом браузере.")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.reload();

    await expect(page.getByLabel("Часовой пояс")).toHaveValue("Europe/Moscow");
    await expect(page.getByRole("radio", { name: "12 часов" })).toBeChecked();
    await expect(page.getByLabel("Тема интерфейса")).toHaveValue("dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("показывает гостя и не даёт выйти без сессии", async ({ page }) => {
    await showGuest(page);
    await page.goto("/settings/profile");

    await expect(page.getByText("Не авторизован")).toBeVisible();
    await expect(page.getByRole("link", { name: "Войти через Google" })).toHaveAttribute(
      "href",
      "/api/v1/auth/google"
    );
    await expect(page.getByRole("button", { name: "Выйти" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Удалить аккаунт" })).toBeDisabled();
  });

  test("показывает текущий аккаунт и завершает вход", async ({ page }) => {
    await page.route("**/api/v1/auth/session", (route) => fulfillJson(route, 200, session));
    await page.route("**/api/v1/auth/logout", (route) =>
      fulfillJson(route, 200, {
        data: { signedOut: true },
        meta: { requestId: "request-2" }
      })
    );
    await page.goto("/settings/profile");

    await expect(page.getByRole("heading", { name: "Илья" })).toBeVisible();
    await expect(page.getByText("Авторизован")).toBeVisible();
    await expect(page.locator("img")).toHaveAttribute("src", session.data.user.avatarUrl);

    const logoutRequest = page.waitForRequest(
      (request) => request.url().includes("/api/v1/auth/logout") && request.method() === "POST"
    );
    await page.getByRole("button", { name: "Выйти" }).click();
    expect((await logoutRequest).headers()["x-csrf-token"]).toBe(session.data.csrfToken);

    await expect(page).toHaveURL(/\/login$/);
  });

  test("после подтверждения удаляет аккаунт и уходит на вход", async ({ page }) => {
    await page.route("**/api/v1/auth/session", (route) => fulfillJson(route, 200, session));
    await page.route("**/api/v1/account", (route) => {
      if (route.request().method() !== "DELETE") {
        return route.fallback();
      }

      return fulfillJson(route, 200, {
        data: { deleted: true },
        meta: { requestId: "request-3" }
      });
    });
    await page.goto("/settings/profile");

    await expect(page.getByRole("heading", { name: "Илья" })).toBeVisible();
    await page.getByRole("button", { name: "Удалить аккаунт" }).click();
    const dialog = page.getByRole("dialog", { name: "Удалить аккаунт?" });
    await expect(dialog).toBeVisible();

    const deleteRequest = page.waitForRequest(
      (request) => request.url().includes("/api/v1/account") && request.method() === "DELETE"
    );
    await dialog.getByRole("button", { name: "Удалить аккаунт" }).click();
    expect((await deleteRequest).headers()["x-csrf-token"]).toBe(session.data.csrfToken);

    await expect(page).toHaveURL(/\/login$/);
  });
});

import { expect, test } from "@playwright/test";

test.describe("рутины и интеграции", () => {
  test("фильтрует рутины и блокирует создание до API", async ({ page }) => {
    await page.goto("/settings/routines");

    await expect(page.getByRole("heading", { name: "Утренняя зарядка" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Создать рутину" })).toBeDisabled();

    await page.locator("label").filter({ hasText: "Приостановленные" }).click();
    await expect(page.getByRole("heading", { name: "Читать 20 минут" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Утренняя зарядка" })).toHaveCount(0);

    await page.getByRole("searchbox", { name: "Поиск по названию" }).fill("бюджет");
    await expect(page.getByRole("heading", { name: "Ничего не найдено" })).toBeVisible();
  });

  test("показывает интеграции MVP и блокирует подключение до API", async ({ page }) => {
    await page.goto("/settings/integrations");

    await expect(page.getByRole("heading", { name: "Google Calendar" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Telegram" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Местоположение" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Уведомления браузера" })).toBeVisible();

    await expect(page.getByRole("button", { name: "Подключить календарь" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Подключить Telegram" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Настроить локацию" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Включить уведомления" })).toBeDisabled();
  });
});

import { expect, test } from "@playwright/test";

test.describe("профиль", () => {
  test("сохраняет часовой пояс и тему между перезагрузками", async ({ page }) => {
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

  test("не даёт выйти и удалить аккаунт до backend-сессии", async ({ page }) => {
    await page.goto("/settings/profile");

    await expect(page.getByRole("button", { name: "Выйти" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Удалить аккаунт" })).toBeDisabled();
    await expect(page.getByText("Не авторизован")).toBeVisible();
  });
});

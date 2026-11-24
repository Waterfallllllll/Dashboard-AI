import { expect, test } from "@playwright/test";

test.describe("публичный доступ", () => {
  test("открывает вход через Google", async ({ page }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: "Важное — перед глазами. Лишнее — вне фокуса." })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Продолжить с Google/ })).toHaveAttribute(
      "href",
      "/api/v1/auth/google"
    );
    await expect(
      page.getByText("Google запросит только имя, адрес почты и профиль.")
    ).toBeVisible();
    await expect(page.getByText(/Мы не храним OAuth-токены в браузере/)).toBeVisible();

    const storageKeys = await page.evaluate(() => Object.keys(window.localStorage));

    expect(storageKeys.some((key) => /oauth|token|session/i.test(key))).toBe(false);
  });

  test("открывает политику конфиденциальности и условия использования", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("link", { name: "политикой конфиденциальности" }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Политика конфиденциальности" })
    ).toBeVisible();

    await page
      .getByRole("navigation", { name: "Юридическая информация" })
      .getByRole("link", {
        name: "Условия"
      })
      .click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Условия использования" })
    ).toBeVisible();
  });

  test("показывает ошибку OAuth из query-параметра", async ({ page }) => {
    await page.goto("/login?status=error");

    await expect(
      page.getByText("Не удалось завершить вход через Google. Повторите попытку позже.")
    ).toBeVisible();
  });
});

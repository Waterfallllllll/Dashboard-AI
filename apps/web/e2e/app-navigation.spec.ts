import { expect, test } from "@playwright/test";

import { isMobileProject, mobileNav, primaryNav } from "./support/app";

test.describe("навигация приложения", () => {
  test("перенаправляет с корня на дашборд", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1, name: "Ваш день в одном месте" })).toBeVisible();
  });

  test("desktop ведёт по боковой навигации к рутинам и профилю", async ({ page }, testInfo) => {
    test.skip(isMobileProject(testInfo.project.name), "сценарий для desktop");

    await page.goto("/dashboard");

    await expect(primaryNav(page)).toBeVisible();
    await expect(mobileNav(page)).toBeHidden();

    await primaryNav(page).getByRole("link", { name: "Рутины" }).click();
    await expect(page).toHaveURL(/\/settings\/routines$/);
    await expect(page.getByRole("heading", { level: 1, name: "Рутинные дела" })).toBeVisible();
    await expect(primaryNav(page).getByRole("link", { name: "Рутины" })).toHaveAttribute(
      "aria-current",
      "page"
    );

    await page.getByRole("link", { name: "Открыть профиль" }).click();
    await expect(page).toHaveURL(/\/settings\/profile$/);
    await expect(page.getByRole("heading", { level: 1, name: "Профиль" })).toBeVisible();
  });

  test("mobile использует нижнюю навигацию Главная / Рутины / Настройки", async ({
    page
  }, testInfo) => {
    test.skip(!isMobileProject(testInfo.project.name), "сценарий для mobile");

    await page.goto("/dashboard");

    await expect(mobileNav(page)).toBeVisible();
    await expect(primaryNav(page)).toBeHidden();

    await mobileNav(page).getByRole("link", { name: "Рутины" }).click();
    await expect(page).toHaveURL(/\/settings\/routines$/);
    await expect(mobileNav(page).getByRole("link", { name: "Рутины" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await expect(mobileNav(page).getByRole("link", { name: "Настройки" })).not.toHaveAttribute(
      "aria-current"
    );

    await mobileNav(page).getByRole("link", { name: "Настройки" }).click();
    await expect(page).toHaveURL(/\/settings\/widgets$/);
    await expect(page.getByRole("heading", { level: 1, name: "Виджеты" })).toBeVisible();
    await expect(mobileNav(page).getByRole("link", { name: "Настройки" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });
});

import { expect, test } from "@playwright/test";

import { isMobileProject } from "./support/app";

test.describe("сетка дашборда", () => {
  test("показывает виджеты на мок-данных", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { level: 1, name: "Ваш день в одном месте" })
    ).toBeVisible();
    await expect(page.getByRole("article", { name: "Дата и время" })).toHaveAttribute(
      "data-status",
      "success"
    );
    await expect(page.getByRole("article", { name: "Погода" })).toContainText("Москва");
    await expect(page.getByRole("article", { name: "Календарь" })).toContainText(
      "Стендап команды"
    );
    await expect(page.getByRole("article", { name: "Рутины" })).toContainText("Погладить кота");
    await expect(page.getByRole("article", { name: "Таймер" })).toContainText("Работа");
    await expect(page.getByRole("article", { name: "Новости" })).toContainText("OpenAI");
  });

  test("действие в одном виджете не блокирует остальные", async ({ page }) => {
    await page.goto("/dashboard");

    await page.getByRole("checkbox", { name: "Погладить кота" }).click();

    await expect(page.getByRole("article", { name: "Рутины" })).toContainText("2 / 3");
    await expect(page.getByRole("article", { name: "Погода" })).toContainText("Москва");
    await expect(page.getByRole("article", { name: "Новости" })).toContainText("OpenAI");
  });

  test("на mobile карточки складываются без горизонтального скролла", async ({
    page
  }, testInfo) => {
    test.skip(!isMobileProject(testInfo.project.name), "сценарий для mobile");

    await page.goto("/dashboard");

    const timeBox = await page.getByRole("article", { name: "Дата и время" }).boundingBox();
    const weatherBox = await page.getByRole("article", { name: "Погода" }).boundingBox();

    expect(timeBox).toBeTruthy();
    expect(weatherBox).toBeTruthy();
    expect((weatherBox?.y ?? 0) > (timeBox?.y ?? 0)).toBe(true);

    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth - document.documentElement.clientWidth;
    });

    expect(overflow).toBeLessThanOrEqual(1);
  });
});

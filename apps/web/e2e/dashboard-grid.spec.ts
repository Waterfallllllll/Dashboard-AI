import { expect, test } from "@playwright/test";

import { isMobileProject } from "./support/app";

test.describe("сетка дашборда", () => {
  test("показывает независимые состояния виджетов", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { level: 1, name: "Ваш день в одном месте" })
    ).toBeVisible();
    await expect(page.getByRole("article", { name: "Дата и время" })).toHaveAttribute(
      "data-status",
      "success"
    );
    await expect(page.getByRole("article", { name: "Погода" })).toHaveAttribute(
      "data-status",
      "loading"
    );
    await expect(page.getByRole("article", { name: "Календарь" })).toHaveAttribute(
      "data-status",
      "disconnected"
    );
    await expect(page.getByRole("article", { name: "Рутины" })).toHaveAttribute(
      "data-status",
      "empty"
    );
    await expect(page.getByRole("article", { name: "Таймер" })).toHaveAttribute(
      "data-status",
      "error"
    );
    await expect(page.getByRole("article", { name: "Новости" })).toHaveAttribute(
      "data-status",
      "stale"
    );
    await expect(
      page
        .getByRole("article", { name: "Новости" })
        .locator("footer")
        .getByText("Данные могут быть устаревшими")
    ).toBeVisible();
  });

  test("повтор таймера не блокирует остальные виджеты", async ({ page }) => {
    await page.goto("/dashboard");

    await page.getByRole("button", { name: "Повторить" }).click();

    await expect(page.getByRole("article", { name: "Таймер" })).toHaveAttribute(
      "data-status",
      "success"
    );
    await expect(page.getByRole("article", { name: "Погода" })).toHaveAttribute(
      "data-status",
      "loading"
    );
    await expect(page.getByRole("article", { name: "Новости" })).toHaveAttribute(
      "data-status",
      "stale"
    );
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

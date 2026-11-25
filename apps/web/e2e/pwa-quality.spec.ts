import { expect, test } from "@playwright/test";

import { isMobileProject } from "./support/app";

test.describe("PWA, доступность и производительность", () => {
  test("отдаёт манифест и регистрирует service worker", async ({ page }) => {
    await page.goto("/dashboard");

    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(manifestHref).toBeTruthy();
    const manifestResponse = await page.request.get(manifestHref ?? "");
    expect(manifestResponse.ok()).toBe(true);
    const manifest = (await manifestResponse.json()) as {
      display?: string;
      start_url?: string;
      icons?: unknown[];
    };
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/dashboard");
    expect(manifest.icons?.length).toBeGreaterThanOrEqual(2);

    const workerResponse = await page.request.get("/sw.js");
    expect(workerResponse.ok()).toBe(true);
    expect(workerResponse.headers()["content-type"]).toContain("javascript");
    expect(await page.request.get("/offline.html")).toBeTruthy();

    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          return registration?.active?.state ?? "";
        })
      )
      .toBe("activated");
  });

  test("не даёт горизонтальный скролл на основных ширинах", async ({ page }, testInfo) => {
    test.skip(isMobileProject(testInfo.project.name), "ширины задаются явно");

    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });

      for (const path of ["/dashboard", "/settings/routines", "/settings/integrations"]) {
        await page.goto(path);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        expect(overflow, `${path} @ ${width}`).toBeLessThanOrEqual(1);
      }
    }
  });

  test("увеличивает текст до 200% без горизонтального скролла", async ({ page }, testInfo) => {
    test.skip(isMobileProject(testInfo.project.name), "проверка на широком окне");

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "32px";
    });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );

    expect(overflow).toBeLessThanOrEqual(1);
    await expect(
      page.getByRole("heading", { level: 1, name: "Ваш день в одном месте" })
    ).toBeVisible();
  });

  test("переводит фокус к содержимому с клавиатуры", async ({ page }) => {
    await page.goto("/dashboard");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Перейти к содержимому" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("сохраняет рутину, выполнение и состояние таймера", async ({ page }) => {
    await page.goto("/settings/routines");
    await page.getByLabel("Название").fill("Проверить PWA");
    await page.getByRole("button", { name: "Сохранить рутину" }).click();
    await expect(page.getByText("Сохранено на этом устройстве.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Проверить PWA" })).toBeVisible();

    await page.goto("/dashboard");
    const checkbox = page.getByRole("checkbox", { name: "Проверить PWA" });
    await checkbox.check();
    await expect(checkbox).toBeChecked();

    await page.getByRole("button", { name: "Старт" }).click();
    await expect(page.getByRole("button", { name: "Пауза" })).toBeVisible();
    await page.getByRole("button", { name: "Пауза" }).click();
    await expect(page.getByRole("button", { name: "Старт" })).toBeVisible();
  });

  test("запрашивает место только по кнопке", async ({ page }) => {
    await page.goto("/settings/integrations");

    await page.getByRole("button", { name: "Определить место" }).click();
    await expect(page.getByText(/запретил доступ к месту|не отдаёт координаты/)).toBeVisible();
  });

  test("сохраняет скрытие виджета после перезагрузки", async ({ page }) => {
    await page.goto("/settings/widgets");
    const newsSwitch = page.getByRole("switch", { name: "Показывать «Новости»" });
    await newsSwitch.evaluate((element) => {
      element.scrollIntoView({ block: "center" });
    });
    await newsSwitch.click();
    await expect(page.getByText("Сохранено.")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("switch", { name: "Показывать «Новости»" })).not.toBeChecked();
    await page.goto("/dashboard");
    await expect(page.getByRole("article", { name: "Новости" })).toHaveCount(0);
  });

  test("удерживает сдвиг макета и быстрый отклик таймера", async ({ page }) => {
    await page.addInitScript(() => {
      let score = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
          if (!shift.hadRecentInput) {
            score += shift.value ?? 0;
          }
        }
      });
      observer.observe({ type: "layout-shift", buffered: true });
      Object.defineProperty(window, "__layoutShift", {
        configurable: true,
        get: () => score
      });
    });
    await page.goto("/dashboard");
    await page.getByRole("heading", { level: 1, name: "Ваш день в одном месте" }).waitFor();

    const shift = await page.evaluate(() => {
      const score = (window as unknown as { __layoutShift?: number }).__layoutShift ?? 0;
      return score;
    });
    expect(shift).toBeLessThanOrEqual(0.1);

    await page.getByRole("button", { name: "Старт" }).waitFor();
    const responseMs = await page.evaluate(() => {
      const button = document.querySelector<HTMLButtonElement>('[aria-label="Старт"]');
      if (!button) {
        return 1_000;
      }
      const started = performance.now();
      button.click();
      return performance.now() - started;
    });
    expect(responseMs).toBeLessThan(200);
    await expect(page.getByRole("button", { name: "Пауза" })).toBeVisible();
  });
});

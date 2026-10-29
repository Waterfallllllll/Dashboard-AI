import type { Page } from "@playwright/test";

export function primaryNav(page: Page) {
  return page.getByRole("navigation", { name: "Основная навигация" });
}

export function mobileNav(page: Page) {
  return page.getByRole("navigation", { name: "Мобильная навигация" });
}

export function isMobileProject(projectName: string): boolean {
  return projectName === "mobile-chromium";
}

import { describe, expect, it } from "vitest";

import { isExactPath, isMobileSettingsPath, isPathPrefix } from "./navigation-model";

describe("navigation-model", () => {
  it("отмечает точный путь дашборда", () => {
    expect(isExactPath("/dashboard", "/dashboard")).toBe(true);
    expect(isExactPath("/dashboard/today", "/dashboard")).toBe(false);
  });

  it("отмечает вложенные настройки по префиксу", () => {
    expect(isPathPrefix("/settings/profile", "/settings/profile")).toBe(true);
    expect(isPathPrefix("/settings/profile/sessions", "/settings/profile")).toBe(true);
    expect(isPathPrefix("/settings/widgets", "/settings/profile")).toBe(false);
  });

  it("в мобильной навигации «Настройки» не перехватывают рутины", () => {
    expect(isMobileSettingsPath("/settings/widgets")).toBe(true);
    expect(isMobileSettingsPath("/settings/profile")).toBe(true);
    expect(isMobileSettingsPath("/settings/routines")).toBe(false);
    expect(isMobileSettingsPath("/dashboard")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  canRefreshWidget,
  canRetryWidget,
  getWidgetStatusCopy,
  showsStaleNotice,
  showsWidgetContent
} from "./widget-status";

describe("widget status", () => {
  it("показывает содержимое только при успехе и устаревших данных", () => {
    expect(showsWidgetContent("success")).toBe(true);
    expect(showsWidgetContent("stale")).toBe(true);
    expect(showsWidgetContent("loading")).toBe(false);
    expect(showsWidgetContent("error")).toBe(false);
    expect(showsStaleNotice("stale")).toBe(true);
    expect(showsStaleNotice("success")).toBe(false);
  });

  it("разрешает повтор только для ошибки и обновление для внешнего источника", () => {
    expect(canRetryWidget("error")).toBe(true);
    expect(canRetryWidget("empty")).toBe(false);
    expect(canRefreshWidget("stale", true)).toBe(true);
    expect(canRefreshWidget("loading", true)).toBe(false);
    expect(canRefreshWidget("success", false)).toBe(false);
  });

  it("формулирует ошибку как проблему и действие", () => {
    const copy = getWidgetStatusCopy("timer", "error");

    expect(copy?.title).toBe("Не удалось обновить данные");
    expect(copy?.action).toEqual({ label: "Повторить", kind: "retry" });
  });

  it("ведёт disconnected и permission на настройки интеграций", () => {
    expect(getWidgetStatusCopy("calendar", "disconnected")?.action).toEqual({
      label: "Подключить",
      kind: "link",
      href: "/settings/integrations"
    });
    expect(getWidgetStatusCopy("weather", "permission-required")?.action?.href).toBe(
      "/settings/integrations"
    );
  });
});

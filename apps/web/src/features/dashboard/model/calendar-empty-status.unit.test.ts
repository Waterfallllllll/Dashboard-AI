import { describe, expect, it } from "vitest";

import { getWidgetStatusCopy } from "./widget-status";

describe("пустой календарь", () => {
  it("объясняет отсутствие событий и не ведёт в настройки виджетов", () => {
    expect(getWidgetStatusCopy("calendar", "empty")).toEqual({
      title: "На сегодня событий нет",
      description: "Завершившиеся события скрыты. Обновление запросит список у Google Calendar."
    });
    expect(getWidgetStatusCopy("calendar", "empty", "placeholder")?.title).toBe("Пока нет данных");
    expect(getWidgetStatusCopy("timer", "empty")?.action).toEqual({
      label: "Настроить виджеты",
      kind: "link",
      href: "/settings/widgets"
    });
  });
});

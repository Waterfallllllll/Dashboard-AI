import type { RoutineRule } from "@dashboard/contracts";
import { describe, expect, it } from "vitest";

import { presentRoutineRule } from "./present-routine-rule";

const today = "2026-11-27";

function rule(patch: Partial<RoutineRule> = {}): RoutineRule {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    title: "Утренняя зарядка",
    description: null,
    startDate: "2026-11-01",
    endDate: null,
    recurrence: { kind: "daily" },
    reminderLocalTime: "08:00",
    timezone: "Europe/Moscow",
    status: "active",
    createdAt: "2026-11-01T05:00:00.000Z",
    updatedAt: "2026-11-01T05:00:00.000Z",
    ...patch
  };
}

describe("карточка рутины", () => {
  it("показывает расписание и три ближайшие даты", () => {
    const card = presentRoutineRule(rule(), today);

    expect(card).toMatchObject({
      status: "active",
      statusLabel: "Активна",
      schedule: "Ежедневно · 08:00"
    });
    expect(card.nextDates).toEqual(["Сегодня", "28 нояб.", "29 нояб."]);
  });

  it("считает прошедшее одноразовое дело завершённым, а паузу — без новых дат", () => {
    const completed = presentRoutineRule(
      rule({
        title: "Проверить бюджет",
        startDate: "2026-10-21",
        endDate: "2026-10-21",
        recurrence: { kind: "once" },
        reminderLocalTime: null
      }),
      today
    );
    const paused = presentRoutineRule(rule({ status: "paused", reminderLocalTime: null }), today);

    expect(completed).toMatchObject({
      status: "completed",
      statusLabel: "Завершена",
      schedule: "Однократно · 21 окт. · без напоминания",
      nextDates: ["Выполнено 21 окт."]
    });
    expect(paused).toMatchObject({
      status: "paused",
      schedule: "Ежедневно · без напоминания",
      nextDates: []
    });
  });

  it("собирает выбранные дни с понедельника", () => {
    const card = presentRoutineRule(
      rule({
        recurrence: { kind: "weekly", days: [0, 3, 1] },
        reminderLocalTime: "09:30"
      }),
      today
    );

    expect(card.schedule).toBe("пн, ср, вс · 09:30");
  });
});

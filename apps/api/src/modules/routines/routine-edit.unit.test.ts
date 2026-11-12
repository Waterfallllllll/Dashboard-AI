import { describe, expect, it } from "vitest";

import { isEditProblem, planRuleEdit } from "./routine-edit.js";
import type { RoutineRuleRecord } from "./routines.types.js";

const now = new Date("2026-11-11T12:00:00.000Z");

function rule(overrides: Partial<RoutineRuleRecord> = {}): RoutineRuleRecord {
  return {
    id: "a".repeat(24),
    userId: "b".repeat(24),
    title: "Зарядка",
    description: null,
    startDate: "2026-11-01",
    endDate: null,
    recurrence: { kind: "daily" },
    reminderLocalTime: null,
    timezone: "Europe/Moscow",
    status: "active",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides
  };
}

describe("изменение рутины", () => {
  it("обновляет весь шаблон и не трогает историю через отдельную команду", () => {
    const plan = planRuleEdit(rule(), { scope: "template", title: "Пробежка" });
    expect(plan).toEqual({ kind: "update", changes: { title: "Пробежка" } });
  });

  it("на выбранную дату создаёт одноразовое дело", () => {
    const plan = planRuleEdit(rule(), {
      scope: "date",
      date: "2026-11-11",
      title: "Только сегодня"
    });
    expect(plan).toMatchObject({
      kind: "replace-date",
      date: "2026-11-11",
      created: {
        title: "Только сегодня",
        startDate: "2026-11-11",
        endDate: "2026-11-11",
        recurrence: { kind: "once" }
      }
    });
  });

  it("с выбранной даты делит серию и оставляет прошлое у прежнего правила", () => {
    const plan = planRuleEdit(rule(), { scope: "following", date: "2026-11-11", title: "Дальше" });
    expect(plan).toMatchObject({
      kind: "split",
      date: "2026-11-11",
      previousEndDate: "2026-11-10",
      created: { title: "Дальше", startDate: "2026-11-11" }
    });
  });

  it("отклоняет день, в который рутина не выполняется", () => {
    const plan = planRuleEdit(rule({ recurrence: { kind: "once" }, startDate: "2026-11-01" }), {
      scope: "date",
      date: "2026-11-11",
      title: "Другой день"
    });
    expect(isEditProblem(plan) ? plan.message : "").toBe(
      "Одноразовое дело относится только к дате начала."
    );
  });
});

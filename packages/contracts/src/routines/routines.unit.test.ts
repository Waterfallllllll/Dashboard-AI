import { describe, expect, it } from "vitest";

import {
  routineOccurrencePatchSchema,
  routineRuleCreateSchema,
  routineRulePatchSchema
} from "./routines.js";

describe("рутины", () => {
  it("принимает еженедельное правило и отклоняет пустые дни, обратный диапазон и чужие поля", () => {
    expect(
      routineRuleCreateSchema.parse({
        title: "  Зарядка  ",
        description: "",
        startDate: "2026-11-11",
        recurrence: { kind: "weekly", days: [1, 3] },
        reminderLocalTime: "07:30"
      })
    ).toMatchObject({
      title: "Зарядка",
      description: null,
      reminderLocalTime: "07:30"
    });

    expect(
      routineRuleCreateSchema.safeParse({
        title: "Вода",
        startDate: "2026-11-11",
        endDate: "2026-11-01",
        recurrence: { kind: "daily" }
      }).success
    ).toBe(false);
    expect(
      routineRuleCreateSchema.safeParse({
        title: "Вода",
        startDate: "2026-11-11",
        recurrence: { kind: "weekly", days: [] },
        userId: "64b7f0c2a1d4e8f01a2b3c4d"
      }).success
    ).toBe(false);
    expect(
      routineRuleCreateSchema.safeParse({
        title: "<script>",
        startDate: "2026-11-11",
        recurrence: { kind: "once" }
      }).success
    ).toBe(false);
  });

  it("требует дату для изменения одного дня и хотя бы одно поле", () => {
    expect(routineRulePatchSchema.safeParse({ scope: "date", title: "Новое" }).success).toBe(false);
    expect(routineRulePatchSchema.safeParse({ scope: "template" }).success).toBe(false);
    expect(
      routineRulePatchSchema.parse({
        scope: "template",
        status: "paused"
      }).status
    ).toBe("paused");
    expect(routineOccurrencePatchSchema.safeParse({}).success).toBe(false);
    expect(routineOccurrencePatchSchema.parse({ status: "done" }).status).toBe("done");
  });
});

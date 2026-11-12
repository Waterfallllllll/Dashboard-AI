import { describe, expect, it } from "vitest";

import { listFilterStatus, occursOn } from "./routine-schedule.js";

const base = {
  startDate: "2026-11-11",
  endDate: null,
  status: "active" as const
};

describe("расписание рутины", () => {
  it("считает ежедневные, рабочие, выбранные дни и одноразовые даты", () => {
    expect(occursOn({ ...base, recurrence: { kind: "daily" } }, "2026-11-15")).toBe(true);
    expect(occursOn({ ...base, recurrence: { kind: "daily" } }, "2026-11-10")).toBe(false);
    expect(occursOn({ ...base, recurrence: { kind: "weekdays" } }, "2026-11-14")).toBe(false);
    expect(occursOn({ ...base, recurrence: { kind: "weekdays" } }, "2026-11-13")).toBe(true);
    expect(occursOn({ ...base, recurrence: { kind: "weekly", days: [1, 3] } }, "2026-11-11")).toBe(
      true
    );
    expect(occursOn({ ...base, recurrence: { kind: "once" } }, "2026-11-12")).toBe(false);
    expect(
      occursOn(
        { ...base, endDate: "2026-11-12", recurrence: { kind: "daily" }, status: "ended" },
        "2026-11-11"
      )
    ).toBe(false);
  });

  it("относит закончившуюся рутину к завершённым, а паузу с будущими датами — к паузе", () => {
    const daily = { ...base, recurrence: { kind: "daily" as const } };
    expect(listFilterStatus({ ...daily, endDate: "2026-11-10" }, "2026-11-11")).toBe("completed");
    expect(listFilterStatus({ ...daily, status: "paused" }, "2026-11-11")).toBe("paused");
    expect(listFilterStatus(daily, "2026-11-11")).toBe("active");
  });
});

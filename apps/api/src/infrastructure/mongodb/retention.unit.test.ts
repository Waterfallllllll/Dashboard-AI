import { describe, expect, it } from "vitest";

import { notificationDeleteAt } from "./retention.js";

describe("срок хранения журнала доставки", () => {
  it("считает deleteAt через 30 дней и отклоняет пустой срок", () => {
    const createdAt = new Date("2026-11-09T12:00:00.000Z");

    expect(notificationDeleteAt(createdAt).toISOString()).toBe("2026-12-09T12:00:00.000Z");
    expect(notificationDeleteAt(createdAt, 1).toISOString()).toBe("2026-11-10T12:00:00.000Z");
    expect(() => notificationDeleteAt(createdAt, 0)).toThrow(/Срок хранения/);
    expect(() => notificationDeleteAt(new Date(Number.NaN))).toThrow(/дата создания/);
  });
});

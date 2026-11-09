import { describe, expect, it } from "vitest";

import { activeDocumentFilter, restoreFields, softDeleteFields } from "./soft-delete.js";

describe("мягкое удаление", () => {
  it("помечает документ удалённым и возвращает его в выборку живых", () => {
    const now = new Date("2026-11-09T12:00:00.000Z");

    expect(activeDocumentFilter).toEqual({ deletedAt: null });
    expect(softDeleteFields(now)).toEqual({ deletedAt: now, updatedAt: now });
    expect(restoreFields(now)).toEqual({ deletedAt: null, updatedAt: now });
    expect(() => softDeleteFields(new Date(Number.NaN))).toThrow(/метка времени/);
  });
});

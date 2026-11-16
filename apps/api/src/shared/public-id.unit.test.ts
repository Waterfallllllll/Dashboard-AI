import { describe, expect, it } from "vitest";

import { deterministicEntityId, newEntityId, parseUuid } from "./public-id.js";
import { isUniqueViolation } from "./prisma-error.js";

describe("публичный идентификатор PostgreSQL", () => {
  it("принимает UUID и отклоняет прежний 24-символьный ключ в репозитории", () => {
    const id = newEntityId();

    expect(parseUuid(id)).toBe(id);
    expect(parseUuid("a".repeat(24))).toBeNull();
    expect(parseUuid("not-a-uuid")).toBeNull();
  });

  it("строит один и тот же UUID из одного семени", () => {
    const first = deterministicEntityId("routine-rule\0user\0key");
    const second = deterministicEntityId("routine-rule\0user\0key");

    expect(first).toBe(second);
    expect(parseUuid(first)).toBe(first);
    expect(deterministicEntityId("other")).not.toBe(first);
  });

  it("выдаёт UUID версии 7 в порядке времени", () => {
    const earlier = newEntityId(new Date("2026-11-16T12:00:00.000Z"));
    const later = newEntityId(new Date("2026-11-16T12:00:01.000Z"));

    expect(parseUuid(earlier)).toBe(earlier);
    expect(earlier[14]).toBe("7");
    expect(later[14]).toBe("7");
    expect(earlier < later).toBe(true);
    expect(earlier.replaceAll("-", "").slice(0, 12)).toBe(
      new Date("2026-11-16T12:00:00.000Z").getTime().toString(16).padStart(12, "0")
    );
  });

  it("узнаёт нарушение уникальности Prisma и код PostgreSQL 23505", () => {
    expect(isUniqueViolation({ code: "P2002" })).toBe(true);
    expect(isUniqueViolation({ code: "P2039", message: "Database error. Code: 23505" })).toBe(true);
    expect(isUniqueViolation({ code: "P2003", message: "foreign key" })).toBe(false);
    expect(isUniqueViolation(new Error("нет"))).toBe(false);
  });
});

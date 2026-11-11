import { describe, expect, it } from "vitest";

import {
  DEFAULT_PAGE_LIMIT,
  entityIdSchema,
  idempotencyKeySchema,
  localDateQuerySchema,
  localDateSchema,
  localTimeSchema,
  pageQuerySchema,
  timeZoneSchema,
  utcDateTimeSchema
} from "./primitives.js";

const entityId = "64b7f0c2a1d4e8f01a2b3c4d";

describe("общие поля API", () => {
  it("принимает публичный идентификатор, локальную дату и время UTC", () => {
    expect(entityIdSchema.parse(entityId)).toBe(entityId);
    expect(localDateSchema.parse("2024-02-29")).toBe("2024-02-29");
    expect(utcDateTimeSchema.parse("2026-11-11T08:30:00.123Z")).toBe("2026-11-11T08:30:00.123Z");
    expect(localTimeSchema.parse("09:05")).toBe("09:05");
  });

  it("отклоняет календарную несуществующую дату, смещение и объект идентификатора", () => {
    expect(localDateSchema.safeParse("2026-02-29").success).toBe(false);
    expect(localDateSchema.safeParse("2026-11-11T08:30:00Z").success).toBe(false);
    expect(utcDateTimeSchema.safeParse("2026-11-11T08:30:00+03:00").success).toBe(false);
    expect(entityIdSchema.safeParse({ _id: entityId }).success).toBe(false);
    expect(localTimeSchema.safeParse("24:00").success).toBe(false);
  });

  it("принимает известный часовой пояс и отклоняет локальное значение auto", () => {
    expect(timeZoneSchema.parse("Europe/Moscow")).toBe("Europe/Moscow");
    expect(timeZoneSchema.safeParse("auto").success).toBe(false);
    expect(timeZoneSchema.safeParse("Europe/NotARealZone").success).toBe(false);
  });

  it("читает дату и страницу из query-строк", () => {
    expect(localDateQuerySchema.parse({ date: "2026-11-11" }).date).toBe("2026-11-11");
    expect(pageQuerySchema.parse({})).toEqual({ limit: DEFAULT_PAGE_LIMIT });
    expect(pageQuerySchema.parse({ cursor: "next_page", limit: "50" })).toEqual({
      cursor: "next_page",
      limit: 50
    });
    expect(pageQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
    expect(pageQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
    expect(pageQuerySchema.safeParse({ limit: ["20"] }).success).toBe(false);
    expect(pageQuerySchema.safeParse({ cursor: "bad cursor" }).success).toBe(false);
  });

  it("принимает ключ идемпотентности и отклоняет перевод строки", () => {
    expect(idempotencyKeySchema.parse("timer:abc12345:work-completed")).toBe(
      "timer:abc12345:work-completed"
    );
    expect(idempotencyKeySchema.safeParse("timer:abc\r\nSet-Cookie").success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { API_ERROR_CODES, API_ERROR_MESSAGES, parseDto } from "./api-error.js";

const secret = "super-secret-value";

const sampleSchema = z.strictObject({
  title: z.string().max(20, { error: "Название слишком длинное." }),
  secret: z.string().regex(/^ok$/, { error: "Некорректный формат." }),
  count: z.number(),
  widgets: z.array(
    z.strictObject({
      size: z.enum(["compact", "standard"], { error: "Некорректный размер." })
    })
  )
});

describe("разбор DTO", () => {
  it("возвращает данные, если тело совпало со схемой", () => {
    const parsed = parseDto(sampleSchema, {
      title: "Утро",
      secret: "ok",
      count: 1,
      widgets: [{ size: "compact" }]
    });

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.title).toBe("Утро");
    }
  });

  it("собирает ошибки полей и не возвращает введённый секрет", () => {
    const parsed = parseDto(sampleSchema, {
      title: secret.repeat(3),
      secret,
      count: "12",
      widgets: [{ size: "huge" }],
      accessToken: secret
    });

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe(API_ERROR_CODES.validationFailed);
      expect(parsed.error.message).toBe(API_ERROR_MESSAGES.VALIDATION_FAILED);
      expect(parsed.error.fieldErrors.title).toEqual(["Название слишком длинное."]);
      expect(parsed.error.fieldErrors.secret).toEqual(["Некорректный формат."]);
      expect(parsed.error.fieldErrors.count).toEqual(["Некорректное значение."]);
      expect(parsed.error.fieldErrors["widgets.0.size"]).toEqual(["Некорректный размер."]);
      expect(parsed.error.fieldErrors.accessToken).toEqual(["Это поле не поддерживается."]);
    }

    const serialized = JSON.stringify(parsed);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("pattern");
    expect(serialized).not.toContain("expected");
    expect(serialized).not.toContain("Invalid input");
  });
});

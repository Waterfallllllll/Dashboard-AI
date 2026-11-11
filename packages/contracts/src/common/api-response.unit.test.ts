import { describe, expect, it } from "vitest";
import { z } from "zod";

import { API_ERROR_CODES, API_ERROR_MESSAGES } from "./api-error.js";
import {
  apiErrorResponseSchema,
  apiListSchema,
  apiSuccessSchema,
  createErrorResponse,
  healthResponseSchema
} from "./api-response.js";
import { entityIdSchema } from "./primitives.js";

const requestId = "req_12345678";
const entityId = "64b7f0c2a1d4e8f01a2b3c4d";

describe("конверт ответа API", () => {
  it("принимает успешный ответ и не пропускает внутреннее поле", () => {
    const schema = apiSuccessSchema(z.strictObject({ id: entityIdSchema }));
    const meta = { requestId };

    expect(schema.parse({ data: { id: entityId }, meta }).data.id).toBe(entityId);
    expect(
      schema.safeParse({
        data: { id: entityId, _id: entityId },
        meta
      }).success
    ).toBe(false);
    expect(schema.safeParse({ data: { id: entityId }, meta, stack: "Error" }).success).toBe(false);
  });

  it("подставляет пустые ошибки полей и ответ health", () => {
    expect(
      apiErrorResponseSchema.parse({
        error: { code: "ROUTINE_NOT_FOUND", message: "Рутина не найдена" },
        meta: { requestId }
      }).error.fieldErrors
    ).toEqual({});

    expect(
      healthResponseSchema.parse({ data: { status: "ready" }, meta: { requestId } }).data.status
    ).toBe("ready");
  });

  it("описывает страницу курсором", () => {
    const schema = apiListSchema(z.strictObject({ id: entityIdSchema }));
    const parsed = schema.parse({
      data: [{ id: entityId }],
      meta: { requestId, page: { nextCursor: null } }
    });

    expect(parsed.meta.page.nextCursor).toBeNull();
    expect(schema.safeParse({ data: [], meta: { requestId } }).success).toBe(false);
  });

  it("не переносит секрет из сообщения и полей в тело ошибки", () => {
    const secret = "mongodb://user:pass@localhost/dashboard";
    const response = createErrorResponse({
      code: "ROUTINE_NOT_FOUND",
      message: secret,
      requestId,
      fieldErrors: { title: [secret] }
    });

    expect(response.error.code).toBe(API_ERROR_CODES.internalError);
    expect(response.error.message).toBe(API_ERROR_MESSAGES.INTERNAL_ERROR);
    expect(response.error.fieldErrors).toEqual({});
    expect(JSON.stringify(response)).not.toContain(secret);
    expect(JSON.stringify(response)).not.toContain("stack");
  });

  it("не принимает секрет, встроенный в понятную фразу", () => {
    const response = createErrorResponse({
      code: "ROUTINE_NOT_FOUND",
      message: "Пароль super-secret-value неверен",
      requestId
    });

    expect(response.error.code).toBe(API_ERROR_CODES.internalError);
    expect(JSON.stringify(response)).not.toContain("super-secret-value");
  });

  it("сохраняет понятное сообщение доменной ошибки", () => {
    const response = createErrorResponse({
      code: "ROUTINE_NOT_FOUND",
      message: "Рутина не найдена",
      requestId
    });

    expect(response.error).toEqual({
      code: "ROUTINE_NOT_FOUND",
      message: "Рутина не найдена",
      fieldErrors: {}
    });
  });
});

import { entityIdSchema } from "@dashboard/contracts";
import { describe, expect, it } from "vitest";

import { ApiError, parseRequest, toPublicErrorResponse } from "./api-error.js";

const requestId = "req_12345678";
const secret = "postgresql://user:pass@localhost/dashboard";

describe("публичная ошибка API", () => {
  it("прячет неизвестное исключение и неверный идентификатор запроса", () => {
    const failure = new Error(secret);
    failure.stack = `Error: ${secret}`;
    const response = toPublicErrorResponse(failure, "bad id");

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
    expect(response.body.error.message).toBe(
      "Не получилось выполнить запрос. Повторите попытку позже."
    );
    expect(response.body.meta.requestId).toBe("unknown-request");
    expect(JSON.stringify(response)).not.toContain(secret);
    expect(JSON.stringify(response)).not.toContain("stack");
  });

  it("отдаёт общую ошибку со своим статусом и без переданного секрета", () => {
    const error = new ApiError({
      code: "INTERNAL_ERROR",
      message: secret,
      status: 200
    });
    const response = toPublicErrorResponse(error, requestId);

    expect(error.status).toBe(500);
    expect(response.status).toBe(500);
    expect(response.body.error.message).not.toContain(secret);
    expect(response.body.meta.requestId).toBe(requestId);
  });

  it("заменяет код, который не проходит схему ответа", () => {
    const error = new ApiError({
      code: "bad code",
      message: "Рутина не найдена",
      status: 404
    });
    const response = toPublicErrorResponse(error, requestId);

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(response)).not.toContain("bad code");
  });

  it("сохраняет доменный код и статус", () => {
    const error = new ApiError({
      code: "ROUTINE_NOT_FOUND",
      message: "Рутина не найдена",
      status: 404
    });
    const response = toPublicErrorResponse(error, requestId);

    expect(response.status).toBe(404);
    expect(response.body.error).toEqual({
      code: "ROUTINE_NOT_FOUND",
      message: "Рутина не найдена",
      fieldErrors: {}
    });
  });

  it("превращает невалидное тело в 400 с ошибками полей", () => {
    const secretValue = "super-secret-value";

    expect(() => parseRequest(entityIdSchema, secretValue)).toThrow(ApiError);

    try {
      parseRequest(entityIdSchema, secretValue);
    } catch (error) {
      const response = toPublicErrorResponse(error, requestId);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_FAILED");
      expect(response.body.error.fieldErrors.form).toEqual(["Некорректный идентификатор."]);
      expect(JSON.stringify(response)).not.toContain(secretValue);
    }
  });
});

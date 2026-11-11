import { API_ERROR_CODES } from "@dashboard/contracts";
import type { NextFunction, Request, Response } from "express";

import { ApiError, toPublicErrorResponse } from "../shared/errors/api-error.js";
import { requestIdFrom } from "../shared/http/request-id.js";

export function notFound(_req: Request, _res: Response, next: NextFunction): void {
  next(new ApiError({ code: API_ERROR_CODES.notFound }));
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  const requestId = requestIdFrom(req);
  const publicError = isPayloadTooLarge(error)
    ? new ApiError({ code: API_ERROR_CODES.payloadTooLarge })
    : isJsonParseError(error)
      ? new ApiError({
          code: API_ERROR_CODES.validationFailed,
          fieldErrors: { form: ["Некорректный формат запроса."] }
        })
      : isDatabaseUnavailable(error)
        ? new ApiError({ code: API_ERROR_CODES.unavailable })
        : error;

  if (!(publicError instanceof ApiError)) {
    req.log?.error(
      { errorName: error instanceof Error ? error.name : "Error" },
      "Необработанная ошибка API"
    );
  }

  const response = toPublicErrorResponse(publicError, requestId);
  res.setHeader("Cache-Control", "no-store");
  res.status(response.status).json(response.body);
}

function isPayloadTooLarge(error: unknown): boolean {
  return hasStringField(error, "type", "entity.too.large");
}

function isJsonParseError(error: unknown): boolean {
  return error instanceof SyntaxError && hasNumberField(error, "status", 400);
}

function isDatabaseUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === "MongoServerSelectionError" ||
    error.name === "MongoNetworkError" ||
    error.name === "MongoNotConnectedError"
  );
}

function hasStringField(error: unknown, field: string, expected: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    field in error &&
    error[field as keyof typeof error] === expected
  );
}

function hasNumberField(error: unknown, field: string, expected: number): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    field in error &&
    error[field as keyof typeof error] === expected
  );
}

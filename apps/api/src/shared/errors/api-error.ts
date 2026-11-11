import {
  API_ERROR_CODES,
  API_ERROR_MESSAGES,
  createErrorResponse,
  isCommonErrorCode,
  parseDto,
  publicErrorMessage,
  requestIdSchema,
  sanitizeFieldErrors,
  type ApiErrorResponse,
  type CommonErrorCode,
  type FieldErrors
} from "@dashboard/contracts";
import type { ZodType } from "zod";

const FALLBACK_REQUEST_ID = "unknown-request";

const INTERNAL_STATUS = 500;

export type PublicErrorResponse = {
  status: number;
  body: ApiErrorResponse;
};

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fieldErrors: FieldErrors;

  constructor(input: {
    code: string;
    status?: number;
    message?: string;
    fieldErrors?: FieldErrors;
  }) {
    const resolved = resolveApiError(input);
    super(resolved.message);
    this.name = "ApiError";
    this.code = resolved.code;
    this.status = resolved.status;
    this.fieldErrors = resolved.fieldErrors;
  }
}

export function parseRequest<Schema extends ZodType>(schema: Schema, input: unknown) {
  const parsed = parseDto(schema, input);

  if (!parsed.ok) {
    throw new ApiError({
      code: parsed.error.code,
      fieldErrors: parsed.error.fieldErrors
    });
  }

  return parsed.data;
}

export function toPublicErrorResponse(error: unknown, requestId: string): PublicErrorResponse {
  const safeRequestId = normalizeRequestId(requestId);

  if (error instanceof ApiError) {
    try {
      const body = createErrorResponse({
        code: error.code,
        message: error.message,
        requestId: safeRequestId,
        fieldErrors: error.fieldErrors
      });

      return {
        status: statusFor(body.error.code, error.status),
        body
      };
    } catch {
      return internalErrorResponse(safeRequestId);
    }
  }

  return internalErrorResponse(safeRequestId);
}

function resolveApiError(input: {
  code: string;
  status?: number;
  message?: string;
  fieldErrors?: FieldErrors;
}): { code: string; status: number; message: string; fieldErrors: FieldErrors } {
  const message = publicErrorMessage(input.code, input.message);
  const code =
    !isCommonErrorCode(input.code) && message === API_ERROR_MESSAGES.INTERNAL_ERROR
      ? API_ERROR_CODES.internalError
      : input.code;

  return {
    code,
    status: statusFor(code, input.status),
    message,
    fieldErrors: sanitizeFieldErrors(input.fieldErrors ?? {})
  };
}

function statusFor(code: string, requested: number | undefined): number {
  if (isCommonErrorCode(code)) {
    return commonStatus(code);
  }

  if (
    requested !== undefined &&
    Number.isInteger(requested) &&
    requested >= 400 &&
    requested <= 599
  ) {
    return requested;
  }

  return INTERNAL_STATUS;
}

function commonStatus(code: CommonErrorCode): number {
  switch (code) {
    case "VALIDATION_FAILED":
      return 400;
    case "UNAUTHENTICATED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "PAYLOAD_TOO_LARGE":
      return 413;
    case "RATE_LIMITED":
      return 429;
    case "INTERNAL_ERROR":
      return INTERNAL_STATUS;
    case "SERVICE_UNAVAILABLE":
      return 503;
  }
}

function normalizeRequestId(requestId: string): string {
  const parsed = requestIdSchema.safeParse(requestId);
  return parsed.success ? parsed.data : FALLBACK_REQUEST_ID;
}

function internalErrorResponse(requestId: string): PublicErrorResponse {
  return {
    status: INTERNAL_STATUS,
    body: createErrorResponse({
      code: API_ERROR_CODES.internalError,
      message: API_ERROR_MESSAGES.INTERNAL_ERROR,
      requestId
    })
  };
}

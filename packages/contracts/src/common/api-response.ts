import { z, type ZodType } from "zod";

import {
  API_ERROR_CODES,
  API_ERROR_MESSAGES,
  apiErrorBodySchema,
  isCommonErrorCode,
  publicErrorMessage,
  sanitizeFieldErrors
} from "./api-error.js";
import { cursorSchema, requestIdSchema } from "./primitives.js";

export const apiMetaSchema = z.strictObject({
  requestId: requestIdSchema
});

export const apiErrorResponseSchema = z.strictObject({
  error: apiErrorBodySchema,
  meta: apiMetaSchema
});

export const pageMetaSchema = z.strictObject({
  nextCursor: cursorSchema.nullable()
});

export const healthStatusSchema = z.enum(["live", "ready", "unavailable"]);

export const healthResponseSchema = z.strictObject({
  data: z.strictObject({
    status: healthStatusSchema
  }),
  meta: apiMetaSchema
});

export function apiSuccessSchema<Data extends ZodType>(data: Data) {
  return z.strictObject({
    data,
    meta: apiMetaSchema
  });
}

export function apiListSchema<Item extends ZodType>(item: Item) {
  return z.strictObject({
    data: z.array(item),
    meta: z.strictObject({
      requestId: requestIdSchema,
      page: pageMetaSchema
    })
  });
}

export function createErrorResponse(input: {
  code: string;
  message: string;
  requestId: string;
  fieldErrors?: z.infer<typeof apiErrorBodySchema>["fieldErrors"];
}): ApiErrorResponse {
  const message = publicErrorMessage(input.code, input.message);
  const code =
    !isCommonErrorCode(input.code) && message === API_ERROR_MESSAGES.INTERNAL_ERROR
      ? API_ERROR_CODES.internalError
      : input.code;

  return apiErrorResponseSchema.parse({
    error: {
      code,
      message,
      fieldErrors: sanitizeFieldErrors(input.fieldErrors ?? {})
    },
    meta: { requestId: input.requestId }
  });
}

export type ApiMeta = z.infer<typeof apiMetaSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
export type HealthStatus = z.infer<typeof healthStatusSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type PageMeta = z.infer<typeof pageMetaSchema>;

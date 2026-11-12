import { z } from "zod";

import { apiSuccessSchema } from "../common/api-response.js";
import { httpsUrlSchema, utcDateTimeSchema } from "../common/primitives.js";

export const integrationTypeSchema = z.enum(["google_calendar", "telegram"], {
  error: "Неизвестный тип интеграции."
});

export const integrationStatusSchema = z.enum(["disconnected", "connected", "revoked"], {
  error: "Неизвестный статус интеграции."
});

export const integrationSummarySchema = z.strictObject({
  type: integrationTypeSchema,
  status: integrationStatusSchema,
  lastSyncAt: utcDateTimeSchema.nullable()
});

export const integrationListSchema = z.strictObject({
  integrations: z.array(integrationSummarySchema).max(2)
});

export const googleConnectSchema = z.strictObject({
  url: httpsUrlSchema
});

export const telegramLinkSchema = z.strictObject({
  url: httpsUrlSchema,
  expiresAt: utcDateTimeSchema
});

export const integrationDeletionSchema = z.strictObject({
  deleted: z.literal(true)
});

export const integrationListResponseSchema = apiSuccessSchema(integrationListSchema);
export const googleConnectResponseSchema = apiSuccessSchema(googleConnectSchema);
export const telegramLinkResponseSchema = apiSuccessSchema(telegramLinkSchema);
export const integrationDeletionResponseSchema = apiSuccessSchema(integrationDeletionSchema);

export type IntegrationType = z.infer<typeof integrationTypeSchema>;
export type IntegrationStatus = z.infer<typeof integrationStatusSchema>;
export type IntegrationSummary = z.infer<typeof integrationSummarySchema>;
export type IntegrationList = z.infer<typeof integrationListSchema>;

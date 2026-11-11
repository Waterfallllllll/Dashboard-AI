import { z } from "zod";

import { apiSuccessSchema } from "../common/api-response.js";
import {
  entityIdSchema,
  localeSchema,
  timeZoneSchema,
  utcDateTimeSchema
} from "../common/primitives.js";

function hasUnsafeNameCharacter(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);

    if (code <= 31 || code === 127 || char === "<" || char === ">") {
      return true;
    }
  }

  return false;
}

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, { error: "Укажите имя." })
  .max(120, { error: "Имя слишком длинное." })
  .refine((value) => !hasUnsafeNameCharacter(value), {
    error: "Имя содержит недопустимые символы."
  });

export const timeFormatSchema = z.enum(["12", "24"], {
  error: "Формат времени — 12 или 24 часа."
});

export const themeSchema = z.enum(["system", "light", "dark"], {
  error: "Неизвестная тема."
});

export const avatarUrlSchema = z.string().min(1).max(2048).nullable();

export const profileSchema = z.strictObject({
  id: entityIdSchema,
  displayName: displayNameSchema,
  avatarUrl: avatarUrlSchema,
  locale: localeSchema,
  timezone: timeZoneSchema,
  timeFormat: timeFormatSchema,
  theme: themeSchema,
  createdAt: utcDateTimeSchema,
  updatedAt: utcDateTimeSchema
});

export const profilePatchSchema = z
  .strictObject({
    displayName: displayNameSchema.optional(),
    locale: localeSchema.optional(),
    timezone: timeZoneSchema.optional(),
    timeFormat: timeFormatSchema.optional(),
    theme: themeSchema.optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    error: "Нужно изменить хотя бы одно поле."
  });

export const accountDeletionSchema = z.strictObject({
  deleted: z.literal(true)
});

export const profileResponseSchema = apiSuccessSchema(profileSchema);
export const accountDeletionResponseSchema = apiSuccessSchema(accountDeletionSchema);

export type Profile = z.infer<typeof profileSchema>;
export type ProfilePatch = z.infer<typeof profilePatchSchema>;
export type TimeFormat = z.infer<typeof timeFormatSchema>;
export type ThemePreference = z.infer<typeof themeSchema>;

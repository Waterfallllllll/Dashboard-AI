import { z } from "zod";

import { apiSuccessSchema } from "../common/api-response.js";
import { utcDateTimeSchema } from "../common/primitives.js";

export const WIDGET_TYPES = [
  "datetime",
  "weather",
  "calendar",
  "routines",
  "timer",
  "news"
] as const;
export const WIDGET_SIZES = ["compact", "standard", "wide", "full"] as const;
export const ITEM_LIMITS = [3, 4, 5, 6, 8, 10] as const;
export const REFRESH_MINUTES = [15, 30, 60] as const;

export const widgetTypeSchema = z.enum(WIDGET_TYPES, { error: "Неизвестный виджет." });
export const widgetSizeSchema = z.enum(WIDGET_SIZES, { error: "Неизвестный размер виджета." });

export const itemLimitSchema = z.union(
  [z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(8), z.literal(10)],
  { error: "Количество элементов — 3, 4, 5, 6, 8 или 10." }
);

export const refreshMinutesSchema = z.union([z.literal(15), z.literal(30), z.literal(60)], {
  error: "Частота обновления — 15, 30 или 60 минут."
});

export const temperatureUnitSchema = z.enum(["celsius", "fahrenheit"], {
  error: "Единица температуры — градусы Цельсия или Фаренгейта."
});

export const newsSourceModeSchema = z.enum(["all", "official"], {
  error: "Неизвестный набор источников новостей."
});

export const calendarScopeSchema = z.enum(["all", "work"], {
  error: "Неизвестный набор календарей."
});

export const widgetSettingsSchema = z.strictObject({
  itemLimit: itemLimitSchema.optional(),
  refreshMinutes: refreshMinutesSchema.optional(),
  temperatureUnit: temperatureUnitSchema.optional(),
  newsSourceMode: newsSourceModeSchema.optional(),
  calendarScope: calendarScopeSchema.optional(),
  dailyGoal: z
    .number()
    .int({ error: "Цель на день — целое число." })
    .min(1, { error: "Цель на день — от 1 до 24." })
    .max(24, { error: "Цель на день — от 1 до 24." })
    .optional(),
  volume: z
    .number()
    .min(0, { error: "Громкость — от 0 до 1." })
    .max(1, { error: "Громкость — от 0 до 1." })
    .optional()
});

const widgetVersionSchema = z
  .number()
  .int({ error: "Некорректная версия настроек." })
  .min(1, { error: "Некорректная версия настроек." })
  .max(1_000_000, { error: "Некорректная версия настроек." });

const widgetPositionSchema = z
  .number()
  .int({ error: "Позиция виджета должна быть целым числом." })
  .min(0, { error: "Позиция виджета вне диапазона." })
  .max(11, { error: "Позиция виджета вне диапазона." });

export const widgetPreferenceSchema = z.strictObject({
  widgetType: widgetTypeSchema,
  enabled: z.boolean(),
  position: widgetPositionSchema,
  size: widgetSizeSchema,
  settings: widgetSettingsSchema,
  version: widgetVersionSchema,
  updatedAt: utcDateTimeSchema
});

export const widgetPreferencePatchSchema = widgetPreferenceSchema.omit({ updatedAt: true });

export const widgetPreferencesSchema = z.strictObject({
  widgets: z.array(widgetPreferenceSchema).max(12),
  updatedAt: utcDateTimeSchema
});

export const widgetPreferencesPatchSchema = z.strictObject({
  widgets: z.array(widgetPreferencePatchSchema).length(6, {
    error: "Нужны все шесть виджетов."
  })
});

export const widgetPreferencesResponseSchema = apiSuccessSchema(widgetPreferencesSchema);

export type WidgetType = z.infer<typeof widgetTypeSchema>;
export type WidgetSize = z.infer<typeof widgetSizeSchema>;
export type WidgetSettings = z.infer<typeof widgetSettingsSchema>;
export type WidgetPreference = z.infer<typeof widgetPreferenceSchema>;
export type WidgetPreferencePatch = z.infer<typeof widgetPreferencePatchSchema>;
export type WidgetPreferences = z.infer<typeof widgetPreferencesSchema>;
export type WidgetPreferencesPatch = z.infer<typeof widgetPreferencesPatchSchema>;

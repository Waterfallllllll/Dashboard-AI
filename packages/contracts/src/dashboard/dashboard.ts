import { z } from "zod";

import { apiSuccessSchema } from "../common/api-response.js";
import { localDateSchema, timeZoneSchema, utcDateTimeSchema } from "../common/primitives.js";
import { timeFormatSchema } from "../auth/profile.js";
import { calendarEventSchema } from "../calendar/events.js";
import { newsItemSchema } from "../news/news.js";
import { routineDaySchema } from "../routines/routines.js";
import { timerSnapshotSchema } from "../timers/timers.js";
import { weatherSnapshotSchema } from "../weather/weather.js";
import { widgetPreferencesSchema } from "../widgets/preferences.js";

const sectionMessageSchema = z.string().min(1).max(200);

export const sectionErrorSchema = z.strictObject({
  status: z.literal("error"),
  message: sectionMessageSchema
});

export const externalSectionSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("unavailable") }),
  sectionErrorSchema
]);

const freshPayload = {
  updatedAt: utcDateTimeSchema
} as const;

export const weatherSectionSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("unavailable") }),
  z.strictObject({
    status: z.literal("ready"),
    ...freshPayload,
    weather: weatherSnapshotSchema
  }),
  z.strictObject({
    status: z.literal("stale"),
    ...freshPayload,
    weather: weatherSnapshotSchema
  }),
  sectionErrorSchema
]);

export const calendarSectionSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("unavailable") }),
  z.strictObject({ status: z.literal("empty") }),
  z.strictObject({
    status: z.literal("ready"),
    ...freshPayload,
    events: z.array(calendarEventSchema).max(10)
  }),
  z.strictObject({
    status: z.literal("stale"),
    ...freshPayload,
    events: z.array(calendarEventSchema).max(10)
  }),
  sectionErrorSchema
]);

export const newsSectionSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("unavailable") }),
  z.strictObject({ status: z.literal("pending") }),
  z.strictObject({ status: z.literal("empty"), updatedAt: utcDateTimeSchema.nullable() }),
  z.strictObject({
    status: z.literal("ready"),
    ...freshPayload,
    items: z.array(newsItemSchema).max(10)
  }),
  z.strictObject({
    status: z.literal("stale"),
    ...freshPayload,
    items: z.array(newsItemSchema).max(10)
  }),
  sectionErrorSchema
]);

export const datetimeSectionSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("ready"),
    serverTime: utcDateTimeSchema,
    timezone: timeZoneSchema,
    timeFormat: timeFormatSchema
  }),
  sectionErrorSchema
]);

export const widgetsSectionSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("ready"),
    preferences: widgetPreferencesSchema
  }),
  sectionErrorSchema
]);

export const routinesSectionSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("ready"),
    day: routineDaySchema
  }),
  sectionErrorSchema
]);

export const timerSectionSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("ready"),
    timer: timerSnapshotSchema
  }),
  sectionErrorSchema
]);

export const dashboardSchema = z.strictObject({
  date: localDateSchema,
  generatedAt: utcDateTimeSchema,
  datetime: datetimeSectionSchema,
  widgets: widgetsSectionSchema,
  routines: routinesSectionSchema,
  timer: timerSectionSchema,
  weather: weatherSectionSchema,
  calendar: calendarSectionSchema,
  news: newsSectionSchema
});

export const dashboardResponseSchema = apiSuccessSchema(dashboardSchema);

export const SECTION_ERROR_MESSAGE = "Не удалось загрузить раздел.";

export type Dashboard = z.infer<typeof dashboardSchema>;
export type ExternalSection = z.infer<typeof externalSectionSchema>;
export type WeatherSection = z.infer<typeof weatherSectionSchema>;
export type CalendarSection = z.infer<typeof calendarSectionSchema>;
export type NewsSection = z.infer<typeof newsSectionSchema>;

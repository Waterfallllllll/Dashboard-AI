import { z } from "zod";

import { apiSuccessSchema } from "../common/api-response.js";
import { localDateSchema, timeZoneSchema, utcDateTimeSchema } from "../common/primitives.js";
import { timeFormatSchema } from "../auth/profile.js";
import { routineDaySchema } from "../routines/routines.js";
import { timerSnapshotSchema } from "../timers/timers.js";
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
  weather: externalSectionSchema,
  calendar: externalSectionSchema,
  news: externalSectionSchema
});

export const dashboardResponseSchema = apiSuccessSchema(dashboardSchema);

export const SECTION_ERROR_MESSAGE = "Не удалось загрузить раздел.";

export type Dashboard = z.infer<typeof dashboardSchema>;
export type ExternalSection = z.infer<typeof externalSectionSchema>;

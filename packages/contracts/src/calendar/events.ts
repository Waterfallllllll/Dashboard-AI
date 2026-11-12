import { z } from "zod";

import { apiSuccessSchema } from "../common/api-response.js";
import {
  entityIdSchema,
  httpsUrlSchema,
  localDateSchema,
  utcDateTimeSchema
} from "../common/primitives.js";

export const calendarEventStatusSchema = z.enum(["confirmed", "tentative"], {
  error: "Неизвестный статус события."
});

export const calendarEventSchema = z.strictObject({
  id: entityIdSchema,
  title: z.string().min(1).max(300),
  startAt: utcDateTimeSchema,
  endAt: utcDateTimeSchema,
  allDay: z.boolean(),
  location: z.string().max(300).nullable(),
  meetingUrl: httpsUrlSchema.nullable(),
  htmlLink: httpsUrlSchema,
  status: calendarEventStatusSchema,
  calendarName: z.string().min(1).max(120)
});

export const calendarDaySchema = z.strictObject({
  date: localDateSchema,
  updatedAt: utcDateTimeSchema.nullable(),
  events: z.array(calendarEventSchema).max(10)
});

export const calendarDayResponseSchema = apiSuccessSchema(calendarDaySchema);

export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type CalendarDay = z.infer<typeof calendarDaySchema>;

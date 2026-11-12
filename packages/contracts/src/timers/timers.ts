import { z } from "zod";

import { apiListSchema, apiSuccessSchema } from "../common/api-response.js";
import { entityIdSchema, pageQuerySchema, utcDateTimeSchema } from "../common/primitives.js";

const minutesSchema = z
  .number()
  .int({ error: "Длительность — целое число минут." })
  .min(1, { error: "Длительность — от 1 до 120 минут." })
  .max(120, { error: "Длительность — от 1 до 120 минут." });

export const timerModeSchema = z.enum(["pomodoro", "custom", "manual"], {
  error: "Неизвестный режим таймера."
});

export const timerPhaseSchema = z.enum(["work", "short-break", "long-break"], {
  error: "Неизвестная фаза таймера."
});

export const timerRunStatusSchema = z.enum(["idle", "running", "paused"], {
  error: "Неизвестное состояние таймера."
});

export const timerPresetSchema = z.strictObject({
  mode: timerModeSchema,
  workMinutes: minutesSchema,
  shortBreakMinutes: minutesSchema,
  longBreakMinutes: minutesSchema
});

export const timerStartSchema = z
  .strictObject({
    preset: timerPresetSchema,
    phase: timerPhaseSchema.optional(),
    cycleNumber: z
      .number()
      .int({ error: "Номер цикла должен быть целым." })
      .min(0, { error: "Номер цикла вне диапазона." })
      .max(10_000, { error: "Номер цикла вне диапазона." })
      .optional()
  })
  .superRefine((value, ctx) => {
    if (value.preset.mode === "manual" && value.phase !== undefined && value.phase !== "work") {
      ctx.addIssue({
        code: "custom",
        path: ["phase"],
        message: "Ручной таймер состоит из одного интервала."
      });
    }
  });

export const timerActionSchema = z.enum(["pause", "resume", "skip", "reset"], {
  error: "Неизвестное действие таймера."
});

export const timerPatchSchema = z.strictObject({
  action: timerActionSchema,
  version: z
    .number()
    .int({ error: "Некорректная версия таймера." })
    .min(1, { error: "Некорректная версия таймера." })
    .max(1_000_000, { error: "Некорректная версия таймера." })
});

export const timerSessionSchema = z.strictObject({
  id: entityIdSchema,
  preset: timerPresetSchema,
  runStatus: timerRunStatusSchema,
  phase: timerPhaseSchema,
  startedAt: utcDateTimeSchema.nullable(),
  pausedAt: utcDateTimeSchema.nullable(),
  endsAt: utcDateTimeSchema.nullable(),
  completedAt: utcDateTimeSchema.nullable(),
  cycleNumber: z.number().int().min(0).max(10_000),
  version: z.number().int().min(1),
  durationMs: z.number().int().min(0),
  remainingMs: z.number().int().min(0)
});

export const timerNextSchema = z.strictObject({
  phase: timerPhaseSchema,
  cycleNumber: z.number().int().min(0).max(10_000)
});

export const timerSnapshotSchema = z.strictObject({
  session: timerSessionSchema.nullable(),
  settled: timerSessionSchema.nullable(),
  next: timerNextSchema,
  completedToday: z.number().int().min(0),
  dailyGoal: z.number().int().min(1).max(24)
});

export const TIMER_ALREADY_RUNNING = "TIMER_ALREADY_RUNNING";

export const timerSnapshotResponseSchema = apiSuccessSchema(timerSnapshotSchema);
export const timerHistoryResponseSchema = apiListSchema(timerSessionSchema);
export const timerHistoryQuerySchema = pageQuerySchema;

export type TimerPreset = z.infer<typeof timerPresetSchema>;
export type TimerPhase = z.infer<typeof timerPhaseSchema>;
export type TimerRunStatus = z.infer<typeof timerRunStatusSchema>;
export type TimerStart = z.infer<typeof timerStartSchema>;
export type TimerPatch = z.infer<typeof timerPatchSchema>;
export type TimerSession = z.infer<typeof timerSessionSchema>;
export type TimerSnapshot = z.infer<typeof timerSnapshotSchema>;
export type TimerHistoryQuery = z.infer<typeof timerHistoryQuerySchema>;

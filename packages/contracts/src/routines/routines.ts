import { z } from "zod";

import { apiListSchema, apiSuccessSchema } from "../common/api-response.js";
import {
  cursorSchema,
  entityIdSchema,
  localDateSchema,
  localTimeSchema,
  pageLimitQuerySchema,
  timeZoneSchema,
  utcDateTimeSchema
} from "../common/primitives.js";

function hasUnsafeText(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);

    if (code <= 31 || code === 127 || char === "<" || char === ">") {
      return true;
    }
  }

  return false;
}

const routineTitleSchema = z
  .string()
  .trim()
  .min(1, { error: "Укажите название." })
  .max(120, { error: "Название не длиннее 120 символов." })
  .refine((value) => !hasUnsafeText(value), {
    error: "Название содержит недопустимые символы."
  });

const routineDescriptionSchema = z
  .string()
  .trim()
  .max(500, { error: "Описание не длиннее 500 символов." })
  .refine((value) => !hasUnsafeText(value), {
    error: "Описание содержит недопустимые символы."
  })
  .transform((value) => (value.length === 0 ? null : value));

const weekdaySchema = z
  .number()
  .int({ error: "День недели — число от 0 до 6." })
  .min(0, { error: "День недели — число от 0 до 6." })
  .max(6, { error: "День недели — число от 0 до 6." });

export const recurrenceSchema = z.discriminatedUnion(
  "kind",
  [
    z.strictObject({ kind: z.literal("daily") }),
    z.strictObject({ kind: z.literal("weekdays") }),
    z.strictObject({ kind: z.literal("once") }),
    z.strictObject({
      kind: z.literal("weekly"),
      days: z.array(weekdaySchema).min(1, { error: "Выберите хотя бы один день недели." }).max(7)
    })
  ],
  { error: "Неизвестное повторение." }
);

export const routineStatusSchema = z.enum(["active", "paused", "ended"], {
  error: "Неизвестное состояние рутины."
});

export const routineRuleSchema = z.strictObject({
  id: entityIdSchema,
  title: routineTitleSchema,
  description: z.string().max(500).nullable(),
  startDate: localDateSchema,
  endDate: localDateSchema.nullable(),
  recurrence: recurrenceSchema,
  reminderLocalTime: localTimeSchema.nullable(),
  timezone: timeZoneSchema,
  status: routineStatusSchema,
  createdAt: utcDateTimeSchema,
  updatedAt: utcDateTimeSchema
});

export const routineRuleCreateSchema = z
  .strictObject({
    title: routineTitleSchema,
    description: routineDescriptionSchema.nullable().optional(),
    startDate: localDateSchema,
    endDate: localDateSchema.nullable().optional(),
    recurrence: recurrenceSchema,
    reminderLocalTime: localTimeSchema.nullable().optional(),
    status: z
      .enum(["active", "paused"], { error: "Новая рутина может быть активной или на паузе." })
      .optional()
  })
  .superRefine((value, ctx) => {
    validateRecurrence(value.recurrence, ctx, ["recurrence"]);
    validateRange(value.startDate, value.endDate ?? null, ctx);
  });

export const routineEditScopeSchema = z.enum(["date", "following", "template"], {
  error: "Неизвестная область изменения."
});

export const routineRulePatchSchema = z
  .strictObject({
    scope: routineEditScopeSchema,
    date: localDateSchema.optional(),
    title: routineTitleSchema.optional(),
    description: routineDescriptionSchema.nullable().optional(),
    startDate: localDateSchema.optional(),
    endDate: localDateSchema.nullable().optional(),
    recurrence: recurrenceSchema.optional(),
    reminderLocalTime: localTimeSchema.nullable().optional(),
    status: routineStatusSchema.optional()
  })
  .superRefine((value, ctx) => {
    const changes = Object.keys(value).filter((key) => key !== "scope" && key !== "date");

    if (changes.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["title"],
        message: "Нужно изменить хотя бы одно поле."
      });
    }

    if (value.scope !== "template" && value.date === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["date"],
        message: "Укажите дату, к которой относится изменение."
      });
    }

    if (value.recurrence) {
      validateRecurrence(value.recurrence, ctx, ["recurrence"]);
    }

    if (value.startDate && value.endDate) {
      validateRange(value.startDate, value.endDate, ctx);
    }
  });

export const routineOccurrenceStatusSchema = z.enum(["pending", "done", "hidden"], {
  error: "Неизвестное состояние дела."
});

export const routineOccurrencePatchSchema = z
  .strictObject({
    status: routineOccurrenceStatusSchema.optional(),
    title: routineTitleSchema.nullable().optional()
  })
  .refine((value) => value.status !== undefined || value.title !== undefined, {
    error: "Нужно изменить статус или название."
  });

export const routineOccurrenceSchema = z.strictObject({
  id: entityIdSchema,
  ruleId: entityIdSchema,
  localDate: localDateSchema,
  title: routineTitleSchema,
  status: routineOccurrenceStatusSchema,
  completedAt: utcDateTimeSchema.nullable()
});

export const routineDaySchema = z.strictObject({
  date: localDateSchema,
  items: z.array(routineOccurrenceSchema).max(200),
  progress: z.strictObject({
    done: z.number().int().min(0),
    total: z.number().int().min(0)
  })
});

export const routineRuleChangeSchema = z.strictObject({
  rule: routineRuleSchema,
  replacedRuleId: entityIdSchema.nullable()
});

export const routineDeletionSchema = z.strictObject({
  deleted: z.literal(true)
});

export const routineListQuerySchema = z.strictObject({
  status: z
    .enum(["active", "paused", "completed"], {
      error: "Неизвестный фильтр рутин."
    })
    .optional(),
  q: z.string().trim().min(1).max(120).optional(),
  cursor: cursorSchema.optional(),
  limit: pageLimitQuerySchema.optional()
});

export const routineRuleResponseSchema = apiSuccessSchema(routineRuleSchema);
export const routineRuleChangeResponseSchema = apiSuccessSchema(routineRuleChangeSchema);
export const routineRuleListResponseSchema = apiListSchema(routineRuleSchema);
export const routineDayResponseSchema = apiSuccessSchema(routineDaySchema);
export const routineOccurrenceResponseSchema = apiSuccessSchema(routineOccurrenceSchema);
export const routineDeletionResponseSchema = apiSuccessSchema(routineDeletionSchema);

export const RESTORE_EXPIRED = "RESTORE_EXPIRED";

export type Recurrence = z.infer<typeof recurrenceSchema>;
export type RoutineStatus = z.infer<typeof routineStatusSchema>;
export type RoutineRule = z.infer<typeof routineRuleSchema>;
export type RoutineRuleCreate = z.infer<typeof routineRuleCreateSchema>;
export type RoutineRulePatch = z.infer<typeof routineRulePatchSchema>;
export type RoutineOccurrence = z.infer<typeof routineOccurrenceSchema>;
export type RoutineOccurrencePatch = z.infer<typeof routineOccurrencePatchSchema>;
export type RoutineDay = z.infer<typeof routineDaySchema>;
export type RoutineListQuery = z.infer<typeof routineListQuerySchema>;

type IssueContext = z.RefinementCtx;

function validateRecurrence(recurrence: Recurrence, ctx: IssueContext, path: string[]): void {
  if (recurrence.kind !== "weekly") {
    return;
  }

  if (new Set(recurrence.days).size !== recurrence.days.length) {
    ctx.addIssue({
      code: "custom",
      path: [...path, "days"],
      message: "Дни недели не должны повторяться."
    });
  }
}

function validateRange(startDate: string, endDate: string | null, ctx: IssueContext): void {
  if (endDate && endDate < startDate) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "Дата окончания не раньше даты начала."
    });
  }
}

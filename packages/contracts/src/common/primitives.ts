import { z } from "zod";

const publicIdPattern = /^[a-f0-9]{24}$/;
const localTimePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const localePattern = /^[a-z]{2}(?:-[A-Z]{2})?$/;
const requestIdPattern = /^[A-Za-z0-9_-]{8,80}$/;
const cursorPattern = /^[A-Za-z0-9_-]{1,256}$/;
const idempotencyKeyPattern = /^[A-Za-z0-9:_-]{8,128}$/;
const timeZonePattern = /^[A-Za-z0-9_+-]{1,32}(?:\/[A-Za-z0-9_+-]{1,32}){0,2}$/;
const pageLimitPattern = /^(?:[1-9]|[1-9]\d|100)$/;

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

export const entityIdSchema = z.string().regex(publicIdPattern, {
  error: "Некорректный идентификатор."
});

export const localDateSchema = z.iso.date({ error: "Дата указывается как ГГГГ-ММ-ДД." });

export const utcDateTimeSchema = z.iso.datetime({
  error: "Дата и время указываются в UTC."
});

export const localTimeSchema = z.string().regex(localTimePattern, {
  error: "Время указывается как часы и минуты."
});

export const localeSchema = z.string().regex(localePattern, {
  error: "Некорректная локаль."
});

export const requestIdSchema = z.string().regex(requestIdPattern, {
  error: "Некорректный идентификатор запроса."
});

export const cursorSchema = z.string().regex(cursorPattern, {
  error: "Некорректный курсор страницы."
});

export const idempotencyKeySchema = z.string().regex(idempotencyKeyPattern, {
  error: "Некорректный ключ идемпотентности."
});

export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

export const timeZoneSchema = z
  .string()
  .refine((value) => timeZonePattern.test(value) && isKnownTimeZone(value), {
    error: "Неизвестный часовой пояс."
  });

export const pageLimitQuerySchema = z
  .string()
  .regex(pageLimitPattern, { error: "Размер страницы — число от 1 до 100." })
  .transform((value) => Number(value));

export const pageQuerySchema = z
  .strictObject({
    cursor: cursorSchema.optional(),
    limit: pageLimitQuerySchema.optional()
  })
  .transform((query) => {
    if (query.cursor === undefined) {
      return { limit: query.limit ?? DEFAULT_PAGE_LIMIT };
    }

    return { cursor: query.cursor, limit: query.limit ?? DEFAULT_PAGE_LIMIT };
  });

export const localDateQuerySchema = z.strictObject({
  date: localDateSchema
});

export const httpsUrlSchema = z
  .string()
  .min(8)
  .max(4096)
  .refine((value) => isHttpsUrl(value), { error: "Нужна ссылка https." });

export function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" && url.username === "" && url.password === "" && url.hash === ""
    );
  } catch {
    return false;
  }
}

function isKnownTimeZone(value: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export type HttpsUrl = z.infer<typeof httpsUrlSchema>;
export type EntityId = z.infer<typeof entityIdSchema>;
export type LocalDate = z.infer<typeof localDateSchema>;
export type UtcDateTime = z.infer<typeof utcDateTimeSchema>;
export type PageQuery = z.infer<typeof pageQuerySchema>;

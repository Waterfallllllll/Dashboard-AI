import { z, type ZodError, type ZodType } from "zod";

const errorCodePattern = /^[A-Z][A-Z0-9_]{1,63}$/;
const fieldPathPattern = /^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)*$/;
const cyrillicPattern = /[А-Яа-яЁё]/;
const embeddedTokenPattern = /[A-Za-z0-9][A-Za-z0-9:_+./@=-]{11,}/;
const blockedFieldKeys = new Set(["constructor", "prototype", "proto"]);

const MAX_FIELD_ERRORS = 20;
const MAX_MESSAGES_PER_FIELD = 5;
const MAX_FIELD_MESSAGE_LENGTH = 200;
const MAX_ERROR_MESSAGE_LENGTH = 300;

export const API_ERROR_CODES = {
  validationFailed: "VALIDATION_FAILED",
  unauthenticated: "UNAUTHENTICATED",
  forbidden: "FORBIDDEN",
  notFound: "NOT_FOUND",
  conflict: "CONFLICT",
  payloadTooLarge: "PAYLOAD_TOO_LARGE",
  rateLimited: "RATE_LIMITED",
  internalError: "INTERNAL_ERROR",
  unavailable: "SERVICE_UNAVAILABLE"
} as const;

export type CommonErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

export const API_ERROR_MESSAGES: Readonly<Record<CommonErrorCode, string>> = {
  VALIDATION_FAILED: "Проверьте введённые данные и повторите попытку.",
  UNAUTHENTICATED: "Войдите в аккаунт, чтобы продолжить.",
  FORBIDDEN: "Недостаточно прав для этого действия.",
  NOT_FOUND: "Запрошенные данные не найдены.",
  CONFLICT: "Данные уже изменились. Обновите страницу и повторите попытку.",
  PAYLOAD_TOO_LARGE: "Запрос слишком большой.",
  RATE_LIMITED: "Слишком много запросов. Подождите немного и повторите.",
  INTERNAL_ERROR: "Не получилось выполнить запрос. Повторите попытку позже.",
  SERVICE_UNAVAILABLE: "Сервис временно недоступен. Повторите попытку позже."
};

const fallbackFieldMessage = "Некорректное значение.";

const fieldMessageByCode: Readonly<Record<string, string>> = {
  invalid_type: fallbackFieldMessage,
  invalid_format: "Некорректный формат.",
  invalid_value: "Недопустимое значение.",
  too_small: "Значение вне допустимого диапазона.",
  too_big: "Значение вне допустимого диапазона.",
  unrecognized_keys: "Это поле не поддерживается.",
  custom: fallbackFieldMessage
};

export const apiErrorCodeSchema = z.string().regex(errorCodePattern, {
  error: "Некорректный код ошибки."
});

const fieldKeySchema = z.string().regex(fieldPathPattern).max(80);
const fieldMessageSchema = z.string().min(1).max(MAX_FIELD_MESSAGE_LENGTH);

export const fieldErrorsSchema = z
  .record(fieldKeySchema, z.array(fieldMessageSchema).min(1).max(MAX_MESSAGES_PER_FIELD))
  .refine((value) => Object.keys(value).length <= MAX_FIELD_ERRORS, {
    error: "Слишком много ошибок полей."
  })
  .default({});

export const apiErrorBodySchema = z.strictObject({
  code: apiErrorCodeSchema,
  message: z.string().min(1).max(MAX_ERROR_MESSAGE_LENGTH),
  fieldErrors: fieldErrorsSchema
});

export type FieldErrors = z.infer<typeof fieldErrorsSchema>;
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

export type ValidationFailure = {
  code: typeof API_ERROR_CODES.validationFailed;
  message: string;
  fieldErrors: FieldErrors;
};

export type ParseDtoResult<Data> =
  { ok: true; data: Data } | { ok: false; error: ValidationFailure };

type ZodIssue = ZodError["issues"][number];

export function parseDto<Schema extends ZodType>(
  schema: Schema,
  input: unknown
): ParseDtoResult<z.output<Schema>> {
  const parsed = schema.safeParse(input);

  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }

  return { ok: false, error: validationFailure(parsed.error) };
}

export function validationFailure(error: ZodError): ValidationFailure {
  return {
    code: API_ERROR_CODES.validationFailed,
    message: API_ERROR_MESSAGES.VALIDATION_FAILED,
    fieldErrors: fieldErrorsFromIssues(error.issues)
  };
}

export function isCommonErrorCode(code: string): code is CommonErrorCode {
  return Object.prototype.hasOwnProperty.call(API_ERROR_MESSAGES, code);
}

export function publicErrorMessage(code: string, message?: string): string {
  if (isCommonErrorCode(code)) {
    return API_ERROR_MESSAGES[code];
  }

  if (message !== undefined && isSafePublicMessage(message)) {
    return message;
  }

  return API_ERROR_MESSAGES.INTERNAL_ERROR;
}

export function sanitizeFieldErrors(value: unknown): FieldErrors {
  const parsed = fieldErrorsSchema.safeParse(sanitizeFieldErrorInput(value));
  return parsed.success ? parsed.data : {};
}

function fieldErrorsFromIssues(issues: readonly ZodIssue[]): FieldErrors {
  const collected: Record<string, string[]> = Object.create(null);

  for (const issue of issues) {
    const keys = unrecognizedKeys(issue);
    if (keys.length > 0) {
      for (const key of keys) {
        pushFieldError(collected, key, "Это поле не поддерживается.");
      }
      continue;
    }

    pushFieldError(collected, fieldPath(issue.path) ?? "form", publicIssueMessage(issue));
  }

  return sanitizeFieldErrors(collected);
}

function unrecognizedKeys(issue: ZodIssue): readonly string[] {
  if (issue.code !== "unrecognized_keys") {
    return [];
  }

  return issue.keys;
}

function fieldPath(path: readonly PropertyKey[]): string | null {
  if (path.length === 0) {
    return null;
  }

  const parts: string[] = [];

  for (const segment of path) {
    if (typeof segment === "string" && /^[A-Za-z][A-Za-z0-9]*$/.test(segment)) {
      parts.push(segment);
      continue;
    }

    if (
      typeof segment === "number" &&
      Number.isInteger(segment) &&
      segment >= 0 &&
      segment < 1000
    ) {
      parts.push(String(segment));
      continue;
    }

    return null;
  }

  return parts.join(".");
}

function publicIssueMessage(issue: ZodIssue): string {
  if (issue.message.length <= MAX_FIELD_MESSAGE_LENGTH && isSafePublicMessage(issue.message)) {
    return issue.message;
  }

  return fieldMessageByCode[issue.code] ?? fallbackFieldMessage;
}

function pushFieldError(target: Record<string, string[]>, key: string, message: string): void {
  const safeKey = fieldPathPattern.test(key) && !blockedFieldKeys.has(key) ? key : "form";
  const reachedLimit = Object.keys(target).length >= MAX_FIELD_ERRORS;
  const alreadyPresent = Object.prototype.hasOwnProperty.call(target, safeKey);

  if (reachedLimit && !alreadyPresent) {
    return;
  }

  const existing = target[safeKey] ?? [];

  if (existing.length >= MAX_MESSAGES_PER_FIELD || existing.includes(message)) {
    return;
  }

  target[safeKey] = [...existing, message];
}

function sanitizeFieldErrorInput(value: unknown): Record<string, string[]> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const sanitized: Record<string, string[]> = {};

  for (const [key, messages] of Object.entries(value)) {
    if (!fieldPathPattern.test(key) || blockedFieldKeys.has(key) || !Array.isArray(messages)) {
      continue;
    }

    const safeMessages = messages.filter(
      (message): message is string => typeof message === "string" && isSafePublicMessage(message)
    );

    if (safeMessages.length > 0) {
      sanitized[key] = safeMessages.slice(0, MAX_MESSAGES_PER_FIELD);
    }
  }

  return sanitized;
}

// Клиентское сообщение не повторяет введённое значение, ссылку и длинный токен.
function isSafePublicMessage(message: string): boolean {
  const trimmed = message.trim();

  return (
    trimmed.length > 0 &&
    trimmed.length <= MAX_ERROR_MESSAGE_LENGTH &&
    trimmed === message &&
    !hasControlCharacter(message) &&
    !message.includes("://") &&
    !embeddedTokenPattern.test(message) &&
    cyrillicPattern.test(message)
  );
}

function hasControlCharacter(message: string): boolean {
  for (const character of message) {
    const code = character.codePointAt(0) ?? 0;

    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }

  return false;
}

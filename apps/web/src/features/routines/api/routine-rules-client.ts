import {
  CSRF_HEADER,
  IDEMPOTENCY_KEY_HEADER,
  apiErrorResponseSchema,
  idempotencyKeySchema,
  routineRuleCreateSchema,
  routineRuleListResponseSchema,
  routineRuleResponseSchema,
  sessionResponseSchema,
  type FieldErrors,
  type RoutineRule,
  type RoutineRuleCreate
} from "@dashboard/contracts";

const PAGE_LIMIT = 100;
const MAX_PAGES = 10;
const EMPTY_FIELD_ERRORS: FieldErrors = {};

export type RoutineRulesCode = "unauthenticated" | "unavailable" | "invalid";

export class RoutineRulesError extends Error {
  readonly code: RoutineRulesCode;
  readonly fieldErrors: FieldErrors;

  constructor(code: RoutineRulesCode, message: string, fieldErrors: FieldErrors = EMPTY_FIELD_ERRORS) {
    super(message);
    this.name = "RoutineRulesError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export type ListRoutineRules = (
  fetchImpl?: typeof fetch,
  signal?: AbortSignal
) => Promise<readonly RoutineRule[]>;

export type CreateRoutineRule = (
  input: RoutineRuleCreate,
  idempotencyKey: string,
  fetchImpl?: typeof fetch
) => Promise<RoutineRule>;

export const listRoutineRules: ListRoutineRules = async (fetchImpl = fetch, signal) => {
  const rules: RoutineRule[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({ limit: String(PAGE_LIMIT) });

    if (cursor) {
      params.set("cursor", cursor);
    }

    const response = await readResponse(
      fetchImpl(`/api/v1/routine-rules?${params.toString()}`, requestInit(signal)),
      "Не удалось загрузить рутины."
    );
    const parsed = routineRuleListResponseSchema.safeParse(await readJson(response));

    if (!parsed.success) {
      throw new RoutineRulesError("unavailable", "Не удалось загрузить рутины.");
    }

    rules.push(...parsed.data.data);
    cursor = parsed.data.meta.page.nextCursor;

    if (!cursor) {
      return rules;
    }
  }

  return rules;
};

export const createRoutineRule: CreateRoutineRule = async (input, idempotencyKey, fetchImpl = fetch) => {
  if (!idempotencyKeySchema.safeParse(idempotencyKey).success) {
    throw new RoutineRulesError("unavailable", "Не удалось создать рутину.");
  }

  const body = routineRuleCreateSchema.safeParse(input);

  if (!body.success) {
    throw new RoutineRulesError("invalid", "Проверьте введённые данные и повторите попытку.");
  }

  const response = await readResponse(
    fetchImpl("/api/v1/routine-rules", {
      ...requestInit(),
      method: "POST",
      headers: await mutationHeaders(fetchImpl, idempotencyKey),
      body: JSON.stringify(body.data)
    }),
    "Не удалось создать рутину."
  );

  if (!response.ok) {
    throw await failureFrom(response, "Не удалось создать рутину.");
  }

  const parsed = routineRuleResponseSchema.safeParse(await readJson(response));

  if (!parsed.success) {
    throw new RoutineRulesError("unavailable", "Не удалось создать рутину.");
  }

  return parsed.data.data;
};

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function requestInit(signal?: AbortSignal): RequestInit {
  return {
    cache: "no-store",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    ...(signal ? { signal } : {})
  };
}

async function mutationHeaders(fetchImpl: typeof fetch, idempotencyKey: string): Promise<Headers> {
  return new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
    [CSRF_HEADER]: await readCsrfToken(fetchImpl),
    [IDEMPOTENCY_KEY_HEADER]: idempotencyKey
  });
}

async function readCsrfToken(fetchImpl: typeof fetch): Promise<string> {
  const response = await readResponse(
    fetchImpl("/api/v1/auth/session", requestInit()),
    "Не удалось создать рутину."
  );
  const parsed = sessionResponseSchema.safeParse(await readJson(response));

  if (!parsed.success) {
    throw new RoutineRulesError("unavailable", "Не удалось создать рутину.");
  }

  return parsed.data.data.csrfToken;
}

async function readResponse(pending: Promise<Response>, fallback: string): Promise<Response> {
  try {
    const response = await pending;

    if (response.status === 401) {
      throw new RoutineRulesError("unauthenticated", "Войдите в аккаунт, чтобы продолжить.");
    }

    if (!response.ok && response.headers.get("content-type")?.includes("application/json") !== true) {
      throw new RoutineRulesError(response.status === 400 ? "invalid" : "unavailable", fallback);
    }

    return response;
  } catch (error) {
    if (error instanceof RoutineRulesError || isAbortError(error)) {
      throw error;
    }

    throw new RoutineRulesError("unavailable", fallback);
  }
}

async function failureFrom(response: Response, fallback: string): Promise<RoutineRulesError> {
  const parsed = apiErrorResponseSchema.safeParse(await readJson(response));
  const code = response.status === 400 ? "invalid" : "unavailable";

  if (!parsed.success) {
    return new RoutineRulesError(code, fallback);
  }

  return new RoutineRulesError(
    code,
    code === "invalid" ? "Проверьте введённые данные и повторите попытку." : fallback,
    parsed.data.error.fieldErrors
  );
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    return null;
  }
}

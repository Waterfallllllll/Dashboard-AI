import {
  API_ERROR_CODES,
  API_ERROR_MESSAGES,
  CSRF_HEADER,
  IDEMPOTENCY_KEY_HEADER,
  apiErrorResponseSchema
} from "@dashboard/contracts";
import type { ZodType } from "zod";

const DEFAULT_TIMEOUT_MS = 8_000;

export type ApiFailure = Readonly<{
  ok: false;
  status: number;
  requestId: string;
  code: string;
  message: string;
  fieldErrors: Readonly<Record<string, readonly string[]>>;
}>;

export type ApiSuccess<Data> = Readonly<{
  ok: true;
  status: number;
  requestId: string;
  data: Data;
}>;

export type ApiResult<Data> = ApiSuccess<Data> | ApiFailure;

export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ExecuteRequestOptions<Schema extends ZodType> = Readonly<{
  url: string;
  method: ApiMethod;
  schema: Schema;
  body?: unknown;
  headers?: Readonly<Record<string, string>>;
  signal?: AbortSignal;
  timeoutMs?: number;
  idempotencyKey?: string;
  csrfToken?: string;
}>;

const MUTATING_METHODS = new Set<ApiMethod>(["POST", "PUT", "PATCH", "DELETE"]);

export function createRequestId(): string {
  return crypto.randomUUID();
}

export function unavailableResult(requestId: string): ApiFailure {
  return {
    ok: false,
    status: 0,
    requestId,
    code: API_ERROR_CODES.unavailable,
    message: API_ERROR_MESSAGES.SERVICE_UNAVAILABLE,
    fieldErrors: {}
  };
}

export async function executeRequest<Schema extends ZodType>(
  options: ExecuteRequestOptions<Schema>
): Promise<ApiResult<Schema["_output"]>> {
  const requestId = headerValue(options.headers, "x-request-id") ?? createRequestId();
  const headers = new Headers();

  for (const [name, value] of Object.entries(options.headers ?? {})) {
    headers.set(name, value);
  }

  if (!headers.has("X-Request-Id")) {
    headers.set("X-Request-Id", requestId);
  }

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options.idempotencyKey) {
    headers.set(IDEMPOTENCY_KEY_HEADER, options.idempotencyKey);
  }

  if (options.csrfToken && MUTATING_METHODS.has(options.method)) {
    headers.set(CSRF_HEADER, options.csrfToken);
  }

  const timeoutSignal = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal;

  let response: Response;
  const init: RequestInit = {
    method: options.method,
    headers,
    cache: "no-store",
    credentials: "same-origin",
    redirect: "error",
    signal
  };

  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  try {
    response = await fetch(options.url, init);
  } catch {
    return unavailableResult(requestId);
  }

  const payload = await readJson(response);
  const responseRequestId = readResponseRequestId(payload) ?? requestId;

  if (!response.ok) {
    const parsedError = apiErrorResponseSchema.safeParse(payload);

    if (parsedError.success) {
      return {
        ok: false,
        status: response.status,
        requestId: parsedError.data.meta.requestId,
        code: parsedError.data.error.code,
        message: parsedError.data.error.message,
        fieldErrors: parsedError.data.error.fieldErrors
      };
    }

    return {
      ok: false,
      status: response.status,
      requestId: responseRequestId,
      code: API_ERROR_CODES.internalError,
      message: API_ERROR_MESSAGES.INTERNAL_ERROR,
      fieldErrors: {}
    };
  }

  const parsed = options.schema.safeParse(payload);

  if (!parsed.success) {
    return {
      ok: false,
      status: response.status,
      requestId: responseRequestId,
      code: API_ERROR_CODES.internalError,
      message: API_ERROR_MESSAGES.INTERNAL_ERROR,
      fieldErrors: {}
    };
  }

  return {
    ok: true,
    status: response.status,
    requestId: responseRequestId,
    data: parsed.data
  };
}

export function buildApiUrl(
  origin: string,
  path: string,
  query?: Readonly<Record<string, string | undefined>>
): string {
  const url = new URL(path, origin);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

function headerValue(
  headers: Readonly<Record<string, string>> | undefined,
  name: string
): string | null {
  if (!headers) {
    return null;
  }

  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  return match?.[1] ?? null;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function readResponseRequestId(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null || !("meta" in payload)) {
    return null;
  }

  const meta = payload.meta;

  if (typeof meta !== "object" || meta === null || !("requestId" in meta)) {
    return null;
  }

  return typeof meta.requestId === "string" ? meta.requestId : null;
}

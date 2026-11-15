import type { ZodType } from "zod";

import { buildApiUrl, executeRequest, type ApiMethod, type ApiResult } from "./execute-request";
import { getCsrfToken } from "./csrf-memory";

type BrowserRequestOptions<Schema extends ZodType> = Readonly<{
  path: string;
  method?: ApiMethod;
  schema: Schema;
  body?: unknown;
  query?: Readonly<Record<string, string | undefined>>;
  signal?: AbortSignal;
  timeoutMs?: number;
  idempotencyKey?: string;
}>;

export function browserApi<Schema extends ZodType>(
  options: BrowserRequestOptions<Schema>
): Promise<ApiResult<Schema["_output"]>> {
  assertBrowserPath(options.path);
  const method = options.method ?? "GET";

  const csrfToken = getCsrfToken();

  return executeRequest({
    url: buildApiUrl(window.location.origin, options.path, options.query),
    method,
    schema: options.schema,
    ...(options.body !== undefined ? { body: options.body } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    ...(options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
    ...(csrfToken ? { csrfToken } : {})
  });
}

function assertBrowserPath(path: string): void {
  if (!path.startsWith("/api/v1/") || path.includes("..") || path.includes("\\") || path.includes("?")) {
    throw new Error("Некорректный путь API.");
  }
}

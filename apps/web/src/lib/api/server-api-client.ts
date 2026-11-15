import type { ZodType } from "zod";
import { cookies } from "next/headers";

import {
  buildApiUrl,
  executeRequest,
  unavailableResult,
  createRequestId,
  type ApiMethod,
  type ApiResult
} from "./execute-request";

type ServerRequestOptions<Schema extends ZodType> = Readonly<{
  path: string;
  method?: ApiMethod;
  schema: Schema;
  body?: unknown;
  query?: Readonly<Record<string, string | undefined>>;
  signal?: AbortSignal;
  timeoutMs?: number;
  idempotencyKey?: string;
}>;

export async function serverApi<Schema extends ZodType>(
  options: ServerRequestOptions<Schema>
): Promise<ApiResult<Schema["_output"]>> {
  const origin = apiOrigin();
  const requestId = createRequestId();

  if (!origin) {
    return unavailableResult(requestId);
  }

  const cookieStore = await cookies();
  const cookie = cookieStore
    .getAll()
    .map((item) => `${item.name}=${item.value}`)
    .join("; ");

  return executeRequest({
    url: buildApiUrl(origin, options.path, options.query),
    method: options.method ?? "GET",
    schema: options.schema,
    ...(options.body !== undefined ? { body: options.body } : {}),
    ...(cookie.length > 0 ? { headers: { cookie } } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    ...(options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {})
  });
}

export function apiOrigin(): string | null {
  const value = process.env.INTERNAL_API_URL?.trim();

  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

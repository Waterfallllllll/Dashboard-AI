import {
  CSRF_HEADER,
  pushSubscriptionResponseSchema,
  sessionResponseSchema,
  type PushSubscriptionCreate
} from "@dashboard/contracts";

export type BrowserPushCode = "unauthenticated" | "unavailable";

export class BrowserPushError extends Error {
  readonly code: BrowserPushCode;

  constructor(code: BrowserPushCode) {
    super(
      code === "unauthenticated"
        ? "Сначала войдите в аккаунт."
        : "Не удалось сохранить уведомления браузера."
    );
    this.name = "BrowserPushError";
    this.code = code;
  }
}

export async function saveBrowserPushSubscription(
  subscription: PushSubscriptionCreate,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const response = await readResponse(
    fetchImpl("/api/v1/push/subscriptions", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: await mutationHeaders(fetchImpl),
      body: JSON.stringify(subscription)
    })
  );
  const parsed = pushSubscriptionResponseSchema.safeParse(await readJson(response));

  if (!parsed.success) {
    throw new BrowserPushError(response.status === 401 ? "unauthenticated" : "unavailable");
  }

  return parsed.data.data.id;
}

export async function revokeBrowserPushSubscription(
  id: string,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const response = await readResponse(
    fetchImpl(`/api/v1/push/subscriptions/${encodeURIComponent(id)}`, {
      method: "DELETE",
      cache: "no-store",
      credentials: "same-origin",
      headers: await mutationHeaders(fetchImpl, false)
    })
  );

  if (response.status !== 204 && response.status !== 404) {
    throw new BrowserPushError(response.status === 401 ? "unauthenticated" : "unavailable");
  }
}

async function mutationHeaders(fetchImpl: typeof fetch, json = true): Promise<Headers> {
  const headers = new Headers({
    Accept: "application/json",
    [CSRF_HEADER]: await readCsrfToken(fetchImpl)
  });

  if (json) {
    headers.set("Content-Type", "application/json");
  }

  return headers;
}

async function readCsrfToken(fetchImpl: typeof fetch): Promise<string> {
  const response = await readResponse(
    fetchImpl("/api/v1/auth/session", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    })
  );

  if (response.status === 401) {
    throw new BrowserPushError("unauthenticated");
  }

  const parsed = sessionResponseSchema.safeParse(await readJson(response));

  if (!parsed.success) {
    throw new BrowserPushError("unavailable");
  }

  return parsed.data.data.csrfToken;
}

async function readResponse(pending: Promise<Response>): Promise<Response> {
  try {
    const response = await pending;

    if (response.status === 401) {
      throw new BrowserPushError("unauthenticated");
    }

    if (!response.ok && response.status !== 404) {
      throw new BrowserPushError("unavailable");
    }

    return response;
  } catch (error) {
    if (error instanceof BrowserPushError) {
      throw error;
    }

    throw new BrowserPushError("unavailable");
  }
}

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    throw new BrowserPushError("unavailable");
  }
}

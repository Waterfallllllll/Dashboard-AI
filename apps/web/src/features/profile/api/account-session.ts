import {
  CSRF_HEADER,
  accountDeletionResponseSchema,
  isHttpsUrl,
  sessionResponseSchema,
  signOutResponseSchema
} from "@dashboard/contracts";

export type AccountView =
  | { readonly status: "anonymous" }
  | {
      readonly status: "authenticated";
      readonly displayName: string;
      readonly avatarUrl: string | null;
      readonly csrfToken: string;
    };

export class AccountSessionError extends Error {
  readonly code: "unavailable" | "sign-out" | "delete";

  constructor(code: "unavailable" | "sign-out" | "delete" = "unavailable") {
    super(accountSessionMessage(code));
    this.name = "AccountSessionError";
    this.code = code;
  }
}

function accountSessionMessage(code: AccountSessionError["code"]): string {
  if (code === "sign-out") {
    return "Не удалось выйти. Повторите попытку.";
  }

  if (code === "delete") {
    return "Не удалось удалить аккаунт. Повторите попытку.";
  }

  return "Не удалось проверить сессию.";
}

export async function loadAccountSession(
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal
): Promise<AccountView> {
  const response = await readResponse(
    fetchImpl("/api/v1/auth/session", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      ...(signal ? { signal } : {})
    })
  );

  if (response.status === 401) {
    return { status: "anonymous" };
  }

  if (!response.ok) {
    throw new AccountSessionError();
  }

  const parsed = sessionResponseSchema.safeParse(await readJson(response));

  if (!parsed.success) {
    throw new AccountSessionError();
  }

  return {
    status: "authenticated",
    displayName: parsed.data.data.user.displayName,
    avatarUrl: visibleAvatarUrl(parsed.data.data.user.avatarUrl),
    csrfToken: parsed.data.data.csrfToken
  };
}

export async function signOutAccount(
  csrfToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const response = await readResponse(
    fetchImpl("/api/v1/auth/logout", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        [CSRF_HEADER]: csrfToken
      }
    }),
    "sign-out"
  );

  if (!response.ok) {
    throw new AccountSessionError("sign-out");
  }

  const parsed = signOutResponseSchema.safeParse(await readJson(response, "sign-out"));

  if (!parsed.success) {
    throw new AccountSessionError("sign-out");
  }
}

export async function deleteAccount(
  csrfToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const response = await readResponse(
    fetchImpl("/api/v1/account", {
      method: "DELETE",
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        [CSRF_HEADER]: csrfToken
      }
    }),
    "delete"
  );

  if (!response.ok) {
    throw new AccountSessionError("delete");
  }

  const parsed = accountDeletionResponseSchema.safeParse(await readJson(response, "delete"));

  if (!parsed.success) {
    throw new AccountSessionError("delete");
  }
}

export function visibleAvatarUrl(value: string | null): string | null {
  if (value !== null && isHttpsUrl(value)) {
    return value;
  }

  return null;
}

async function readResponse(
  pending: Promise<Response>,
  code: AccountSessionError["code"] = "unavailable"
): Promise<Response> {
  try {
    return await pending;
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    throw new AccountSessionError(code);
  }
}

async function readJson(
  response: Response,
  code: AccountSessionError["code"] = "unavailable"
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new AccountSessionError(code);
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

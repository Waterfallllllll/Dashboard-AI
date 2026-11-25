import {
  CSRF_HEADER,
  integrationDeletionResponseSchema,
  sessionResponseSchema,
  telegramLinkResponseSchema
} from "@dashboard/contracts";

const TELEGRAM_HOSTS = new Set(["t.me", "telegram.me"]);
const START_TOKEN = /^[A-Za-z0-9_-]{20,128}$/;
const BOT_PATH = /^\/[A-Za-z][A-Za-z0-9_]{4,31}$/;

export type TelegramLinkCode = "unauthenticated" | "unavailable";
export type TelegramLinkAction = "connect" | "disconnect";

export class TelegramLinkError extends Error {
  readonly code: TelegramLinkCode;

  constructor(code: TelegramLinkCode, action: TelegramLinkAction = "connect") {
    super(
      code === "unauthenticated"
        ? "Сначала войдите через Google"
        : action === "disconnect"
          ? "Не удалось отключить Telegram"
          : "Не удалось подключить Telegram"
    );
    this.name = "TelegramLinkError";
    this.code = code;
  }
}

export type TelegramLink = {
  readonly url: string;
  readonly expiresAt: string;
};

export async function createTelegramLink(fetchImpl: typeof fetch = fetch): Promise<TelegramLink> {
  const csrfToken = await readCsrfToken(fetchImpl);
  const response = await fetchImpl("/api/v1/integrations/telegram/link", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      [CSRF_HEADER]: csrfToken
    }
  });

  if (!response.ok) {
    throw new TelegramLinkError(response.status === 401 ? "unauthenticated" : "unavailable");
  }

  const body = telegramLinkResponseSchema.parse(await readJson(response));

  return {
    url: assertTelegramUrl(body.data.url),
    expiresAt: body.data.expiresAt
  };
}

export async function disconnectTelegram(fetchImpl: typeof fetch = fetch): Promise<void> {
  const csrfToken = await readCsrfToken(fetchImpl);
  const response = await fetchImpl("/api/v1/integrations/telegram", {
    method: "DELETE",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      [CSRF_HEADER]: csrfToken
    }
  });

  if (!response.ok) {
    throw new TelegramLinkError(
      response.status === 401 ? "unauthenticated" : "unavailable",
      "disconnect"
    );
  }

  integrationDeletionResponseSchema.parse(await readJson(response));
}

async function readCsrfToken(fetchImpl: typeof fetch): Promise<string> {
  const sessionResponse = await fetchImpl("/api/v1/auth/session", {
    credentials: "same-origin",
    headers: { Accept: "application/json" }
  });

  if (sessionResponse.status === 401) {
    throw new TelegramLinkError("unauthenticated");
  }

  if (!sessionResponse.ok) {
    throw new TelegramLinkError("unavailable");
  }

  const session = sessionResponseSchema.parse(await readJson(sessionResponse));
  return session.data.csrfToken;
}

function assertTelegramUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new TelegramLinkError("unavailable");
  }

  const start = url.searchParams.get("start");

  if (
    url.protocol !== "https:" ||
    !TELEGRAM_HOSTS.has(url.hostname) ||
    !BOT_PATH.test(url.pathname) ||
    url.username !== "" ||
    url.password !== "" ||
    url.hash !== "" ||
    [...url.searchParams.keys()].length !== 1 ||
    !start ||
    !START_TOKEN.test(start)
  ) {
    throw new TelegramLinkError("unavailable");
  }

  return url.href;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new TelegramLinkError("unavailable");
  }
}

import { readDataEncryptionKey } from "../infrastructure/crypto/credential-cipher.js";
import {
  GOOGLE_CALENDAR_CALLBACK_PATH,
  GOOGLE_CALLBACK_PATH,
  JSON_BODY_LIMIT,
  OAUTH_STATE_TTL_MS,
  SESSION_TTL_MS
} from "./constants.js";

const LOG_LEVELS = new Set(["fatal", "error", "warn", "info", "debug", "trace", "silent"]);

export type NodeEnv = "development" | "test" | "production";

export type AppConfig = {
  readonly nodeEnv: NodeEnv;
  readonly port: number;
  readonly appOrigin: string;
  readonly trustProxyHops: number;
  readonly sessionSecret: string;
  readonly sessionTtlMs: number;
  readonly oauthStateTtlMs: number;
  readonly googleRedirectUri: string;
  readonly googleCalendarRedirectUri: string;
  readonly corsOrigins: readonly string[];
  readonly jsonBodyLimit: string;
  readonly logLevel: string;
  readonly authRateLimit: { readonly windowMs: number; readonly limit: number };
  readonly apiRateLimit: { readonly windowMs: number; readonly limit: number };
  readonly webhookRateLimit: { readonly windowMs: number; readonly limit: number };
};

export type TelegramBotConfig = {
  readonly token: string;
  readonly username: string;
};

export type WebPushConfig = {
  readonly subject: string;
  readonly publicKey: string;
  readonly privateKey: string;
};

export type WorkerSettings = {
  readonly id: string;
  readonly pollIntervalMs: number;
  readonly leaseMs: number;
  readonly maxAttempts: number;
  readonly retentionDays: number;
};

export type ApiRuntime = {
  readonly config: AppConfig;
  readonly googleClientId: string;
  readonly googleClientSecret: string;
  readonly weatherApiBaseUrl: string;
  readonly telegram: TelegramBotConfig | null;
  readonly telegramWebhookSecret: string | null;
  readonly telegramWebhookUrl: string | null;
  readonly googleCalendarWebhookToken: string | null;
  readonly googleCalendarWebhookUrl: string | null;
  readonly webPush: WebPushConfig | null;
  readonly worker: WorkerSettings;
};

export function readApiEnv(source: NodeJS.ProcessEnv): ApiRuntime {
  readDataEncryptionKey(source);
  const nodeEnv = readNodeEnv(source.NODE_ENV);
  const appOrigin = readAppOrigin(source.APP_ORIGIN, nodeEnv);
  const googleRedirectUri = readRedirectUri(source.GOOGLE_REDIRECT_URI, appOrigin);
  const googleCalendarRedirectUri = readCalendarRedirectUri(
    source.GOOGLE_CALENDAR_REDIRECT_URI,
    appOrigin
  );
  const googleClientSecret = requiredSecret(source.GOOGLE_CLIENT_SECRET, "GOOGLE_CLIENT_SECRET");

  return {
    googleClientId: requiredId(source.GOOGLE_CLIENT_ID, "GOOGLE_CLIENT_ID"),
    googleClientSecret,
    weatherApiBaseUrl: readWeatherBaseUrl(source.WEATHER_API_BASE_URL),
    telegram: readTelegram(source.TELEGRAM_BOT_TOKEN, source.TELEGRAM_BOT_USERNAME),
    telegramWebhookSecret: readOptionalSecret(
      source.TELEGRAM_WEBHOOK_SECRET,
      "TELEGRAM_WEBHOOK_SECRET"
    ),
    telegramWebhookUrl: readOptionalHttps(source.TELEGRAM_WEBHOOK_URL, "TELEGRAM_WEBHOOK_URL"),
    googleCalendarWebhookToken: readOptionalSecret(
      source.GOOGLE_CALENDAR_WEBHOOK_TOKEN,
      "GOOGLE_CALENDAR_WEBHOOK_TOKEN"
    ),
    googleCalendarWebhookUrl: readOptionalHttps(source.GOOGLE_CALENDAR_WEBHOOK_URL),
    webPush: readWebPush(source),
    worker: readWorker(source),
    config: {
      nodeEnv,
      port: readPort(source.PORT),
      appOrigin,
      trustProxyHops: readHops(source.TRUST_PROXY_HOPS),
      sessionSecret: requiredSecret(source.SESSION_SECRET, "SESSION_SECRET", 32),
      sessionTtlMs: SESSION_TTL_MS,
      oauthStateTtlMs: OAUTH_STATE_TTL_MS,
      googleRedirectUri,
      googleCalendarRedirectUri,
      corsOrigins: readCorsOrigins(source.CORS_ALLOWED_ORIGINS, appOrigin, nodeEnv),
      jsonBodyLimit: JSON_BODY_LIMIT,
      logLevel: readLogLevel(source.LOG_LEVEL),
      authRateLimit: { windowMs: 10 * 60 * 1000, limit: 20 },
      apiRateLimit: { windowMs: 60 * 1000, limit: 300 },
      webhookRateLimit: { windowMs: 60 * 1000, limit: 60 }
    }
  };
}

function readNodeEnv(value: string | undefined): NodeEnv {
  if (value === undefined || value === "") {
    return "development";
  }

  if (value === "development" || value === "test" || value === "production") {
    return value;
  }

  throw new Error("NODE_ENV должен быть development, test или production");
}

function readAppOrigin(value: string | undefined, nodeEnv: NodeEnv): string {
  const url = parseOrigin(value, "APP_ORIGIN");

  if (nodeEnv === "production" && url.protocol !== "https:") {
    throw new Error("APP_ORIGIN в production должен быть https");
  }

  if (url.protocol !== "https:" && !isLocalHost(url.hostname)) {
    throw new Error("APP_ORIGIN без https допустим только для localhost");
  }

  return url.origin;
}

function readRedirectUri(value: string | undefined, appOrigin: string): string {
  const url = parseOrigin(value, "GOOGLE_REDIRECT_URI");

  if (url.origin !== appOrigin || url.pathname !== GOOGLE_CALLBACK_PATH || url.search !== "") {
    throw new Error("GOOGLE_REDIRECT_URI должен указывать на callback того же APP_ORIGIN");
  }

  return url.href;
}

function readCalendarRedirectUri(value: string | undefined, appOrigin: string): string {
  const raw = value?.trim() || `${appOrigin}${GOOGLE_CALENDAR_CALLBACK_PATH}`;
  const url = parseOrigin(raw, "GOOGLE_CALENDAR_REDIRECT_URI");

  if (
    url.origin !== appOrigin ||
    url.pathname !== GOOGLE_CALENDAR_CALLBACK_PATH ||
    url.search !== ""
  ) {
    throw new Error("GOOGLE_CALENDAR_REDIRECT_URI должен указывать на callback того же APP_ORIGIN");
  }

  return url.href;
}

function readWeatherBaseUrl(value: string | undefined): string {
  const raw = value?.trim() || "https://api.open-meteo.com";
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new Error("WEATHER_API_BASE_URL должен быть https://api.open-meteo.com");
  }

  if (
    url.origin !== "https://api.open-meteo.com" ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== "" ||
    (url.pathname !== "/" && url.pathname !== "")
  ) {
    throw new Error("WEATHER_API_BASE_URL должен быть https://api.open-meteo.com");
  }

  return "https://api.open-meteo.com";
}

function readOptionalSecret(value: string | undefined, name: string): string | null {
  const secret = value?.trim() ?? "";

  if (secret === "") {
    return null;
  }

  if (secret.length < 16 || secret.length > 128 || /\s/.test(secret)) {
    throw new Error(`${name} должен быть от 16 до 128 символов без пробелов`);
  }

  return secret;
}

function readOptionalHttps(
  value: string | undefined,
  name = "GOOGLE_CALENDAR_WEBHOOK_URL"
): string | null {
  const raw = value?.trim() ?? "";

  if (raw === "") {
    return null;
  }

  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${name} должен быть https-адресом`);
  }

  if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || url.hash !== "") {
    throw new Error(`${name} должен быть https-адресом`);
  }

  return url.href;
}

function readWebPush(source: NodeJS.ProcessEnv): WebPushConfig | null {
  const subject = source.WEB_PUSH_SUBJECT?.trim() ?? "";
  const publicKey = source.WEB_PUSH_PUBLIC_KEY?.trim() ?? "";
  const privateKey = source.WEB_PUSH_PRIVATE_KEY?.trim() ?? "";

  if (publicKey === "" && privateKey === "") {
    return null;
  }

  if (
    !/^(mailto:[^\s@]+@[^\s@]+|https:\/\/[^\s]+)$/.test(subject) ||
    !/^[A-Za-z0-9_-]{40,200}$/.test(publicKey) ||
    !/^[A-Za-z0-9_-]{20,200}$/.test(privateKey)
  ) {
    throw new Error("WEB_PUSH_SUBJECT, WEB_PUSH_PUBLIC_KEY и WEB_PUSH_PRIVATE_KEY задаются вместе");
  }

  return { subject, publicKey, privateKey };
}

function readWorker(source: NodeJS.ProcessEnv): WorkerSettings {
  return {
    id: readWorkerId(source.WORKER_ID),
    pollIntervalMs: readBoundedInt(
      source.JOB_POLL_INTERVAL_MS,
      10_000,
      100,
      60_000,
      "JOB_POLL_INTERVAL_MS"
    ),
    leaseMs: readBoundedInt(
      source.JOB_LEASE_DURATION_MS,
      30_000,
      1000,
      300_000,
      "JOB_LEASE_DURATION_MS"
    ),
    maxAttempts: readBoundedInt(source.JOB_MAX_ATTEMPTS, 5, 1, 10, "JOB_MAX_ATTEMPTS"),
    retentionDays: readBoundedInt(source.JOB_RETENTION_DAYS, 30, 1, 90, "JOB_RETENTION_DAYS")
  };
}

function readWorkerId(value: string | undefined): string {
  const id = value?.trim() || "worker";

  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    throw new Error("WORKER_ID задан неверно");
  }

  return id;
}

function readBoundedInt(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
  name: string
): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max) {
    throw new Error(`${name} должен быть целым числом от ${min} до ${max}`);
  }

  return Number(value);
}

function readTelegram(
  tokenValue: string | undefined,
  usernameValue: string | undefined
): TelegramBotConfig | null {
  const token = tokenValue?.trim() ?? "";
  const username = usernameValue?.trim() ?? "";

  if (token === "" && username === "") {
    return null;
  }

  if (
    !/^\d{6,16}:[A-Za-z0-9_-]{20,128}$/.test(token) ||
    !/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username)
  ) {
    throw new Error("TELEGRAM_BOT_TOKEN и TELEGRAM_BOT_USERNAME задаются вместе");
  }

  return { token, username };
}

function readCorsOrigins(value: string | undefined, appOrigin: string, nodeEnv: NodeEnv): string[] {
  const origins = new Set<string>([appOrigin]);

  for (const item of (value ?? "").split(",")) {
    const trimmed = item.trim();

    if (trimmed === "") {
      continue;
    }

    origins.add(readAppOrigin(trimmed, nodeEnv));
  }

  return [...origins];
}

function readPort(value: string | undefined): number {
  if (value === undefined || value === "") {
    return 4000;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error("PORT должен быть целым числом от 1 до 65535");
  }

  const port = Number(value);

  if (port < 1 || port > 65535) {
    throw new Error("PORT должен быть целым числом от 1 до 65535");
  }

  return port;
}

function readHops(value: string | undefined): number {
  if (value === undefined || value === "" || !/^\d+$/.test(value)) {
    throw new Error("TRUST_PROXY_HOPS должен быть целым числом от 0 до 5");
  }

  const hops = Number(value);

  if (hops > 5) {
    throw new Error("TRUST_PROXY_HOPS должен быть целым числом от 0 до 5");
  }

  return hops;
}

function readLogLevel(value: string | undefined): string {
  const level = value?.trim() || "info";

  if (!LOG_LEVELS.has(level)) {
    throw new Error("LOG_LEVEL задан неверно");
  }

  return level;
}

function requiredSecret(value: string | undefined, name: string, minLength = 8): string {
  const secret = value?.trim() ?? "";

  if (secret.length < minLength || /\s/.test(secret)) {
    throw new Error(`${name} не задан или слишком короткий`);
  }

  return secret;
}

function requiredId(value: string | undefined, name: string): string {
  const id = value?.trim() ?? "";

  if (!/^[A-Za-z0-9._-]{4,256}$/.test(id)) {
    throw new Error(`${name} не задан`);
  }

  return id;
}

function parseOrigin(value: string | undefined, name: string): URL {
  let url: URL;

  try {
    url = new URL(value ?? "");
  } catch {
    throw new Error(`${name} должен быть абсолютным http(s) адресом`);
  }

  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username !== "" ||
    url.password !== "" ||
    url.hash !== ""
  ) {
    throw new Error(`${name} должен быть абсолютным http(s) адресом`);
  }

  return url;
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

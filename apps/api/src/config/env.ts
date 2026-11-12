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
};

export type TelegramBotConfig = {
  readonly token: string;
  readonly username: string;
};

export type ApiRuntime = {
  readonly config: AppConfig;
  readonly googleClientId: string;
  readonly googleClientSecret: string;
  readonly weatherApiBaseUrl: string;
  readonly telegram: TelegramBotConfig | null;
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
      apiRateLimit: { windowMs: 60 * 1000, limit: 300 }
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

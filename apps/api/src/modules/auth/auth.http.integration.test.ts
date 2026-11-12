import { CSRF_HEADER } from "@dashboard/contracts";
import type { Express } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../app/create-app.js";
import {
  GOOGLE_CALENDAR_SCOPE,
  OAUTH_STATE_TTL_MS,
  SESSION_TTL_MS
} from "../../config/constants.js";
import type { AppConfig } from "../../config/env.js";
import {
  createCredentialCipher,
  readDataEncryptionKey
} from "../../infrastructure/crypto/credential-cipher.js";
import { ProviderUnavailableError } from "../../infrastructure/http/provider-guard.js";
import { createLogger } from "../../infrastructure/logging/logger.js";
import { MemoryCalendarRepository } from "../calendar/calendar.repository.js";
import { createExternalServices } from "../external-services.js";
import type { CalendarOAuthClient } from "../integrations/google-calendar-oauth.js";
import { MemoryIntegrationsRepository } from "../integrations/integrations.repository.js";
import { MemoryNewsRepository } from "../news/news.repository.js";
import {
  MemoryRoutinesRepository,
  MemoryTimersRepository,
  MemoryWidgetsRepository
} from "../personal-memory.js";
import { createPersonalServices } from "../personal-services.js";
import { UsersService } from "../users/users.service.js";
import { AuditService } from "../audit/audit.service.js";
import { MemoryAuditRepository } from "../audit/audit.repository.js";
import { AuthService } from "./auth.service.js";
import type { GoogleTokenSet } from "./google-identity.js";
import type { GoogleOAuthClient } from "./google-oauth.js";
import {
  createMemoryDatabase,
  MemoryAuthRepository,
  MemoryUsersRepository,
  purgeMemoryUser
} from "./memory-auth.repository.js";

export const origin = "http://localhost:3000";
const encryptionKey = Buffer.alloc(32, 8).toString("base64url");

class ScriptedGoogle implements GoogleOAuthClient {
  private sequence = 0;
  readonly identities = new Map<string, GoogleTokenSet>();

  async createAuthorizationRequest() {
    this.sequence += 1;
    const suffix = String(this.sequence).padStart(2, "0");
    const state = `state-${suffix}-${"a".repeat(40)}`;
    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`,
      state,
      nonce: `nonce-${suffix}-${"b".repeat(40)}`,
      codeVerifier: `verifier-${suffix}-${"c".repeat(40)}`
    };
  }

  async exchangeAuthorizationCode(query: URLSearchParams): Promise<GoogleTokenSet> {
    const identity = this.identities.get(query.get("code") ?? "");

    if (!identity) {
      throw new Error("unknown code");
    }

    return identity;
  }
}

export function googleUser(subject: string, name: string, picture: string): GoogleTokenSet {
  return {
    subject,
    emailVerified: true,
    name,
    picture,
    locale: "ru",
    accessToken: `ya29.${subject}-access-token`,
    refreshToken: `refresh-${subject}-token`,
    expiresIn: 3600,
    scope: "openid email profile"
  };
}

class ScriptedCalendarOAuth implements CalendarOAuthClient {
  async createAuthorizationRequest() {
    return {
      url: "https://accounts.google.com/o/oauth2/v2/auth?state=calendar-state",
      state: "calendar-state",
      codeVerifier: "calendar-verifier-secret"
    };
  }

  async exchangeAuthorizationCode() {
    return {
      accessToken: "ya29.calendar-access",
      refreshToken: "calendar-refresh",
      expiresIn: 3600,
      scope: GOOGLE_CALENDAR_SCOPE
    };
  }
}

export function createHarness(authLimit = 20, nodeEnv: AppConfig["nodeEnv"] = "test") {
  const database = createMemoryDatabase();
  const google = new ScriptedGoogle();
  const config = testConfig(authLimit, nodeEnv);
  const cipher = createCredentialCipher(
    readDataEncryptionKey({ DATA_ENCRYPTION_KEY: encryptionKey })
  );
  const auditLog = new MemoryAuditRepository();
  const audit = new AuditService(auditLog);
  const authService = new AuthService(
    new MemoryAuthRepository(database),
    google,
    cipher,
    SESSION_TTL_MS,
    OAUTH_STATE_TTL_MS,
    () => new Date(),
    audit
  );
  const usersRepository = new MemoryUsersRepository(database);
  const usersService = new UsersService(
    usersRepository,
    async (userId) => {
      purgeMemoryUser(database, userId);
    },
    () => new Date(),
    audit
  );
  const personal = createPersonalServices({
    widgets: new MemoryWidgetsRepository(),
    routines: new MemoryRoutinesRepository(),
    timers: new MemoryTimersRepository()
  });
  const external = createExternalServices({
    widgets: personal.widgets,
    routines: personal.routines,
    timers: personal.timers,
    users: usersRepository,
    integrations: new MemoryIntegrationsRepository(),
    news: new MemoryNewsRepository(),
    events: new MemoryCalendarRepository(),
    cipher,
    fetchImpl: async () => {
      throw new Error("provider down");
    },
    oauth: new ScriptedCalendarOAuth(),
    gateway: {
      async listEvents() {
        throw new ProviderUnavailableError("google-calendar");
      }
    },
    weatherApiBaseUrl: "https://api.open-meteo.com",
    telegram: null,
    audit
  });
  const app = createApp({
    config,
    logger: createLogger("silent"),
    authService,
    usersService,
    widgetsService: personal.widgets,
    routinesService: personal.routines,
    timersService: personal.timers,
    dashboardService: personal.dashboard,
    weatherService: external.weather,
    newsService: external.news,
    calendarService: external.calendar,
    integrationsService: external.integrations,
    readyCheck: async () => true
  });

  return { app, google, database, auditLog };
}

function testConfig(authLimit: number, nodeEnv: AppConfig["nodeEnv"]): AppConfig {
  return {
    nodeEnv,
    port: 4000,
    appOrigin: origin,
    trustProxyHops: 1,
    sessionSecret: "session-secret-value-0123456789abcd",
    sessionTtlMs: SESSION_TTL_MS,
    oauthStateTtlMs: OAUTH_STATE_TTL_MS,
    googleRedirectUri: `${origin}/api/v1/auth/google/callback`,
    googleCalendarRedirectUri: `${origin}/api/v1/integrations/google/callback`,
    corsOrigins: [origin],
    jsonBodyLimit: "16kb",
    logLevel: "silent",
    authRateLimit: { windowMs: 60_000, limit: authLimit },
    apiRateLimit: { windowMs: 60_000, limit: 1000 },
    webhookRateLimit: { windowMs: 60_000, limit: 60 }
  };
}

export async function login(app: Express, google: ScriptedGoogle, code: string): Promise<string> {
  const start = await request(app).get("/api/v1/auth/google").expect(302);
  const location = start.headers.location ?? "";
  expect(location.startsWith("https://accounts.google.com/")).toBe(true);
  expect(location).not.toContain("verifier-");
  const state = new URL(location).searchParams.get("state");
  const callback = await request(app)
    .get("/api/v1/auth/google/callback")
    .query({ code, state })
    .expect(302);

  expect(callback.headers.location).toBe(`${origin}/dashboard`);
  return sessionCookie(callback);
}

function sessionCookie(response: request.Response): string {
  const header = response.headers["set-cookie"];
  const lines = Array.isArray(header) ? header : [];
  const line = lines.find((item) => item.startsWith("__Host-session="));
  expect(line).toContain("HttpOnly");
  expect(line).toContain("Secure");
  expect(line).toMatch(/SameSite=Lax/i);
  expect(line).toContain("Path=/");
  expect(line).not.toMatch(/Domain=/i);
  const value = line?.split(";")[0]?.slice("__Host-session=".length) ?? "";
  expect(value.length).toBeGreaterThan(40);
  return value;
}

export function cookieHeader(token: string): string {
  return `__Host-session=${token}`;
}

describe("вход, сессия и профиль", () => {
  it("отвечает на health и не раскрывает стек на неизвестном пути", async () => {
    const { app } = createHarness();
    const live = await request(app).get("/health/live").expect(200);
    expect(live.body.data.status).toBe("live");
    expect(live.headers["x-powered-by"]).toBeUndefined();
    expect(live.headers["x-content-type-options"]).toBe("nosniff");
    expect(live.headers["referrer-policy"]).toBe("no-referrer");
    expect(live.headers["permissions-policy"]).toContain("geolocation=()");
    expect(live.headers["permissions-policy"]).toContain("camera=()");
    expect(live.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(live.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(live.headers["strict-transport-security"]).toBeUndefined();
    expect(live.headers["cross-origin-resource-policy"]).toBe("same-site");

    const missing = await request(app).get("/api/v1/missing").expect(404);
    expect(missing.body.error.code).toBe("NOT_FOUND");
    expect(JSON.stringify(missing.body)).not.toContain("stack");
  });

  it("держит сессию в cookie и не смешивает данные двух пользователей", async () => {
    const { app, google, database, auditLog } = createHarness();
    google.identities.set(
      "user-a",
      googleUser("google-a", "Илья", "https://lh3.googleusercontent.com/a/a")
    );
    google.identities.set(
      "user-b",
      googleUser("google-b", "Анна", "https://lh3.googleusercontent.com/a/b")
    );
    const cookieA = await login(app, google, "user-a");
    const cookieB = await login(app, google, "user-b");
    const sessionA = await request(app)
      .get("/api/v1/auth/session")
      .set("Cookie", cookieHeader(cookieA))
      .expect(200);
    const sessionB = await request(app)
      .get("/api/v1/auth/session")
      .set("Cookie", cookieHeader(cookieB))
      .expect(200);

    expect(sessionA.body.data.user.displayName).toBe("Илья");
    expect(sessionA.body.data.csrfToken).toEqual(expect.any(String));
    expect(sessionB.body.data.user.displayName).toBe("Анна");
    expect(JSON.stringify(sessionA.body)).not.toContain("ya29.");
    expect(JSON.stringify(sessionA.body)).not.toContain("refresh-google-a");

    for (const account of database.accounts.values()) {
      expect(account.encryptedAccessToken.startsWith("enc:v1:")).toBe(true);
      expect(account.encryptedAccessToken).not.toContain("ya29.");
      expect(account.encryptedRefreshToken).not.toContain("refresh-google");
    }

    const updated = await request(app)
      .patch("/api/v1/profile")
      .set("Cookie", cookieHeader(cookieA))
      .set("Origin", origin)
      .set(CSRF_HEADER, sessionA.body.data.csrfToken)
      .send({ displayName: "Илья Петров" })
      .expect(200);
    expect(updated.body.data.displayName).toBe("Илья Петров");

    const foreign = await request(app)
      .patch("/api/v1/profile")
      .set("Cookie", cookieHeader(cookieB))
      .set("Origin", origin)
      .set(CSRF_HEADER, sessionA.body.data.csrfToken)
      .send({ displayName: "Подмена" })
      .expect(403);
    expect(foreign.body.error.code).toBe("FORBIDDEN");

    const stillAnna = await request(app)
      .get("/api/v1/profile")
      .set("Cookie", cookieHeader(cookieB))
      .expect(200);
    expect(stillAnna.body.data.displayName).toBe("Анна");

    await request(app)
      .patch("/api/v1/profile")
      .set("Cookie", cookieHeader(cookieA))
      .send({ displayName: "Без origin" })
      .expect(403);
    await request(app).get("/api/v1/auth/session").expect(401);
    await request(app)
      .patch("/api/v1/profile")
      .set("Cookie", cookieHeader(cookieA))
      .set("Origin", origin)
      .set(CSRF_HEADER, sessionA.body.data.csrfToken)
      .send({})
      .expect(400);

    google.identities.set(
      "user-a-again",
      googleUser("google-a", "Новое имя Google", "https://lh3.googleusercontent.com/a/a2")
    );
    const rotated = await login(app, google, "user-a-again");
    const afterLogin = await request(app)
      .get("/api/v1/auth/session")
      .set("Cookie", cookieHeader(rotated))
      .expect(200);
    expect(afterLogin.body.data.user.displayName).toBe("Илья Петров");
    expect(afterLogin.body.data.user.avatarUrl).toBe("https://lh3.googleusercontent.com/a/a2");
    await request(app).get("/api/v1/profile").set("Cookie", cookieHeader(cookieA)).expect(200);

    const logout = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", cookieHeader(rotated))
      .set("Origin", origin)
      .set(CSRF_HEADER, afterLogin.body.data.csrfToken)
      .expect(200);
    expect(logout.body.data.signedOut).toBe(true);
    await request(app).get("/api/v1/profile").set("Cookie", cookieHeader(rotated)).expect(401);
    await request(app).get("/api/v1/profile").set("Cookie", cookieHeader(cookieB)).expect(200);

    const freshB = await request(app)
      .get("/api/v1/auth/session")
      .set("Cookie", cookieHeader(cookieB))
      .expect(200);
    const removed = await request(app)
      .delete("/api/v1/account")
      .set("Cookie", cookieHeader(cookieB))
      .set("Origin", origin)
      .set(CSRF_HEADER, freshB.body.data.csrfToken)
      .expect(200);
    expect(removed.body.data.deleted).toBe(true);
    await request(app).get("/api/v1/profile").set("Cookie", cookieHeader(cookieB)).expect(401);
    expect([...database.users.values()].map((user) => user.displayName)).toEqual(["Илья Петров"]);
    const userId = sessionA.body.data.user.id as string;
    expect(auditLog.records.map((record) => record.action)).toEqual([
      "login",
      "login",
      "logout",
      "account_deleted"
    ]);
    expect(auditLog.records.filter((record) => record.userId === userId)).toHaveLength(3);
    expect(auditLog.records.at(-1)).toMatchObject({
      userId: null,
      action: "account_deleted",
      target: null
    });
    expect(JSON.stringify(auditLog.records)).not.toMatch(/ya29|refresh-google|__Host-session/);
  });

  it("перенаправляет отмену и повтор callback без нового входа", async () => {
    const { app, google } = createHarness();
    google.identities.set(
      "user-a",
      googleUser("google-a", "Илья", "https://lh3.googleusercontent.com/a/a")
    );
    const start = await request(app).get("/api/v1/auth/google").expect(302);
    const state = new URL(start.headers.location ?? "").searchParams.get("state");
    const cancelled = await request(app)
      .get("/api/v1/auth/google/callback")
      .query({ error: "access_denied", state })
      .expect(302);
    expect(cancelled.headers.location).toBe(`${origin}/login?status=cancelled`);

    const replay = await request(app)
      .get("/api/v1/auth/google/callback")
      .query({ code: "user-a", state })
      .expect(302);
    expect(replay.headers.location).toBe(`${origin}/login?status=error`);
  });

  it("ограничивает частоту начала входа", async () => {
    const { app } = createHarness(2);
    await request(app).get("/api/v1/auth/google").expect(302);
    await request(app).get("/api/v1/auth/google").expect(302);
    const limited = await request(app).get("/api/v1/auth/google").expect(429);
    expect(limited.body.error.code).toBe("RATE_LIMITED");
  });

  it("включает HSTS только в production", async () => {
    const { app } = createHarness(20, "production");
    const live = await request(app).get("/health/live").expect(200);
    expect(live.headers["strict-transport-security"]).toMatch(/max-age=\d+/);
  });

  it("пишет привязку и отвязку календаря и ограничивает одноразовые ссылки", async () => {
    const { app, google, auditLog } = createHarness(3);
    google.identities.set(
      "user-a",
      googleUser("google-a", "Илья", "https://lh3.googleusercontent.com/a/a")
    );
    const cookie = await login(app, google, "user-a");
    const session = await request(app)
      .get("/api/v1/auth/session")
      .set("Cookie", cookieHeader(cookie))
      .expect(200);
    const csrf = session.body.data.csrfToken as string;
    const userId = session.body.data.user.id as string;

    const connect = await request(app)
      .post("/api/v1/integrations/google/connect")
      .set("Cookie", cookieHeader(cookie))
      .set("Origin", origin)
      .set(CSRF_HEADER, csrf)
      .expect(200);
    expect(connect.body.data.url).toContain("https://accounts.google.com/");
    expect(connect.body.data.url).not.toContain("calendar-verifier-secret");

    const state = new URL(connect.body.data.url as string).searchParams.get("state");
    const callback = await request(app)
      .get("/api/v1/integrations/google/callback")
      .query({ code: "calendar-code", state })
      .set("Cookie", cookieHeader(cookie))
      .expect(302);
    expect(callback.headers.location).toBe(`${origin}/settings/integrations?calendar=connected`);

    await request(app)
      .delete("/api/v1/integrations/google")
      .set("Cookie", cookieHeader(cookie))
      .set("Origin", origin)
      .set(CSRF_HEADER, csrf)
      .expect(200);

    expect(auditLog.records.map((record) => [record.action, record.target])).toEqual([
      ["login", "google"],
      ["integration_connected", "google_calendar"],
      ["integration_disconnected", "google_calendar"]
    ]);
    expect(auditLog.records.every((record) => record.userId === userId)).toBe(true);
    expect(JSON.stringify(auditLog.records)).not.toContain("ya29.calendar-access");

    await request(app)
      .post("/api/v1/integrations/google/connect")
      .set("Cookie", cookieHeader(cookie))
      .set("Origin", origin)
      .set(CSRF_HEADER, csrf)
      .expect(200);
    const limited = await request(app)
      .post("/api/v1/integrations/google/connect")
      .set("Cookie", cookieHeader(cookie))
      .set("Origin", origin)
      .set(CSRF_HEADER, csrf)
      .expect(429);
    expect(limited.body.error.code).toBe("RATE_LIMITED");
  });
});

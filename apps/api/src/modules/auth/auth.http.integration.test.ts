import { CSRF_HEADER } from "@dashboard/contracts";
import type { Express } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../app/create-app.js";
import type { AppConfig } from "../../config/env.js";
import {
  createCredentialCipher,
  readDataEncryptionKey
} from "../../infrastructure/crypto/credential-cipher.js";
import { createLogger } from "../../infrastructure/logging/logger.js";
import { OAUTH_STATE_TTL_MS, SESSION_TTL_MS } from "../../config/constants.js";
import { AuthService } from "./auth.service.js";
import type { GoogleOAuthClient } from "./google-oauth.js";
import type { GoogleTokenSet } from "./google-identity.js";
import {
  createMemoryDatabase,
  MemoryAuthRepository,
  MemoryUsersRepository,
  purgeMemoryUser
} from "./memory-auth.repository.js";
import {
  MemoryRoutinesRepository,
  MemoryTimersRepository,
  MemoryWidgetsRepository
} from "../personal-memory.js";
import { createPersonalServices } from "../personal-services.js";
import { UsersService } from "../users/users.service.js";

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

export function createHarness(authLimit = 20) {
  const database = createMemoryDatabase();
  const google = new ScriptedGoogle();
  const config = testConfig(authLimit);
  const cipher = createCredentialCipher(
    readDataEncryptionKey({ DATA_ENCRYPTION_KEY: encryptionKey })
  );
  const authService = new AuthService(
    new MemoryAuthRepository(database),
    google,
    cipher,
    SESSION_TTL_MS,
    OAUTH_STATE_TTL_MS
  );
  const usersService = new UsersService(new MemoryUsersRepository(database), async (userId) => {
    purgeMemoryUser(database, userId);
  });
  const personal = createPersonalServices({
    widgets: new MemoryWidgetsRepository(),
    routines: new MemoryRoutinesRepository(),
    timers: new MemoryTimersRepository()
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
    readyCheck: async () => true
  });

  return { app, google, database };
}

function testConfig(authLimit: number): AppConfig {
  return {
    nodeEnv: "test",
    port: 4000,
    appOrigin: origin,
    trustProxyHops: 1,
    sessionSecret: "session-secret-value-0123456789abcd",
    sessionTtlMs: SESSION_TTL_MS,
    oauthStateTtlMs: OAUTH_STATE_TTL_MS,
    googleRedirectUri: `${origin}/api/v1/auth/google/callback`,
    corsOrigins: [origin],
    jsonBodyLimit: "16kb",
    logLevel: "silent",
    authRateLimit: { windowMs: 60_000, limit: authLimit },
    apiRateLimit: { windowMs: 60_000, limit: 1000 }
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

    const missing = await request(app).get("/api/v1/missing").expect(404);
    expect(missing.body.error.code).toBe("NOT_FOUND");
    expect(JSON.stringify(missing.body)).not.toContain("stack");
  });

  it("держит сессию в cookie и не смешивает данные двух пользователей", async () => {
    const { app, google, database } = createHarness();
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
});

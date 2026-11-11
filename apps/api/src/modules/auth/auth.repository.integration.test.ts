import type { Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  CREDENTIAL_PURPOSES,
  createCredentialCipher,
  readDataEncryptionKey
} from "../../infrastructure/crypto/credential-cipher.js";
import { closeMongo, connectMongo } from "../../infrastructure/mongodb/mongo-client.js";
import { runMigrations } from "../../infrastructure/mongodb/migrations/runner.js";
import { MongoAuthRepository, type NewGoogleLogin } from "./auth.repository.js";

const mongoUri = process.env.MONGODB_URI ?? "";
const testDatabaseName = "dashboard_auth_test";
const plaintextAccess = "ya29.secret-access-token";
const plaintextRefresh = "1//secret-refresh-token";
let db: Db | undefined;

describe.skipIf(mongoUri === "")("репозиторий входа Google", () => {
  beforeAll(async () => {
    const client = await connectMongo({ uri: mongoUri, dbName: testDatabaseName, maxPoolSize: 5 });
    db = client.db(testDatabaseName);
    await db.dropDatabase();
    await runMigrations(db);
  });

  afterAll(async () => {
    if (!db) {
      return;
    }

    const client = db.client;
    await db.dropDatabase();
    await closeMongo(client);
  });

  it("хранит state один раз и токены только в ciphertext", async () => {
    const database = requiredDb();
    const repository = new MongoAuthRepository(database);
    const cipher = createCredentialCipher(
      readDataEncryptionKey({ DATA_ENCRYPTION_KEY: Buffer.alloc(32, 4).toString("base64url") })
    );
    const now = new Date("2026-11-11T12:00:00.000Z");
    const stateHash = "a".repeat(64);
    const payload = cipher.encrypt(
      JSON.stringify({ codeVerifier: "c".repeat(43), nonce: "n".repeat(43) }),
      CREDENTIAL_PURPOSES.oauthTransaction
    );

    await repository.saveOauthState({
      tokenHash: stateHash,
      encryptedPayload: payload,
      expiresAt: new Date(now.getTime() + 60_000),
      now
    });
    expect(await repository.consumeOauthState(stateHash, now)).toEqual({
      encryptedPayload: payload
    });
    expect(await repository.consumeOauthState(stateHash, now)).toBeNull();

    const login: NewGoogleLogin = {
      providerUserId: "google-subject-1",
      encryptedAccessToken: cipher.encrypt(plaintextAccess, CREDENTIAL_PURPOSES.accessToken),
      encryptedRefreshToken: cipher.encrypt(plaintextRefresh, CREDENTIAL_PURPOSES.refreshToken),
      scope: ["openid", "email", "profile"],
      tokenExpiresAt: new Date(now.getTime() + 3_600_000),
      displayName: "Илья",
      avatarUrl: "https://lh3.googleusercontent.com/a/example",
      locale: "ru",
      tokenHash: "b".repeat(64),
      sessionExpiresAt: new Date(now.getTime() + 86_400_000),
      now
    };
    const created = await repository.completeGoogleLogin(login);
    const stored = await database.collection("auth_accounts").findOne({ provider: "google" });
    const raw = JSON.stringify(stored);

    expect(stored?.encryptedAccessToken).toMatch(/^enc:v1:/);
    expect(raw).not.toContain(plaintextAccess);
    expect(raw).not.toContain(plaintextRefresh);
    expect(await repository.findActiveSession(login.tokenHash, now)).toMatchObject({
      sessionId: created.sessionId,
      user: { displayName: "Илья" }
    });

    await repository.revokeSession(created.sessionId, now);
    expect(await repository.findActiveSession(login.tokenHash, now)).toBeNull();
  });
});

function requiredDb(): Db {
  if (!db) {
    throw new Error("База auth-теста не подключена");
  }

  return db;
}

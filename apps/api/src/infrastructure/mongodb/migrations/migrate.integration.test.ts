import { ObjectId } from "mongodb";
import type { Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { COLLECTION_NAMES } from "../collection-catalog.js";
import type { IntegrationDocument } from "../collection-catalog.js";
import { INDEX_DEFINITIONS } from "../index-catalog.js";
import { closeMongo, connectMongo } from "../mongo-client.js";
import { activeDocumentFilter, restoreSoftDeletedById, softDeleteById } from "../soft-delete.js";
import {
  SCHEMA_MIGRATIONS_COLLECTION,
  SCHEMA_MIGRATIONS_VERSION_INDEX,
  runMigrations
} from "./runner.js";

const mongoUri = process.env.MONGODB_URI ?? "";
const testDatabaseName = "dashboard_migration_test";
let db: Db | undefined;

describe.skipIf(mongoUri === "")("миграции MongoDB", () => {
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

  it("один раз записывает версию и создаёт индексы", async () => {
    const database = requiredDb();
    const repeated = await runMigrations(database);

    expect(repeated.applied).toEqual([]);
    expect(repeated.skipped).toEqual([1, 2, 3, 4, 5]);
    expect(
      (await database.collection(SCHEMA_MIGRATIONS_COLLECTION).find().project({ _id: 0 }).toArray())
        .slice()
        .sort((left, right) => Number(left.version) - Number(right.version))
    ).toEqual([
      expect.objectContaining({
        version: 1,
        name: "initial-indexes",
        appliedAt: expect.any(Date)
      }),
      expect.objectContaining({
        version: 2,
        name: "one-time-tokens",
        appliedAt: expect.any(Date)
      }),
      expect.objectContaining({
        version: 3,
        name: "external-adapters",
        appliedAt: expect.any(Date)
      }),
      expect.objectContaining({
        version: 4,
        name: "background-jobs",
        appliedAt: expect.any(Date)
      }),
      expect.objectContaining({
        version: 5,
        name: "security-audit",
        appliedAt: expect.any(Date)
      })
    ]);
    await expect(
      database.collection(SCHEMA_MIGRATIONS_COLLECTION).insertOne({
        version: 1,
        name: "again",
        appliedAt: new Date()
      })
    ).rejects.toMatchObject({ code: 11000 });
    await expect(
      database.collection(SCHEMA_MIGRATIONS_COLLECTION).insertOne({ version: 0, name: "bad" })
    ).rejects.toMatchObject({ code: 121 });

    const names = new Set(
      (await database.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name)
    );
    expect([...COLLECTION_NAMES].every((name) => names.has(name))).toBe(true);

    for (const definition of INDEX_DEFINITIONS) {
      const indexes = await database.collection(definition.collection).indexes();
      const found = indexes.find((index) => index.name === definition.name);
      expect(found?.key).toEqual({ ...definition.key });

      if (definition.kind === "unique") {
        expect(found?.unique).toBe(true);
      }

      if (definition.kind === "ttl") {
        expect(found?.expireAfterSeconds).toBe(0);
      }

      if (definition.kind !== "ttl" && definition.partialFilterExpression) {
        expect(found?.partialFilterExpression).toEqual({ ...definition.partialFilterExpression });
      }
    }

    const ledgerIndexes = await database.collection(SCHEMA_MIGRATIONS_COLLECTION).indexes();
    expect(ledgerIndexes.some((index) => index.name === SCHEMA_MIGRATIONS_VERSION_INDEX)).toBe(
      true
    );
    expect(await database.collection("users").indexes()).toEqual([
      expect.objectContaining({ name: "_id_" })
    ]);
  });

  it("держит уникальность, одну активную сессию таймера и мягкое удаление", async () => {
    const database = requiredDb();
    const userId = new ObjectId();
    const now = new Date("2026-11-09T12:00:00.000Z");
    await database.collection("auth_accounts").insertOne(authAccount(userId));
    await expect(
      database.collection("auth_accounts").insertOne(authAccount(userId))
    ).rejects.toMatchObject({ code: 11000 });

    const timers = database.collection("timer_sessions");
    await timers.insertOne(timerSession(userId, null));
    await expect(timers.insertOne(timerSession(userId, null))).rejects.toMatchObject({
      code: 11000
    });
    await expect(
      timers.insertOne(timerSession(userId, new Date("2026-11-09T11:00:00.000Z")))
    ).resolves.toHaveProperty("acknowledged", true);

    const integrations = database.collection<IntegrationDocument>("integrations");
    const created = await integrations.insertOne(integration(userId));
    expect(await softDeleteById(integrations, created.insertedId, now)).toBe("deleted");
    expect(await integrations.countDocuments(activeDocumentFilter)).toBe(0);
    expect(await integrations.countDocuments({ _id: created.insertedId })).toBe(1);
    expect(await softDeleteById(integrations, created.insertedId, now)).toBe("already-deleted");
    expect(await restoreSoftDeletedById(integrations, created.insertedId, now)).toBe("restored");
    expect(await integrations.countDocuments(activeDocumentFilter)).toBe(1);
    expect(await softDeleteById(integrations, created.insertedId, now)).toBe("deleted");
    await expect(integrations.insertOne(integration(userId))).resolves.toHaveProperty(
      "acknowledged",
      true
    );
    expect(await softDeleteById(integrations, new ObjectId(), now)).toBe("missing");
    expect(await restoreSoftDeletedById(integrations, new ObjectId(), now)).toBe("missing");
  });
});

function requiredDb(): Db {
  if (!db) {
    throw new Error("База тестовой миграции не открыта");
  }

  return db;
}

function authAccount(userId: ObjectId) {
  return {
    schemaVersion: 1 as const,
    userId,
    provider: "google" as const,
    providerUserId: "google-user",
    encryptedAccessToken: null,
    encryptedRefreshToken: null,
    scope: [],
    expiresAt: null,
    createdAt: new Date("2026-11-09T12:00:00.000Z"),
    updatedAt: new Date("2026-11-09T12:00:00.000Z")
  };
}

function timerSession(userId: ObjectId, completedAt: Date | null) {
  return {
    schemaVersion: 1 as const,
    userId,
    preset: {
      mode: "pomodoro" as const,
      workMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15
    },
    runStatus: completedAt ? ("idle" as const) : ("running" as const),
    phase: "work" as const,
    startedAt: new Date("2026-11-09T10:00:00.000Z"),
    pausedAt: null,
    endsAt: completedAt ? null : new Date("2026-11-09T10:25:00.000Z"),
    completedAt,
    cycleNumber: 1,
    version: 1
  };
}

function integration(userId: ObjectId): IntegrationDocument {
  const now = new Date("2026-11-09T12:00:00.000Z");
  return {
    _id: new ObjectId(),
    schemaVersion: 1 as const,
    userId,
    type: "google_calendar" as const,
    status: "connected" as const,
    encryptedCredentials: null,
    scope: ["calendar.readonly"],
    externalUserId: "google-user",
    lastSyncAt: null,
    syncCursor: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };
}

import { ObjectId } from "mongodb";
import type { Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AccountStillActiveError, purgeAccount } from "./account-purge.js";
import { checkDatabase } from "./check-database.js";
import type { UserDocument } from "./collection-catalog.js";
import { INDEX_USED_REASON, explainNamedQuery } from "./explain-query.js";
import { checkDataIntegrity } from "./integrity.js";
import { closeMongo, connectMongo } from "./mongo-client.js";
import { notificationDeleteAt } from "./retention.js";
import { softDeleteById } from "./soft-delete.js";
import { runMigrations } from "./migrations/runner.js";

const mongoUri = process.env.MONGODB_URI ?? "";
const testDatabaseName = "dashboard_storage_check_test";
const now = new Date("2026-11-09T12:00:00.000Z");
const volumeSize = 80;

type Fixture = {
  userA: ObjectId;
  userB: ObjectId;
  ruleA: ObjectId;
  ruleB: ObjectId;
};

let db: Db | undefined;
let fixture: Fixture | undefined;

describe.skipIf(mongoUri === "")("проверка запросов, целостности и очистки аккаунта", () => {
  beforeAll(async () => {
    const client = await connectMongo({ uri: mongoUri, dbName: testDatabaseName, maxPoolSize: 5 });
    db = client.db(testDatabaseName);
    await db.dropDatabase();
    await runMigrations(db);
    fixture = await seed(db);
  }, 30_000);

  afterAll(async () => {
    if (!db) {
      return;
    }

    const client = db.client;
    await db.dropDatabase();
    await closeMongo(client);
  });

  it("подтверждает индексы основных запросов и чистые ссылки", async () => {
    const report = await checkDatabase(requiredDb());

    expect(report.queries.filter((query) => !query.ok)).toEqual([]);
    expect(report.integrity.violations).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it("на большой выборке планировщик берёт индекс ленты, истории таймера и рутин", async () => {
    const database = requiredDb();
    const inserted = await insertVolume(database);

    try {
      for (const name of ["news-feed", "timer-history", "routines-by-user-status"] as const) {
        const result = await explainNamedQuery(database, name);
        expect(result.reason).toBe(INDEX_USED_REASON);
      }
    } finally {
      await deleteVolume(database, inserted);
    }
  }, 30_000);

  it("находит битые ссылки, виджеты и срок журнала, затем убирает их", async () => {
    const database = requiredDb();
    const current = requiredFixture();
    const broken = await insertBroken(database, current);

    try {
      const report = await checkDataIntegrity(database);
      expect(report.violations.map((item) => item.code).sort()).toEqual(
        [
          "CALENDAR_INTEGRATION_MISSING",
          "DELIVERY_EXPIRY_OUT_OF_POLICY",
          "DELIVERY_WITHOUT_EXPIRY",
          "DUPLICATE_WIDGET",
          "DUPLICATE_WIDGET_POSITION",
          "ORPHAN_USER",
          "ROUTINE_OWNER_MISMATCH",
          "ROUTINE_RULE_MISSING"
        ].sort()
      );
    } finally {
      await removeBroken(database, current.userA, broken);
    }

    expect((await checkDataIntegrity(database)).ok).toBe(true);
  });

  it("физически удаляет только мягко удалённый аккаунт и не трогает новости", async () => {
    const database = requiredDb();
    const current = requiredFixture();
    const newsBefore = await database.collection("news_items").countDocuments();

    await expect(purgeAccount(database, current.userA)).rejects.toBeInstanceOf(
      AccountStillActiveError
    );
    expect(await database.collection("users").countDocuments({ _id: current.userA })).toBe(1);

    await softDeleteById(database.collection<UserDocument>("users"), current.userB, now);
    const purged = await purgeAccount(database, current.userB);

    expect(purged.user).toBe("purged");
    expect(purged.deleted).toEqual({
      users: 1,
      auth_accounts: 1,
      sessions: 1,
      dashboard_configs: 1,
      routine_rules: 1,
      routine_occurrences: 1,
      timer_sessions: 1,
      integrations: 1,
      calendar_events: 1,
      push_subscriptions: 1,
      notification_deliveries: 1
    });
    expect(await database.collection("users").countDocuments({ _id: current.userB })).toBe(0);
    expect(await database.collection("sessions").countDocuments({ userId: current.userB })).toBe(0);
    expect(await database.collection("sessions").countDocuments({ userId: current.userA })).toBe(1);
    expect(await database.collection("news_items").countDocuments()).toBe(newsBefore);

    const repeated = await purgeAccount(database, current.userB);
    expect(repeated.user).toBe("missing");
    expect(Object.values(repeated.deleted).reduce((sum, count) => sum + count, 0)).toBe(0);
    expect(await database.collection("schema_migrations").countDocuments()).toBe(3);
  });
});

function requiredDb(): Db {
  if (!db) {
    throw new Error("База проверки хранилища не открыта");
  }

  return db;
}

function requiredFixture(): Fixture {
  if (!fixture) {
    throw new Error("Тестовые аккаунты не созданы");
  }

  return fixture;
}

async function seed(database: Db): Promise<Fixture> {
  const current = {
    userA: new ObjectId(),
    userB: new ObjectId(),
    ruleA: new ObjectId(),
    ruleB: new ObjectId()
  };

  await database
    .collection("users")
    .insertMany([user(current.userA, "Аня"), user(current.userB, "Боря")]);
  await insertOwned(database, current.userA, current.ruleA, "a");
  await insertOwned(database, current.userB, current.ruleB, "b");
  await database
    .collection("news_items")
    .insertOne(newsItem("e".repeat(32), "https://example.com/news/1"));

  return current;
}

async function insertOwned(
  database: Db,
  userId: ObjectId,
  ruleId: ObjectId,
  suffix: "a" | "b"
): Promise<void> {
  const hash = suffix === "a" ? "a" : "b";

  await database.collection("auth_accounts").insertOne({
    schemaVersion: 1,
    userId,
    provider: "google",
    providerUserId: `google-${suffix}`,
    encryptedAccessToken: null,
    encryptedRefreshToken: null,
    scope: [],
    expiresAt: null,
    createdAt: now,
    updatedAt: now
  });
  await database.collection("sessions").insertOne({
    schemaVersion: 1,
    userId,
    tokenHash: hash.repeat(64),
    expiresAt: new Date("2026-11-10T12:00:00.000Z"),
    createdAt: now,
    revokedAt: null
  });
  await database.collection("dashboard_configs").insertOne({
    schemaVersion: 1,
    userId,
    widgets: [widget("routines", 0)],
    updatedAt: now
  });
  await database.collection("routine_rules").insertOne({
    _id: ruleId,
    schemaVersion: 1,
    userId,
    title: `Вода ${suffix}`,
    description: null,
    startDate: "2026-11-01",
    endDate: null,
    recurrenceRule: { kind: "daily", days: [] },
    reminderLocalTime: null,
    timezone: "Europe/Moscow",
    status: "active",
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  });
  await database.collection("routine_occurrences").insertOne({
    schemaVersion: 1,
    userId,
    routineRuleId: ruleId,
    localDate: "2026-11-09",
    titleOverride: null,
    status: "pending",
    completedAt: null,
    excludedAt: null
  });
  await database.collection("timer_sessions").insertOne(timer(userId, null, now));
  const integration = await database.collection("integrations").insertOne({
    schemaVersion: 1,
    userId,
    type: "google_calendar",
    status: "connected",
    encryptedCredentials: null,
    scope: ["calendar.readonly"],
    externalUserId: `ext-${suffix}`,
    lastSyncAt: null,
    syncCursor: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  });
  await database.collection("calendar_events").insertOne({
    schemaVersion: 1,
    userId,
    integrationId: integration.insertedId,
    externalEventId: `evt-${suffix}`,
    calendarName: "Основной",
    title: "Встреча",
    startAt: new Date("2026-11-09T09:00:00.000Z"),
    endAt: new Date("2026-11-09T10:00:00.000Z"),
    allDay: false,
    location: null,
    meetingUrl: null,
    htmlLink: "https://www.google.com/calendar/event?eid=abc",
    status: "confirmed",
    updatedAt: now
  });
  await database.collection("push_subscriptions").insertOne({
    schemaVersion: 1,
    userId,
    endpointHash: (suffix === "a" ? "c" : "d").repeat(64),
    endpoint: `https://push.example.com/${suffix}`,
    encryptedKeys: "enc:v1:placeholder",
    createdAt: now,
    revokedAt: null
  });
  await database
    .collection("notification_deliveries")
    .insertOne(
      delivery(userId, `timer:${suffix}:work-completed:telegram`, notificationDeleteAt(now))
    );
}

async function insertVolume(database: Db): Promise<{
  news: ObjectId[];
  timers: ObjectId[];
  rules: ObjectId[];
}> {
  const inserted = {
    news: [] as ObjectId[],
    timers: [] as ObjectId[],
    rules: [] as ObjectId[]
  };

  try {
    const news = await database
      .collection("news_items")
      .insertMany(
        Array.from({ length: volumeSize }, (_, index) =>
          newsItem(
            `vol${String(index).padStart(13, "0")}`,
            `https://example.com/volume/${index}`,
            index
          )
        )
      );
    inserted.news = Object.values(news.insertedIds);
    const timers = await database
      .collection("timer_sessions")
      .insertMany(
        Array.from({ length: volumeSize }, (_, index) =>
          timer(
            new ObjectId(),
            new Date(Date.UTC(2026, 0, 2, 0, 0, index)),
            new Date(Date.UTC(2026, 0, 1, 0, 0, index))
          )
        )
      );
    inserted.timers = Object.values(timers.insertedIds);
    const rules = await database.collection("routine_rules").insertMany(
      Array.from({ length: volumeSize }, (_, index) => ({
        schemaVersion: 1 as const,
        userId: new ObjectId(),
        title: `Объём ${index}`,
        description: null,
        startDate: "2026-11-01",
        endDate: null,
        recurrenceRule: { kind: "daily" as const, days: [] },
        reminderLocalTime: null,
        timezone: "Europe/Moscow",
        status: "active" as const,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      }))
    );
    inserted.rules = Object.values(rules.insertedIds);
    return inserted;
  } catch (error) {
    await deleteVolume(database, inserted);
    throw error;
  }
}

async function deleteVolume(
  database: Db,
  inserted: { news: ObjectId[]; timers: ObjectId[]; rules: ObjectId[] }
): Promise<void> {
  await database.collection("news_items").deleteMany({ _id: { $in: inserted.news } });
  await database.collection("timer_sessions").deleteMany({ _id: { $in: inserted.timers } });
  await database.collection("routine_rules").deleteMany({ _id: { $in: inserted.rules } });
}

async function insertBroken(
  database: Db,
  current: Fixture
): Promise<{
  orphanId: ObjectId;
  mismatchId: ObjectId;
  expiredId: ObjectId;
  openId: ObjectId;
  calendarId: ObjectId;
}> {
  const orphan = await database.collection("routine_occurrences").insertOne({
    schemaVersion: 1,
    userId: new ObjectId(),
    routineRuleId: new ObjectId(),
    localDate: "2026-11-08",
    titleOverride: null,
    status: "pending",
    completedAt: null,
    excludedAt: null
  });
  const mismatch = await database.collection("routine_occurrences").insertOne({
    schemaVersion: 1,
    userId: current.userA,
    routineRuleId: current.ruleB,
    localDate: "2026-11-08",
    titleOverride: null,
    status: "done",
    completedAt: now,
    excludedAt: null
  });
  const openEnded = await database
    .collection("notification_deliveries")
    .insertOne(delivery(current.userA, "timer:broken:work-completed:telegram", null));
  const expired = await database
    .collection("notification_deliveries")
    .insertOne(delivery(current.userA, "timer:expired:work-completed:telegram", now));
  const brokenCalendar = await database.collection("calendar_events").insertOne({
    schemaVersion: 1,
    userId: current.userA,
    integrationId: new ObjectId(),
    externalEventId: "missing-integration",
    calendarName: "Основной",
    title: "Чужая",
    startAt: now,
    endAt: new Date("2026-11-09T13:00:00.000Z"),
    allDay: false,
    location: null,
    meetingUrl: null,
    htmlLink: "https://www.google.com/calendar/event?eid=missing",
    status: "confirmed",
    updatedAt: now
  });

  await database
    .collection("dashboard_configs")
    .updateOne(
      { userId: current.userA },
      { $set: { widgets: [widget("datetime", 0), widget("datetime", 0)] } }
    );

  return {
    orphanId: orphan.insertedId,
    mismatchId: mismatch.insertedId,
    expiredId: expired.insertedId,
    openId: openEnded.insertedId,
    calendarId: brokenCalendar.insertedId
  };
}

async function removeBroken(
  database: Db,
  userId: ObjectId,
  broken: {
    orphanId: ObjectId;
    mismatchId: ObjectId;
    expiredId: ObjectId;
    openId: ObjectId;
    calendarId: ObjectId;
  }
): Promise<void> {
  await database.collection("routine_occurrences").deleteMany({
    _id: { $in: [broken.orphanId, broken.mismatchId] }
  });
  await database.collection("notification_deliveries").deleteMany({
    _id: { $in: [broken.expiredId, broken.openId] }
  });
  await database.collection("calendar_events").deleteOne({ _id: broken.calendarId });
  await database
    .collection("dashboard_configs")
    .updateOne({ userId }, { $set: { widgets: [widget("routines", 0)] } });
}

function user(id: ObjectId, displayName: string) {
  return {
    _id: id,
    schemaVersion: 1 as const,
    displayName,
    avatarUrl: null,
    locale: "ru",
    timezone: "Europe/Moscow",
    timeFormat: "24" as const,
    theme: "system" as const,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };
}

function widget(widgetType: "routines" | "datetime", position: number) {
  return {
    widgetType,
    enabled: true,
    position,
    size: "standard" as const,
    settings: {},
    version: 1,
    updatedAt: now
  };
}

function timer(userId: ObjectId, completedAt: Date | null, startedAt: Date) {
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
    startedAt,
    pausedAt: null,
    endsAt: completedAt ? null : new Date("2026-11-09T12:25:00.000Z"),
    completedAt,
    cycleNumber: 1,
    version: 1
  };
}

function delivery(userId: ObjectId, idempotencyKey: string, deleteAt: Date | null) {
  return {
    schemaVersion: 1 as const,
    userId,
    eventType: "work" as const,
    channel: "telegram" as const,
    idempotencyKey,
    status: "sent" as const,
    attempts: 1,
    providerMessageId: null,
    createdAt: now,
    updatedAt: now,
    deleteAt
  };
}

function newsItem(contentHash: string, canonicalUrl: string, index = 0) {
  return {
    schemaVersion: 1 as const,
    source: "digest",
    title: `Сводка ${index}`,
    excerpt: "Коротко",
    canonicalUrl,
    contentHash,
    publishedAt: new Date(Date.UTC(2026, 10, 1, 0, 0, index)),
    language: "ru",
    topics: ["focus"],
    imageUrl: null,
    createdAt: now
  };
}

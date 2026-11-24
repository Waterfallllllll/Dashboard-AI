import type { Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closeMongo, connectMongo } from "../../infrastructure/mongodb/mongo-client.js";
import { runMigrations } from "../../infrastructure/mongodb/migrations/runner.js";
import { createPersonalServices } from "../personal-services.js";
import { MongoRoutinesRepository } from "../routines/routines.repository.js";
import { MongoTimersRepository } from "../timers/timers.repository.js";
import { MongoWidgetsRepository } from "../widgets/widgets.repository.js";

const mongoUri = process.env.MONGODB_URI ?? "";
const testDatabaseName = "dashboard_personal_test";
let db: Db | undefined;

const actor = {
  userId: "a".repeat(24),
  sessionId: "session",
  timezone: "Europe/Moscow",
  timeFormat: "24" as const
};

describe.skipIf(mongoUri === "")("личные данные в MongoDB", () => {
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

  it("сохраняет настройки, рутину и таймер в форме коллекций", async () => {
    const database = requiredDb();
    const now = new Date("2026-11-11T09:00:00.000Z");
    const personal = createPersonalServices(
      {
        widgets: new MongoWidgetsRepository(database),
        routines: new MongoRoutinesRepository(database),
        timers: new MongoTimersRepository(database)
      },
      { now: () => now }
    );

    const preferences = await personal.widgets.get(actor);
    expect(preferences.widgets).toHaveLength(6);
    const storedConfig = await database.collection("dashboard_configs").findOne({});
    expect(storedConfig?.widgets).toHaveLength(6);

    const created = await personal.routines.create(
      actor,
      { title: "Зарядка", startDate: "2026-11-11", recurrence: { kind: "daily" } },
      actor.timezone,
      "routine-mongo-01"
    );
    const day = await personal.routines.listDay(actor, "2026-11-11", "2026-11-11");
    expect(day.items).toHaveLength(1);
    const occurrence = day.items[0];

    if (!occurrence) {
      throw new Error("Дело не создано");
    }

    await personal.routines.updateOccurrence(actor, occurrence.id, { status: "done" });
    const rule = await database.collection("routine_rules").findOne({});
    const savedOccurrence = await database.collection("routine_occurrences").findOne({});
    expect(rule?.title).toBe("Зарядка");
    expect(rule?.userId.toHexString()).toBe(actor.userId);
    expect(savedOccurrence?.status).toBe("done");
    expect(savedOccurrence?.routineRuleId).toBe(created.rule.id);

    const started = await personal.timers.start(
      actor,
      {
        preset: { mode: "pomodoro", workMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 }
      },
      "2026-11-11",
      actor.timezone,
      null
    );
    const sessionId = started.snapshot.session?.id;

    if (!sessionId || !started.snapshot.session) {
      throw new Error("Таймер не запустился");
    }

    await personal.timers.update(
      actor,
      sessionId,
      { action: "pause", version: started.snapshot.session.version },
      "2026-11-11",
      actor.timezone
    );
    const timer = await database.collection("timer_sessions").findOne({});
    expect(timer?.runStatus).toBe("paused");
    expect(timer?.endsAt).toBeInstanceOf(Date);
    expect(JSON.stringify(timer)).not.toContain("accessToken");

    const dashboard = await personal.dashboard.load(actor, "2026-11-11");
    expect(dashboard.weather.status).toBe("unavailable");
    expect(dashboard.routines.status).toBe("ready");
    expect(dashboard.timer.status).toBe("ready");
  });
});

function requiredDb(): Db {
  if (!db) {
    throw new Error("Нет подключения к MongoDB");
  }

  return db;
}

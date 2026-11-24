import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";

import { readDatabaseConfig } from "./database-config.js";
import { connectWithRetries, disconnectPrisma, getPrismaClient } from "./prisma-client.js";

const localUrl = "postgresql://dashboard:local-only@127.0.0.1:5432/dashboard";

const MODEL_NAMES = [
  "User",
  "AuthAccount",
  "Session",
  "OneTimeToken",
  "WidgetPreference",
  "RoutineRule",
  "RoutineOccurrence",
  "TimerPreset",
  "TimerSession",
  "Integration",
  "CalendarEvent",
  "NewsItem",
  "PushSubscription",
  "ScheduledJob",
  "NotificationDelivery",
  "AuditEvent"
] as const;

describe("схема Prisma", () => {
  const schema = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");

  it("описывает модели каталога и не содержит адрес базы", () => {
    const models = [...schema.matchAll(/^model (\w+) \{$/gm)].map((match) => match[1]);

    expect(models).toEqual([...MODEL_NAMES]);
    expect(schema).not.toContain("DATABASE_URL");
    expect(schema).toContain('provider = "postgresql"');
  });
});

describe("адрес PostgreSQL", () => {
  it("принимает postgresql и postgres и не возвращает пароль", () => {
    const config = readDatabaseConfig({
      DATABASE_URL: "postgres://dashboard:local-only@localhost:5432/dashboard"
    });

    expect(config.connectionString).toContain("postgres://");
    expect(config.poolMax).toBe(10);
    expect(config.statementTimeoutMs).toBe(10_000);
    expect(config.idleInTransactionTimeoutMs).toBe(30_000);
    expect(config.workMem).toBe("8MB");
    expect(JSON.stringify({ poolMax: config.poolMax })).not.toContain("local-only");
  });

  it("отклоняет пустой адрес, чужой протокол и адрес без базы", () => {
    const secret = "secret-db-pass";

    expect(() => readDatabaseConfig({})).toThrow(/DATABASE_URL/);
    expect(() => readDatabaseConfig({})).not.toThrow(new RegExp(secret));
    expect(() =>
      readDatabaseConfig({ DATABASE_URL: `mysql://user:${secret}@localhost/dashboard` })
    ).toThrow(/PostgreSQL/);
    expect(() =>
      readDatabaseConfig({ DATABASE_URL: `mysql://user:${secret}@localhost/dashboard` })
    ).not.toThrow(new RegExp(secret));
    expect(() =>
      readDatabaseConfig({ DATABASE_URL: `postgresql://user:${secret}@localhost` })
    ).toThrow(/PostgreSQL/);
    expect(() =>
      readDatabaseConfig({ DATABASE_URL: `postgresql://user:${secret}@localhost` })
    ).not.toThrow(new RegExp(secret));
  });
});

describe("клиент Prisma", () => {
  afterEach(async () => {
    await disconnectPrisma();
  });

  it("возвращает один клиент на процесс", () => {
    const first = getPrismaClient({ DATABASE_URL: localUrl });
    const second = getPrismaClient({
      DATABASE_URL: "postgresql://other:other@127.0.0.1:5432/other"
    });

    expect(second).toBe(first);
  });

  it("повторяет временный сбой и не повторяет отказ входа", async () => {
    let transientCalls = 0;

    await connectWithRetries(
      () => {
        transientCalls += 1;

        if (transientCalls < 3) {
          throw Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
        }

        return Promise.resolve();
      },
      { delay: () => Promise.resolve() }
    );

    expect(transientCalls).toBe(3);

    let authCalls = 0;
    const secret = "secret-db-pass";

    try {
      await connectWithRetries(
        () => {
          authCalls += 1;
          throw Object.assign(new Error(`password authentication failed ${secret}`), {
            code: "28P01"
          });
        },
        { delay: () => Promise.resolve() }
      );
      throw new Error("отказ входа не должен считаться успешным подключением");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);

      if (!(error instanceof Error)) {
        return;
      }

      expect(error.message).toBe("Не удалось подключиться к PostgreSQL (code 28P01)");
      expect(error.message).not.toContain(secret);
    }

    expect(authCalls).toBe(1);
  });
});

import { afterAll, describe, expect, it } from "vitest";

import { connectDatabase, disconnectPrisma, pingDatabase } from "./prisma-client.js";

const databaseUrl = process.env.DATABASE_URL ?? "";
const hasPostgres =
  databaseUrl.startsWith("postgresql://") || databaseUrl.startsWith("postgres://");

describe.skipIf(!hasPostgres)("подключение к PostgreSQL", () => {
  afterAll(async () => {
    await disconnectPrisma();
  });

  it("выполняет SELECT 1", async () => {
    await connectDatabase();

    await expect(pingDatabase()).resolves.toBe(true);
  });
});

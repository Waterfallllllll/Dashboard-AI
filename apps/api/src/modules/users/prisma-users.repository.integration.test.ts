import { afterAll, describe, expect, it } from "vitest";

import { disconnectPrisma, getPrismaClient } from "../../infrastructure/db/prisma-client.js";
import { newEntityId } from "../../shared/public-id.js";
import { PrismaUsersRepository } from "./prisma-users.repository.js";

const databaseUrl = process.env.DATABASE_URL ?? "";
const hasPostgres =
  databaseUrl.startsWith("postgresql://") || databaseUrl.startsWith("postgres://");

describe.skipIf(!hasPostgres)("репозиторий пользователя через Prisma", () => {
  const userId = newEntityId();
  const now = new Date("2026-11-15T12:00:00.000Z");

  afterAll(async () => {
    const prisma = getPrismaClient();
    await prisma.user.deleteMany({ where: { id: userId } });
    await disconnectPrisma();
  });

  it("создаёт, читает и помечает удалённым только своего пользователя", async () => {
    const prisma = getPrismaClient();
    const users = new PrismaUsersRepository(prisma);

    await prisma.user.create({
      data: {
        id: userId,
        displayName: "Проверка",
        locale: "ru",
        timezone: "Europe/Moscow",
        timeFormat: "hour24",
        theme: "system",
        createdAt: now,
        updatedAt: now
      }
    });

    const found = await users.findActive(userId);
    expect(found?.displayName).toBe("Проверка");
    expect(await users.findActive("a".repeat(24))).toBeNull();

    const renamed = await users.update(userId, { displayName: "Новое имя" }, now);
    expect(renamed?.displayName).toBe("Новое имя");
    expect(await users.softDelete(userId, now)).toBe("deleted");
    expect(await users.findActive(userId)).toBeNull();
    expect(await users.softDelete(userId, now)).toBe("already-deleted");
  });
});

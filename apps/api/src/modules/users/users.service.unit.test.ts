import { describe, expect, it } from "vitest";

import { API_ERROR_CODES } from "@dashboard/contracts";

import { createMemoryDatabase, MemoryUsersRepository } from "../auth/memory-auth.repository.js";
import type { UsersRepository } from "./users.repository.js";
import { UsersService } from "./users.service.js";
import type { UserProfile } from "./user-profile.js";

const now = new Date("2026-11-11T12:00:00.000Z");

function profile(id: string, displayName: string): UserProfile {
  return {
    id,
    displayName,
    avatarUrl: null,
    locale: "ru",
    timezone: "Europe/Moscow",
    timeFormat: "24",
    theme: "system",
    createdAt: now,
    updatedAt: now
  };
}

describe("доступ к профилю", () => {
  it("не отдаёт чужой профиль, даже если хранилище ошиблось", async () => {
    const owner = "a".repeat(24);
    const other = profile("b".repeat(24), "Чужой");
    const repository: UsersRepository = {
      async findActive() {
        return other;
      },
      async update() {
        return other;
      },
      async softDelete() {
        return "deleted";
      },
      async restore() {
        return undefined;
      },
      async readWeatherLocation() {
        return null;
      },
      async writeWeatherLocation() {
        return true;
      },
      async readNotificationSettings() {
        return null;
      },
      async writeNotificationSettings() {
        return null;
      }
    };
    const service = new UsersService(repository, async () => undefined);

    await expect(service.getProfile({ userId: owner, sessionId: "session" })).rejects.toMatchObject(
      {
        code: API_ERROR_CODES.notFound
      }
    );
  });

  it("возвращает аккаунт, если физическая очистка не удалась", async () => {
    const database = createMemoryDatabase();
    const id = "c".repeat(24);
    database.users.set(id, { ...profile(id, "Илья"), deletedAt: null });
    const service = new UsersService(new MemoryUsersRepository(database), async () => {
      throw new Error("purge failed");
    });

    await expect(service.deleteAccount({ userId: id, sessionId: "session" })).rejects.toMatchObject(
      {
        code: API_ERROR_CODES.unavailable
      }
    );
    expect(database.users.get(id)?.deletedAt).toBeNull();
  });
});

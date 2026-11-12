import { describe, expect, it } from "vitest";

import { auditDeleteAt } from "../../infrastructure/mongodb/retention.js";
import { MemoryAuditRepository } from "./audit.repository.js";
import { AuditService } from "./audit.service.js";

const now = new Date("2026-11-12T10:00:00.000Z");
const userId = "a".repeat(24);

describe("журнал аудита", () => {
  it("пишет вход, выход и привязку без секретов и забывает пользователя при удалении", async () => {
    const repository = new MemoryAuditRepository();
    const audit = new AuditService(repository, () => now);

    await audit.record({ userId, action: "login", target: "google" });
    await audit.record({ userId, action: "logout", target: null });
    await audit.record({
      userId,
      action: "integration_connected",
      target: "google_calendar"
    });
    await audit.record({ userId: null, action: "account_deleted", target: null });
    await audit.forgetUser(userId);

    expect(repository.records).toEqual([
      {
        userId: null,
        action: "account_deleted",
        target: null,
        createdAt: now,
        deleteAt: auditDeleteAt(now)
      }
    ]);
    expect(JSON.stringify(repository.records)).not.toMatch(/ya29|refresh|token|secret/i);
  });

  it("отклоняет произвольный идентификатор, чужую цель и удаление с пользователем", async () => {
    const audit = new AuditService(new MemoryAuditRepository(), () => now);

    await expect(
      audit.record({ userId: "not-an-id", action: "login", target: "google" })
    ).rejects.toThrow(/идентификатор/);
    await expect(audit.record({ userId, action: "login", target: "telegram" })).rejects.toThrow(
      /Google/
    );
    await expect(audit.record({ userId, action: "account_deleted", target: null })).rejects.toThrow(
      /без идентификатора/
    );
    await expect(audit.record({ userId, action: "logout", target: "google" })).rejects.toThrow(
      /без цели/
    );
    await expect(audit.forgetUser("short")).rejects.toThrow(/идентификатор/);
  });
});

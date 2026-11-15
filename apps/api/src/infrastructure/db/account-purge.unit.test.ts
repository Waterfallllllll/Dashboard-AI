import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  ACCOUNT_PURGE_TABLES,
  AccountStillActiveError,
  assertAccountPurgeAllowed,
  assertPurgeUserId
} from "./account-purge.js";

describe("очистка аккаунта", () => {
  it("удаляет только мягко удалённый UUID и не трогает общий кэш", () => {
    expect(assertAccountPurgeAllowed(null)).toBe("missing");
    expect(assertAccountPurgeAllowed({ deletedAt: new Date("2026-11-15T12:00:00.000Z") })).toBe(
      "soft-deleted"
    );
    expect(() => assertAccountPurgeAllowed({ deletedAt: null })).toThrow(AccountStillActiveError);
    expect(() => assertAccountPurgeAllowed({ deletedAt: new Date(Number.NaN) })).toThrow(
      AccountStillActiveError
    );
    expect(() => assertPurgeUserId("не-uuid")).toThrow(/UUID/);
    expect(() => assertPurgeUserId(randomUUID())).not.toThrow();
    expect(ACCOUNT_PURGE_TABLES).toContain("timer_sessions");
    expect(ACCOUNT_PURGE_TABLES).toContain("scheduled_jobs");
    expect(ACCOUNT_PURGE_TABLES).not.toContain("news_items");
    expect(ACCOUNT_PURGE_TABLES).not.toContain("one_time_tokens");
  });
});

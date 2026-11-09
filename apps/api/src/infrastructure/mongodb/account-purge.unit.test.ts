import type { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import {
  AccountStillActiveError,
  assertAccountPurgeAllowed,
  assertPurgeUserId
} from "./account-purge.js";

describe("допуск к очистке аккаунта", () => {
  it("требует ObjectId и мягко удалённый аккаунт", () => {
    expect(() => assertPurgeUserId({ toHexString: () => "x" } as ObjectId)).toThrow(/ObjectId/);
    expect(() => assertAccountPurgeAllowed({ deletedAt: null })).toThrow(AccountStillActiveError);
    expect(() => assertAccountPurgeAllowed({ deletedAt: new Date(Number.NaN) })).toThrow(
      AccountStillActiveError
    );
    expect(assertAccountPurgeAllowed(null)).toBe("missing");
    expect(assertAccountPurgeAllowed({ deletedAt: new Date("2026-11-09T12:00:00.000Z") })).toBe(
      "soft-deleted"
    );
  });
});

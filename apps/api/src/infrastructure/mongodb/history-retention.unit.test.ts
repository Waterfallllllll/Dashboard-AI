import { describe, expect, it } from "vitest";

import { INDEX_DEFINITIONS } from "./index-catalog.js";
import {
  assertHistoryRetention,
  deliveryRetentionViolation,
  notificationDeleteAt
} from "./retention.js";

describe("сроки хранения истории", () => {
  it("хранит таймер и рутины до очистки аккаунта, а журнал доставки — 30 дней", () => {
    expect(() => assertHistoryRetention()).not.toThrow();
    const createdAt = new Date("2026-11-09T12:00:00.000Z");

    expect(deliveryRetentionViolation(createdAt, notificationDeleteAt(createdAt))).toBeNull();
    expect(deliveryRetentionViolation(createdAt, null)).toBe("DELIVERY_WITHOUT_EXPIRY");
    expect(deliveryRetentionViolation(createdAt, createdAt)).toBe("DELIVERY_EXPIRY_OUT_OF_POLICY");
    expect(deliveryRetentionViolation(new Date(Number.NaN), createdAt)).toBe(
      "DELIVERY_EXPIRY_OUT_OF_POLICY"
    );
  });

  it("не позволяет снять TTL сессий или поставить TTL на историю таймера", () => {
    expect(() =>
      assertHistoryRetention(
        INDEX_DEFINITIONS.filter((index) => index.name !== "sessions_expires_at")
      )
    ).toThrow(/sessions/);
    expect(() =>
      assertHistoryRetention([
        ...INDEX_DEFINITIONS,
        {
          collection: "timer_sessions",
          name: "timer_sessions_ttl",
          kind: "ttl",
          key: { startedAt: 1 },
          expireAfterSeconds: 0
        }
      ])
    ).toThrow(/timer_sessions/);
  });
});

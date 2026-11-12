import { describe, expect, it } from "vitest";

import { renewCalendarWatches, watchExpiresSoon } from "./calendar-watch.js";

describe("обновление канала календаря", () => {
  it("без публичного адреса ничего не вызывает", async () => {
    let calls = 0;
    const renewed = await renewCalendarWatches({
      webhookUrl: null,
      webhookToken: null,
      now: new Date("2026-11-12T10:00:00.000Z"),
      targets: [],
      gateway: {
        watch: async () => {
          calls += 1;
          return { channelId: "a", resourceId: "b", expiresAt: new Date() };
        },
        stop: async () => undefined
      },
      save: async () => undefined,
      markRevoked: async () => undefined
    });
    expect(renewed).toBe(0);
    expect(calls).toBe(0);
    expect(watchExpiresSoon(null, new Date())).toBe(true);
  });
});

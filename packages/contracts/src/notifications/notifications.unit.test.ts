import { describe, expect, it } from "vitest";

import { parseDto } from "../common/api-error.js";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  notificationPreferencesSchema,
  pushSubscriptionCreateSchema
} from "./notifications.js";

describe("контракт уведомлений", () => {
  it("принимает настройки каналов и отвергает неполные тихие часы", () => {
    expect(parseDto(notificationPreferencesSchema, DEFAULT_NOTIFICATION_PREFERENCES).ok).toBe(true);
    expect(
      parseDto(notificationPreferencesSchema, {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        quietStart: "22:00",
        quietEnd: null
      }).ok
    ).toBe(false);
    expect(
      parseDto(notificationPreferencesSchema, {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        extra: true
      }).ok
    ).toBe(false);
  });

  it("не принимает push-подписку без https и ключей", () => {
    expect(
      parseDto(pushSubscriptionCreateSchema, {
        endpoint: "https://push.example.com/device",
        keys: { p256dh: "a".repeat(32), auth: "b".repeat(16) }
      }).ok
    ).toBe(true);
    expect(
      parseDto(pushSubscriptionCreateSchema, {
        endpoint: "http://127.0.0.1/push",
        keys: { p256dh: "a".repeat(32), auth: "b".repeat(16) }
      }).ok
    ).toBe(false);
  });
});

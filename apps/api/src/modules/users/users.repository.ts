import type { NotificationPreferences } from "@dashboard/contracts";

import type { ProfileUpdate, UserProfile } from "./user-profile.js";

export type StoredWeatherLocation = {
  readonly latitude: number;
  readonly longitude: number;
  readonly label: string;
};

export type UsersRepository = {
  findActive(userId: string): Promise<UserProfile | null>;
  update(userId: string, patch: ProfileUpdate, now: Date): Promise<UserProfile | null>;
  readWeatherLocation(userId: string): Promise<StoredWeatherLocation | null>;
  writeWeatherLocation(
    userId: string,
    location: StoredWeatherLocation | null,
    now: Date
  ): Promise<boolean>;
  readNotificationSettings(
    userId: string
  ): Promise<{ preferences: NotificationPreferences; timezone: string } | null>;
  writeNotificationSettings(
    userId: string,
    preferences: NotificationPreferences,
    now: Date
  ): Promise<NotificationPreferences | null>;
  softDelete(userId: string, now: Date): Promise<"deleted" | "already-deleted" | "missing">;
  restore(userId: string, now: Date): Promise<void>;
};

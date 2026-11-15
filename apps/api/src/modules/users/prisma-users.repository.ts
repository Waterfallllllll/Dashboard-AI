import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  notificationPreferencesSchema,
  type NotificationPreferences
} from "@dashboard/contracts";

import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { fromTimeFormat, toTimeFormat } from "../../infrastructure/db/enum-map.js";
import { parseUuid } from "../../shared/public-id.js";
import type { ProfileUpdate, UserProfile } from "./user-profile.js";
import type { StoredWeatherLocation, UsersRepository } from "./users.repository.js";

type UserRow = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  locale: string;
  timezone: string;
  timeFormat: "hour12" | "hour24";
  theme: UserProfile["theme"];
  createdAt: Date;
  updatedAt: Date;
  weatherLatitude?: { toString(): string } | null;
  weatherLongitude?: { toString(): string } | null;
  weatherLabel?: string | null;
  notificationSettings?: Prisma.JsonValue;
};

export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findActive(userId: string): Promise<UserProfile | null> {
    const id = parseUuid(userId);

    if (!id) {
      return null;
    }

    const row = await this.prisma.user.findFirst({
      where: { id, deletedAt: null }
    });
    return row ? toProfile(row) : null;
  }

  async update(userId: string, patch: ProfileUpdate, now: Date): Promise<UserProfile | null> {
    const id = parseUuid(userId);

    if (!id) {
      return null;
    }

    const updated = await this.prisma.user.updateMany({
      where: { id, deletedAt: null },
      data: profileData(patch, now)
    });

    if (updated.count !== 1) {
      return null;
    }

    return this.findActive(id);
  }

  async softDelete(userId: string, now: Date): Promise<"deleted" | "already-deleted" | "missing"> {
    const id = parseUuid(userId);

    if (!id) {
      return "missing";
    }

    const updated = await this.prisma.user.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: now, updatedAt: now }
    });

    if (updated.count === 1) {
      return "deleted";
    }

    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true }
    });
    return existing ? "already-deleted" : "missing";
  }

  async restore(userId: string, now: Date): Promise<void> {
    const id = parseUuid(userId);

    if (!id) {
      return;
    }

    await this.prisma.user.updateMany({
      where: { id },
      data: { deletedAt: null, updatedAt: now }
    });
  }

  async readWeatherLocation(userId: string): Promise<StoredWeatherLocation | null> {
    const id = parseUuid(userId);

    if (!id) {
      return null;
    }

    const row = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { weatherLatitude: true, weatherLongitude: true, weatherLabel: true }
    });

    if (!row?.weatherLatitude || !row.weatherLongitude || !row.weatherLabel) {
      return null;
    }

    const latitude = readCoordinate(row.weatherLatitude);
    const longitude = readCoordinate(row.weatherLongitude);

    if (latitude === null || longitude === null) {
      return null;
    }

    return { latitude, longitude, label: row.weatherLabel };
  }

  async writeWeatherLocation(
    userId: string,
    location: StoredWeatherLocation | null,
    now: Date
  ): Promise<boolean> {
    const id = parseUuid(userId);

    if (!id) {
      return false;
    }

    const updated = await this.prisma.user.updateMany({
      where: { id, deletedAt: null },
      data: {
        weatherLatitude: location?.latitude ?? null,
        weatherLongitude: location?.longitude ?? null,
        weatherLabel: location?.label ?? null,
        updatedAt: now
      }
    });
    return updated.count === 1;
  }

  async readNotificationSettings(
    userId: string
  ): Promise<{ preferences: NotificationPreferences; timezone: string } | null> {
    const id = parseUuid(userId);

    if (!id) {
      return null;
    }

    const row = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { notificationSettings: true, timezone: true }
    });

    if (!row) {
      return null;
    }

    const parsed = notificationPreferencesSchema.safeParse(row.notificationSettings);
    return {
      preferences: parsed.success ? parsed.data : DEFAULT_NOTIFICATION_PREFERENCES,
      timezone: row.timezone
    };
  }

  async writeNotificationSettings(
    userId: string,
    preferences: NotificationPreferences,
    now: Date
  ): Promise<NotificationPreferences | null> {
    const id = parseUuid(userId);

    if (!id) {
      return null;
    }

    const updated = await this.prisma.user.updateMany({
      where: { id, deletedAt: null },
      data: {
        notificationSettings: preferences,
        updatedAt: now
      }
    });
    return updated.count === 1 ? preferences : null;
  }
}

function toProfile(row: UserRow): UserProfile {
  return {
    id: row.id,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    locale: row.locale,
    timezone: row.timezone,
    timeFormat: fromTimeFormat(row.timeFormat),
    theme: row.theme,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function profileData(patch: ProfileUpdate, now: Date): Prisma.UserUpdateManyMutationInput {
  const data: Prisma.UserUpdateManyMutationInput = { updatedAt: now };

  if (patch.displayName !== undefined) {
    data.displayName = patch.displayName;
  }

  if (patch.locale !== undefined) {
    data.locale = patch.locale;
  }

  if (patch.timezone !== undefined) {
    data.timezone = patch.timezone;
  }

  if (patch.timeFormat !== undefined) {
    data.timeFormat = toTimeFormat(patch.timeFormat);
  }

  if (patch.theme !== undefined) {
    data.theme = patch.theme;
  }

  return data;
}

function readCoordinate(value: { toString(): string }): number | null {
  const number = Number(value.toString());
  return Number.isFinite(number) ? number : null;
}

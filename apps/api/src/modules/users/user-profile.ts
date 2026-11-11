import type { Profile, ThemePreference, TimeFormat } from "@dashboard/contracts";

import type { UserDocument } from "../../infrastructure/mongodb/collection-catalog.js";
import {
  DEFAULT_DISPLAY_NAME,
  DEFAULT_LOCALE,
  DEFAULT_THEME,
  DEFAULT_TIME_FORMAT,
  DEFAULT_TIME_ZONE
} from "../../config/constants.js";

export type UserProfile = {
  readonly id: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly locale: string;
  readonly timezone: string;
  readonly timeFormat: TimeFormat;
  readonly theme: ThemePreference;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type ProfileUpdate = {
  readonly displayName?: string;
  readonly locale?: string;
  readonly timezone?: string;
  readonly timeFormat?: TimeFormat;
  readonly theme?: ThemePreference;
};

export const NEW_USER_DEFAULTS = {
  displayName: DEFAULT_DISPLAY_NAME,
  locale: DEFAULT_LOCALE,
  timezone: DEFAULT_TIME_ZONE,
  timeFormat: DEFAULT_TIME_FORMAT,
  theme: DEFAULT_THEME
} as const;

export function toUserProfile(document: UserDocument): UserProfile {
  return {
    id: document._id.toHexString(),
    displayName: document.displayName,
    avatarUrl: document.avatarUrl,
    locale: document.locale,
    timezone: document.timezone,
    timeFormat: document.timeFormat,
    theme: document.theme,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt
  };
}

export function profileDto(user: UserProfile): Profile {
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    locale: user.locale,
    timezone: user.timezone,
    timeFormat: user.timeFormat,
    theme: user.theme,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}

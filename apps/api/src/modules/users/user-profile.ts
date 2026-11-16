import type { Profile, ThemePreference, TimeFormat } from "@dashboard/contracts";

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

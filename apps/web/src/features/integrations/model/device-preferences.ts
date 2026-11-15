import type { NotificationPreferences as ApiNotificationPreferences } from "@dashboard/contracts";

import type { NotificationPreferences } from "@/features/notifications";

export function devicePreferencesFromApi(
  preferences: ApiNotificationPreferences
): NotificationPreferences {
  return {
    workComplete: preferences.work.browser,
    breakComplete: preferences.break.browser,
    routineReminder: preferences.routine.browser,
    calendarReminder: preferences.calendar.browser,
    quietStart: preferences.quietStart,
    quietEnd: preferences.quietEnd
  };
}

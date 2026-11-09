export const DEFAULT_NOTIFICATION_RETENTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RETENTION_DAYS = 3650;

export function notificationDeleteAt(
  createdAt: Date,
  retentionDays = DEFAULT_NOTIFICATION_RETENTION_DAYS
): Date {
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > MAX_RETENTION_DAYS) {
    throw new Error("Срок хранения уведомлений должен быть целым числом дней от 1 до 3650");
  }

  const createdAtMs = createdAt.getTime();

  if (Number.isNaN(createdAtMs)) {
    throw new Error("Некорректная дата создания уведомления");
  }

  return new Date(createdAtMs + retentionDays * DAY_MS);
}

import { INDEX_DEFINITIONS, type IndexDefinition } from "./index-catalog.js";

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

export type DeliveryRetentionCode = "DELIVERY_WITHOUT_EXPIRY" | "DELIVERY_EXPIRY_OUT_OF_POLICY";

export const HISTORY_POLICIES = [
  { collection: "sessions", mode: "ttl-field", field: "expiresAt" },
  { collection: "one_time_tokens", mode: "ttl-field", field: "expiresAt" },
  {
    collection: "notification_deliveries",
    mode: "ttl-days",
    field: "deleteAt",
    days: DEFAULT_NOTIFICATION_RETENTION_DAYS
  },
  { collection: "scheduled_jobs", mode: "ttl-field", field: "deleteAt" },
  { collection: "calendar_events", mode: "until-account-purge" },
  { collection: "timer_sessions", mode: "until-account-purge" },
  { collection: "routine_occurrences", mode: "until-account-purge" },
  { collection: "routine_rules", mode: "until-account-purge" }
] as const;

export type HistoryPolicy = (typeof HISTORY_POLICIES)[number];

export function deliveryRetentionViolation(
  createdAt: Date,
  deleteAt: Date | null
): DeliveryRetentionCode | null {
  if (!(createdAt instanceof Date) || Number.isNaN(createdAt.getTime())) {
    return "DELIVERY_EXPIRY_OUT_OF_POLICY";
  }

  if (!(deleteAt instanceof Date) || Number.isNaN(deleteAt.getTime())) {
    return "DELIVERY_WITHOUT_EXPIRY";
  }

  if (deleteAt.getTime() !== notificationDeleteAt(createdAt).getTime()) {
    return "DELIVERY_EXPIRY_OUT_OF_POLICY";
  }

  return null;
}

export function assertHistoryRetention(
  indexes: readonly IndexDefinition[] = INDEX_DEFINITIONS
): void {
  const ttlByCollection = new Map<string, string>();

  for (const index of indexes) {
    if (index.kind !== "ttl") {
      continue;
    }

    const [field] = Object.keys(index.key);

    if (field === undefined) {
      throw new Error(`TTL-индекс ${index.name} не содержит поле`);
    }

    if (ttlByCollection.has(index.collection)) {
      throw new Error(`У коллекции ${index.collection} больше одного TTL`);
    }

    ttlByCollection.set(index.collection, field);
  }

  for (const policy of HISTORY_POLICIES) {
    const ttlField = ttlByCollection.get(policy.collection);

    if (policy.mode === "until-account-purge") {
      if (ttlField !== undefined) {
        throw new Error(`${policy.collection} хранится до очистки аккаунта и не должен иметь TTL`);
      }

      continue;
    }

    if (ttlField !== policy.field) {
      throw new Error(`Для ${policy.collection} нужен TTL по полю ${policy.field}`);
    }
  }

  for (const [collection, field] of ttlByCollection) {
    const policy = HISTORY_POLICIES.find((item) => item.collection === collection);

    if (!policy || policy.mode === "until-account-purge") {
      throw new Error(`TTL ${collection}.${field} не описан политикой хранения`);
    }
  }
}

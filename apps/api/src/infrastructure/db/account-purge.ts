import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

import { auditDeleteAt } from "./retention.js";

const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const ACCOUNT_PURGE_TABLES = [
  "auth_accounts",
  "sessions",
  "widget_preferences",
  "routine_rules",
  "routine_occurrences",
  "timer_presets",
  "timer_sessions",
  "integrations",
  "calendar_events",
  "push_subscriptions",
  "scheduled_jobs",
  "notification_deliveries",
  "audit_events"
] as const;

export type PurgeTable = (typeof ACCOUNT_PURGE_TABLES)[number];

export type PurgeDeletedCounts = Record<PurgeTable | "users", number>;

export type PurgeResult = {
  readonly user: "purged" | "missing";
  readonly deleted: PurgeDeletedCounts;
  readonly auditEventId: string | null;
};

export class AccountStillActiveError extends Error {
  readonly code = "ACCOUNT_STILL_ACTIVE" as const;

  constructor() {
    super("Активный аккаунт не удаляется физически. Сначала нужно мягкое удаление.");
    this.name = "AccountStillActiveError";
  }
}

export function assertPurgeUserId(userId: string): void {
  if (!USER_ID.test(userId)) {
    throw new Error("Очистка аккаунта принимает только UUID");
  }
}

export function assertAccountPurgeAllowed(
  user: { readonly deletedAt: Date | null } | null
): "soft-deleted" | "missing" {
  if (!user) {
    return "missing";
  }

  if (!(user.deletedAt instanceof Date) || Number.isNaN(user.deletedAt.getTime())) {
    throw new AccountStillActiveError();
  }

  return "soft-deleted";
}

export async function purgeAccount(prisma: PrismaClient, userId: string): Promise<PurgeResult> {
  assertPurgeUserId(userId);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { deletedAt: true }
    });
    const state = assertAccountPurgeAllowed(user);

    if (state === "missing") {
      return { user: "missing", deleted: emptyDeleted(), auditEventId: null };
    }

    const deleted = await countOwned(tx, userId);
    const removed = await tx.user.deleteMany({
      where: { id: userId, deletedAt: { not: null } }
    });

    if (removed.count !== 1) {
      throw new Error("Строка аккаунта изменилась во время очистки");
    }

    const createdAt = new Date();
    const tombstone = await tx.auditEvent.create({
      data: {
        action: "account_deleted",
        userId: null,
        createdAt,
        deleteAt: auditDeleteAt(createdAt)
      },
      select: { id: true }
    });

    return {
      user: "purged",
      deleted: { ...deleted, users: 1 },
      auditEventId: tombstone.id
    };
  });
}

async function countOwned(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<PurgeDeletedCounts> {
  const where = { userId };
  const [
    authAccounts,
    sessions,
    widgetPreferences,
    routineRules,
    routineOccurrences,
    timerPresets,
    timerSessions,
    integrations,
    calendarEvents,
    pushSubscriptions,
    scheduledJobs,
    notificationDeliveries,
    auditEvents
  ] = await Promise.all([
    tx.authAccount.count({ where }),
    tx.session.count({ where }),
    tx.widgetPreference.count({ where }),
    tx.routineRule.count({ where }),
    tx.routineOccurrence.count({ where }),
    tx.timerPreset.count({ where }),
    tx.timerSession.count({ where }),
    tx.integration.count({ where }),
    tx.calendarEvent.count({ where }),
    tx.pushSubscription.count({ where }),
    tx.scheduledJob.count({ where }),
    tx.notificationDelivery.count({ where }),
    tx.auditEvent.count({ where })
  ]);

  return {
    users: 0,
    auth_accounts: authAccounts,
    sessions,
    widget_preferences: widgetPreferences,
    routine_rules: routineRules,
    routine_occurrences: routineOccurrences,
    timer_presets: timerPresets,
    timer_sessions: timerSessions,
    integrations,
    calendar_events: calendarEvents,
    push_subscriptions: pushSubscriptions,
    scheduled_jobs: scheduledJobs,
    notification_deliveries: notificationDeliveries,
    audit_events: auditEvents
  };
}

function emptyDeleted(): PurgeDeletedCounts {
  return {
    users: 0,
    auth_accounts: 0,
    sessions: 0,
    widget_preferences: 0,
    routine_rules: 0,
    routine_occurrences: 0,
    timer_presets: 0,
    timer_sessions: 0,
    integrations: 0,
    calendar_events: 0,
    push_subscriptions: 0,
    scheduled_jobs: 0,
    notification_deliveries: 0,
    audit_events: 0
  };
}

import type { ObjectId } from "mongodb";

const objectId = { bsonType: "objectId" } as const;
const date = { bsonType: "date" } as const;
const dateOrNull = { bsonType: ["date", "null"] } as const;
const schemaVersion = { bsonType: "number", enum: [1] } as const;
const localDate = { bsonType: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" } as const;

function nullableString(maxLength: number, pattern?: string): JsonSchema {
  const textSchema: JsonSchema = { bsonType: "string", maxLength };
  return {
    anyOf: [pattern ? { ...textSchema, pattern } : textSchema, { bsonType: "null" }]
  };
}

export const COLLECTION_NAMES = [
  "users",
  "auth_accounts",
  "sessions",
  "one_time_tokens",
  "dashboard_configs",
  "routine_rules",
  "routine_occurrences",
  "timer_sessions",
  "integrations",
  "calendar_events",
  "news_items",
  "push_subscriptions",
  "notification_deliveries",
  "scheduled_jobs"
] as const;

export type CollectionName = (typeof COLLECTION_NAMES)[number];

export type JsonSchema = {
  readonly bsonType?:
    | "object"
    | "array"
    | "string"
    | "number"
    | "bool"
    | "date"
    | "objectId"
    | "null"
    | readonly string[];
  readonly additionalProperties?: boolean;
  readonly required?: readonly string[];
  readonly properties?: Readonly<Record<string, JsonSchema>>;
  readonly items?: JsonSchema;
  readonly enum?: readonly (string | number | boolean | null)[];
  readonly pattern?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly uniqueItems?: boolean;
  readonly maxProperties?: number;
  readonly description?: string;
  readonly anyOf?: readonly JsonSchema[];
};

export type CollectionDefinition = {
  readonly name: CollectionName;
  readonly schema: JsonSchema;
};

export type UserDocument = {
  _id: ObjectId;
  schemaVersion: 1;
  displayName: string;
  avatarUrl: string | null;
  locale: string;
  timezone: string;
  timeFormat: "12" | "24";
  theme: "system" | "light" | "dark";
  weatherLocation?: {
    latitude: number;
    longitude: number;
    label: string;
  } | null;
  notificationSettings?: NotificationSettingsDocument | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type AuthAccountDocument = {
  _id: ObjectId;
  schemaVersion: 1;
  userId: ObjectId;
  provider: "google" | "telegram";
  providerUserId: string;
  encryptedAccessToken: string | null;
  encryptedRefreshToken: string | null;
  scope: readonly string[];
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SessionDocument = {
  _id: ObjectId;
  schemaVersion: 1;
  userId: ObjectId;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
};

export type OneTimeTokenDocument = {
  _id: ObjectId;
  schemaVersion: 1;
  tokenHash: string;
  purpose: "oauth_state" | "calendar_oauth" | "telegram_link";
  encryptedPayload: string;
  expiresAt: Date;
  createdAt: Date;
  consumedAt: Date | null;
};

export type WidgetPreferenceDocument = {
  widgetType: "datetime" | "weather" | "calendar" | "routines" | "timer" | "news";
  enabled: boolean;
  position: number;
  size: "compact" | "standard" | "wide" | "full";
  settings: Readonly<Record<string, unknown>>;
  version: number;
  updatedAt: Date;
};

export type DashboardConfigDocument = {
  _id: ObjectId;
  schemaVersion: 1;
  userId: ObjectId;
  widgets: readonly WidgetPreferenceDocument[];
  updatedAt: Date;
};

export type RoutineRuleDocument = {
  _id: ObjectId;
  schemaVersion: 1;
  userId: ObjectId;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  recurrenceRule: {
    kind: "daily" | "weekdays" | "weekly" | "once";
    days: readonly number[];
  };
  reminderLocalTime: string | null;
  timezone: string;
  status: "active" | "paused" | "ended";
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type RoutineOccurrenceDocument = {
  _id: ObjectId;
  schemaVersion: 1;
  userId: ObjectId;
  routineRuleId: ObjectId;
  localDate: string;
  titleOverride: string | null;
  status: "pending" | "done" | "hidden";
  completedAt: Date | null;
  excludedAt: Date | null;
};

export type TimerSessionDocument = {
  _id: ObjectId;
  schemaVersion: 1;
  userId: ObjectId;
  preset: {
    mode: "pomodoro" | "custom" | "manual";
    workMinutes: number;
    shortBreakMinutes: number;
    longBreakMinutes: number;
  };
  runStatus: "idle" | "running" | "paused";
  phase: "work" | "short-break" | "long-break";
  startedAt: Date | null;
  pausedAt: Date | null;
  endsAt: Date | null;
  completedAt: Date | null;
  cycleNumber: number;
  version: number;
};

export type IntegrationDocument = {
  _id: ObjectId;
  schemaVersion: 1;
  userId: ObjectId;
  type: "google_calendar" | "telegram";
  status: "disconnected" | "connected" | "revoked";
  encryptedCredentials: string | null;
  scope: readonly string[];
  externalUserId: string | null;
  lastSyncAt: Date | null;
  syncCursor: string | null;
  watchChannelId?: string | null;
  watchResourceId?: string | null;
  watchExpiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type CalendarEventDocument = {
  _id: ObjectId;
  schemaVersion: 1;
  userId: ObjectId;
  integrationId: ObjectId;
  externalEventId: string;
  calendarName: string;
  title: string;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  location: string | null;
  meetingUrl: string | null;
  htmlLink: string;
  status: "confirmed" | "tentative";
  updatedAt: Date;
};

export type NewsItemDocument = {
  _id: ObjectId;
  schemaVersion: 1;
  source: string;
  title: string;
  excerpt: string;
  canonicalUrl: string;
  contentHash: string;
  publishedAt: Date;
  language: string;
  topics: readonly string[];
  imageUrl: string | null;
  createdAt: Date;
};

export type PushSubscriptionDocument = {
  _id: ObjectId;
  schemaVersion: 1;
  userId: ObjectId;
  endpointHash: string;
  endpoint: string;
  encryptedKeys: string;
  createdAt: Date;
  revokedAt: Date | null;
};

export type NotificationSettingsDocument = {
  work: { browser: boolean; telegram: boolean };
  break: { browser: boolean; telegram: boolean };
  routine: { browser: boolean; telegram: boolean };
  calendar: { browser: boolean; telegram: boolean };
  quietStart: string | null;
  quietEnd: string | null;
};

export type NotificationDeliveryDocument = {
  _id: ObjectId;
  schemaVersion: 1;
  userId: ObjectId;
  eventType: "work" | "break" | "routine" | "calendar";
  channel: "browser" | "telegram" | "in_app";
  idempotencyKey: string;
  status: "pending" | "sent" | "failed" | "skipped";
  attempts: number;
  providerMessageId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deleteAt: Date | null;
};

export type ScheduledJobDocument = {
  _id: ObjectId;
  schemaVersion: 1;
  type:
    | "timer-due"
    | "deliver-notification"
    | "refresh-news"
    | "sync-calendar"
    | "scan-due-timers"
    | "scan-routine-reminders"
    | "purge-revoked-push"
    | "renew-calendar-watch"
    | "scheduler-lock"
    | "worker-heartbeat";
  payload: {
    sessionId?: string;
    eventType?: "work" | "break" | "routine" | "calendar";
    channel?: "browser" | "telegram" | "in_app";
    ruleId?: string;
    localDate?: string;
    title?: string;
    channelId?: string;
    phase?: "work" | "short-break" | "long-break";
  };
  runAt: Date;
  status: "pending" | "processing" | "completed" | "failed";
  attempts: number;
  maxAttempts: number;
  idempotencyKey: string;
  lockedBy: string | null;
  lockedAt: Date | null;
  lockExpiresAt: Date | null;
  lastError: string | null;
  userId: ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
  deleteAt: Date | null;
};

const text = (minLength: number, maxLength: number): JsonSchema => ({
  bsonType: "string",
  minLength,
  maxLength
});

const textOrNull = (maxLength: number): JsonSchema => nullableString(maxLength);

function documentSchema(
  required: readonly string[],
  properties: Readonly<Record<string, JsonSchema>>
): JsonSchema {
  return {
    bsonType: "object",
    additionalProperties: false,
    required: ["schemaVersion", ...required],
    properties: {
      _id: objectId,
      schemaVersion,
      ...properties
    }
  };
}

const widgetPreferenceSchema: JsonSchema = {
  bsonType: "object",
  additionalProperties: false,
  required: ["widgetType", "enabled", "position", "size", "settings", "version", "updatedAt"],
  properties: {
    widgetType: {
      bsonType: "string",
      enum: ["datetime", "weather", "calendar", "routines", "timer", "news"]
    },
    enabled: { bsonType: "bool" },
    position: { bsonType: "number", minimum: 0, maximum: 11 },
    size: { bsonType: "string", enum: ["compact", "standard", "wide", "full"] },
    settings: { bsonType: "object", additionalProperties: true, maxProperties: 20 },
    version: { bsonType: "number", minimum: 1, maximum: 1_000_000 },
    updatedAt: date
  }
};

const channelPreferenceSchema: JsonSchema = {
  bsonType: "object",
  additionalProperties: false,
  required: ["browser", "telegram"],
  properties: {
    browser: { bsonType: "bool" },
    telegram: { bsonType: "bool" }
  }
};

const notificationSettingsSchema: JsonSchema = {
  bsonType: "object",
  additionalProperties: false,
  required: ["work", "break", "routine", "calendar", "quietStart", "quietEnd"],
  properties: {
    work: channelPreferenceSchema,
    break: channelPreferenceSchema,
    routine: channelPreferenceSchema,
    calendar: channelPreferenceSchema,
    quietStart: nullableString(5, "^([01]\\d|2[0-3]):[0-5]\\d$"),
    quietEnd: nullableString(5, "^([01]\\d|2[0-3]):[0-5]\\d$")
  }
};

export const COLLECTION_DEFINITIONS: readonly CollectionDefinition[] = [
  {
    name: "users",
    schema: documentSchema(
      [
        "displayName",
        "avatarUrl",
        "locale",
        "timezone",
        "timeFormat",
        "theme",
        "createdAt",
        "updatedAt",
        "deletedAt"
      ],
      {
        displayName: text(1, 120),
        avatarUrl: textOrNull(2048),
        locale: text(2, 35),
        timezone: text(1, 64),
        timeFormat: { bsonType: "string", enum: ["12", "24"] },
        theme: { bsonType: "string", enum: ["system", "light", "dark"] },
        weatherLocation: {
          anyOf: [
            { bsonType: "null" },
            {
              bsonType: "object",
              additionalProperties: false,
              required: ["latitude", "longitude", "label"],
              properties: {
                latitude: { bsonType: "number", minimum: -90, maximum: 90 },
                longitude: { bsonType: "number", minimum: -180, maximum: 180 },
                label: text(1, 80)
              }
            }
          ]
        },
        notificationSettings: {
          anyOf: [{ bsonType: "null" }, notificationSettingsSchema]
        },
        createdAt: date,
        updatedAt: date,
        deletedAt: dateOrNull
      }
    )
  },
  {
    name: "auth_accounts",
    schema: documentSchema(
      [
        "userId",
        "provider",
        "providerUserId",
        "encryptedAccessToken",
        "encryptedRefreshToken",
        "scope",
        "expiresAt",
        "createdAt",
        "updatedAt"
      ],
      {
        userId: objectId,
        provider: { bsonType: "string", enum: ["google", "telegram"] },
        providerUserId: text(1, 128),
        encryptedAccessToken: textOrNull(8192),
        encryptedRefreshToken: textOrNull(8192),
        scope: { bsonType: "array", maxItems: 30, items: text(1, 200) },
        expiresAt: dateOrNull,
        createdAt: date,
        updatedAt: date
      }
    )
  },
  {
    name: "sessions",
    schema: documentSchema(["userId", "tokenHash", "expiresAt", "createdAt", "revokedAt"], {
      userId: objectId,
      tokenHash: text(32, 128),
      expiresAt: date,
      createdAt: date,
      revokedAt: dateOrNull
    })
  },
  {
    name: "one_time_tokens",
    schema: documentSchema(
      ["tokenHash", "purpose", "encryptedPayload", "expiresAt", "createdAt", "consumedAt"],
      {
        tokenHash: {
          bsonType: "string",
          minLength: 64,
          maxLength: 64,
          pattern: "^[a-f0-9]{64}$"
        },
        purpose: {
          bsonType: "string",
          enum: ["oauth_state", "calendar_oauth", "telegram_link"]
        },
        encryptedPayload: text(1, 8192),
        expiresAt: date,
        createdAt: date,
        consumedAt: dateOrNull
      }
    )
  },
  {
    name: "dashboard_configs",
    schema: documentSchema(["userId", "widgets", "updatedAt"], {
      userId: objectId,
      widgets: { bsonType: "array", maxItems: 12, items: widgetPreferenceSchema },
      updatedAt: date
    })
  },
  {
    name: "routine_rules",
    schema: documentSchema(
      [
        "userId",
        "title",
        "description",
        "startDate",
        "endDate",
        "recurrenceRule",
        "reminderLocalTime",
        "timezone",
        "status",
        "createdAt",
        "updatedAt",
        "deletedAt"
      ],
      {
        userId: objectId,
        title: text(1, 120),
        description: textOrNull(500),
        startDate: localDate,
        endDate: nullableString(10, "^\\d{4}-\\d{2}-\\d{2}$"),
        recurrenceRule: {
          bsonType: "object",
          additionalProperties: false,
          required: ["kind", "days"],
          properties: {
            kind: { bsonType: "string", enum: ["daily", "weekdays", "weekly", "once"] },
            days: {
              bsonType: "array",
              maxItems: 7,
              uniqueItems: true,
              items: { bsonType: "number", minimum: 0, maximum: 6 }
            }
          }
        },
        reminderLocalTime: nullableString(5, "^([01]\\d|2[0-3]):[0-5]\\d$"),
        timezone: text(1, 64),
        status: { bsonType: "string", enum: ["active", "paused", "ended"] },
        createdAt: date,
        updatedAt: date,
        deletedAt: dateOrNull
      }
    )
  },
  {
    name: "routine_occurrences",
    schema: documentSchema(
      [
        "userId",
        "routineRuleId",
        "localDate",
        "titleOverride",
        "status",
        "completedAt",
        "excludedAt"
      ],
      {
        userId: objectId,
        routineRuleId: objectId,
        localDate,
        titleOverride: textOrNull(120),
        status: { bsonType: "string", enum: ["pending", "done", "hidden"] },
        completedAt: dateOrNull,
        excludedAt: dateOrNull
      }
    )
  },
  {
    name: "timer_sessions",
    schema: documentSchema(
      [
        "userId",
        "preset",
        "runStatus",
        "phase",
        "startedAt",
        "pausedAt",
        "endsAt",
        "completedAt",
        "cycleNumber",
        "version"
      ],
      {
        userId: objectId,
        preset: {
          bsonType: "object",
          additionalProperties: false,
          required: ["mode", "workMinutes", "shortBreakMinutes", "longBreakMinutes"],
          properties: {
            mode: { bsonType: "string", enum: ["pomodoro", "custom", "manual"] },
            workMinutes: { bsonType: "number", minimum: 1, maximum: 120 },
            shortBreakMinutes: { bsonType: "number", minimum: 1, maximum: 120 },
            longBreakMinutes: { bsonType: "number", minimum: 1, maximum: 120 }
          }
        },
        runStatus: { bsonType: "string", enum: ["idle", "running", "paused"] },
        phase: { bsonType: "string", enum: ["work", "short-break", "long-break"] },
        startedAt: dateOrNull,
        pausedAt: dateOrNull,
        endsAt: dateOrNull,
        completedAt: dateOrNull,
        cycleNumber: { bsonType: "number", minimum: 0, maximum: 10_000 },
        version: { bsonType: "number", minimum: 1, maximum: 1_000_000 }
      }
    )
  },
  {
    name: "integrations",
    schema: documentSchema(
      [
        "userId",
        "type",
        "status",
        "encryptedCredentials",
        "scope",
        "externalUserId",
        "lastSyncAt",
        "syncCursor",
        "createdAt",
        "updatedAt",
        "deletedAt"
      ],
      {
        userId: objectId,
        type: { bsonType: "string", enum: ["google_calendar", "telegram"] },
        status: { bsonType: "string", enum: ["disconnected", "connected", "revoked"] },
        encryptedCredentials: textOrNull(8192),
        scope: { bsonType: "array", maxItems: 30, items: text(1, 200) },
        externalUserId: textOrNull(128),
        lastSyncAt: dateOrNull,
        syncCursor: textOrNull(2048),
        watchChannelId: textOrNull(64),
        watchResourceId: textOrNull(256),
        watchExpiresAt: dateOrNull,
        createdAt: date,
        updatedAt: date,
        deletedAt: dateOrNull
      }
    )
  },
  {
    name: "calendar_events",
    schema: documentSchema(
      [
        "userId",
        "integrationId",
        "externalEventId",
        "calendarName",
        "title",
        "startAt",
        "endAt",
        "allDay",
        "location",
        "meetingUrl",
        "htmlLink",
        "status",
        "updatedAt"
      ],
      {
        userId: objectId,
        integrationId: objectId,
        externalEventId: text(1, 1024),
        calendarName: text(1, 120),
        title: text(1, 300),
        startAt: date,
        endAt: date,
        allDay: { bsonType: "bool" },
        location: textOrNull(300),
        meetingUrl: textOrNull(2048),
        htmlLink: text(1, 2048),
        status: { bsonType: "string", enum: ["confirmed", "tentative"] },
        updatedAt: date
      }
    )
  },
  {
    name: "news_items",
    schema: documentSchema(
      [
        "source",
        "title",
        "excerpt",
        "canonicalUrl",
        "contentHash",
        "publishedAt",
        "language",
        "topics",
        "imageUrl",
        "createdAt"
      ],
      {
        source: text(1, 120),
        title: text(1, 300),
        excerpt: text(0, 500),
        canonicalUrl: text(1, 2048),
        contentHash: text(16, 128),
        publishedAt: date,
        language: text(2, 16),
        topics: { bsonType: "array", maxItems: 12, items: text(1, 40) },
        imageUrl: textOrNull(2048),
        createdAt: date
      }
    )
  },
  {
    name: "push_subscriptions",
    schema: documentSchema(
      ["userId", "endpointHash", "endpoint", "encryptedKeys", "createdAt", "revokedAt"],
      {
        userId: objectId,
        endpointHash: text(32, 128),
        endpoint: text(1, 2048),
        encryptedKeys: text(1, 8192),
        createdAt: date,
        revokedAt: dateOrNull
      }
    )
  },
  {
    name: "notification_deliveries",
    schema: documentSchema(
      [
        "userId",
        "eventType",
        "channel",
        "idempotencyKey",
        "status",
        "attempts",
        "providerMessageId",
        "createdAt",
        "updatedAt",
        "deleteAt"
      ],
      {
        userId: objectId,
        eventType: { bsonType: "string", enum: ["work", "break", "routine", "calendar"] },
        channel: { bsonType: "string", enum: ["browser", "telegram", "in_app"] },
        idempotencyKey: text(8, 200),
        status: { bsonType: "string", enum: ["pending", "sent", "failed", "skipped"] },
        attempts: { bsonType: "number", minimum: 0, maximum: 20 },
        providerMessageId: textOrNull(256),
        createdAt: date,
        updatedAt: date,
        deleteAt: dateOrNull
      }
    )
  },
  {
    name: "scheduled_jobs",
    schema: documentSchema(
      [
        "type",
        "payload",
        "runAt",
        "status",
        "attempts",
        "maxAttempts",
        "idempotencyKey",
        "lockedBy",
        "lockedAt",
        "lockExpiresAt",
        "lastError",
        "userId",
        "createdAt",
        "updatedAt",
        "deleteAt"
      ],
      {
        type: {
          bsonType: "string",
          enum: [
            "timer-due",
            "deliver-notification",
            "refresh-news",
            "sync-calendar",
            "scan-due-timers",
            "scan-routine-reminders",
            "purge-revoked-push",
            "renew-calendar-watch",
            "scheduler-lock",
            "worker-heartbeat"
          ]
        },
        payload: {
          bsonType: "object",
          additionalProperties: false,
          maxProperties: 8,
          properties: {
            sessionId: text(24, 24),
            eventType: { bsonType: "string", enum: ["work", "break", "routine", "calendar"] },
            channel: { bsonType: "string", enum: ["browser", "telegram", "in_app"] },
            ruleId: text(24, 24),
            localDate,
            title: text(1, 120),
            channelId: text(1, 128),
            phase: { bsonType: "string", enum: ["work", "short-break", "long-break"] }
          }
        },
        runAt: date,
        status: { bsonType: "string", enum: ["pending", "processing", "completed", "failed"] },
        attempts: { bsonType: "number", minimum: 0, maximum: 20 },
        maxAttempts: { bsonType: "number", minimum: 1, maximum: 10 },
        idempotencyKey: {
          bsonType: "string",
          minLength: 8,
          maxLength: 200,
          pattern: "^[A-Za-z0-9:_-]+$"
        },
        lockedBy: textOrNull(64),
        lockedAt: dateOrNull,
        lockExpiresAt: dateOrNull,
        lastError: {
          anyOf: [
            { bsonType: "null" },
            { bsonType: "string", minLength: 1, maxLength: 40, pattern: "^[a-z0-9-]+$" }
          ]
        },
        userId: { bsonType: ["objectId", "null"] },
        createdAt: date,
        updatedAt: date,
        deleteAt: dateOrNull
      }
    )
  }
];

export function getCollectionDefinition(name: CollectionName): CollectionDefinition {
  const definition = COLLECTION_DEFINITIONS.find((item) => item.name === name);

  if (!definition) {
    throw new Error(`Неизвестная коллекция: ${name}`);
  }

  return definition;
}

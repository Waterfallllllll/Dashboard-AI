import { z } from "zod";

import { apiSuccessSchema } from "../common/api-response.js";
import {
  entityIdSchema,
  isHttpsUrl,
  localTimeSchema,
  utcDateTimeSchema
} from "../common/primitives.js";

const pushKeyPattern = /^[A-Za-z0-9_-]{16,256}$/;

export const notificationEventSchema = z.enum(["work", "break", "routine", "calendar"], {
  error: "Неизвестный тип уведомления."
});

export const notificationChannelSchema = z.enum(["browser", "telegram", "in_app"], {
  error: "Неизвестный канал уведомления."
});

export const notificationStatusSchema = z.enum(["pending", "sent", "failed", "skipped"], {
  error: "Неизвестный статус доставки."
});

export const notificationChannelPreferenceSchema = z.strictObject({
  browser: z.boolean(),
  telegram: z.boolean()
});

export const notificationPreferencesSchema = z
  .strictObject({
    work: notificationChannelPreferenceSchema,
    break: notificationChannelPreferenceSchema,
    routine: notificationChannelPreferenceSchema,
    calendar: notificationChannelPreferenceSchema,
    quietStart: localTimeSchema.nullable(),
    quietEnd: localTimeSchema.nullable()
  })
  .refine((value) => (value.quietStart === null) === (value.quietEnd === null), {
    error: "Тихие часы задаются началом и концом."
  });

export const pushSubscriptionCreateSchema = z.strictObject({
  endpoint: z
    .string()
    .min(12)
    .max(2048)
    .refine((value) => isHttpsUrl(value), { error: "Нужна ссылка https." }),
  keys: z.strictObject({
    p256dh: z.string().regex(pushKeyPattern, { error: "Некорректный ключ подписки." }),
    auth: z.string().regex(pushKeyPattern, { error: "Некорректный ключ подписки." })
  })
});

export const pushSubscriptionSchema = z.strictObject({
  id: entityIdSchema,
  createdAt: utcDateTimeSchema
});

export const notificationDeliverySchema = z.strictObject({
  id: entityIdSchema,
  eventType: notificationEventSchema,
  channel: notificationChannelSchema,
  status: notificationStatusSchema,
  createdAt: utcDateTimeSchema
});

export const notificationFeedSchema = z.strictObject({
  items: z.array(notificationDeliverySchema).max(20)
});

export const notificationPreferencesResponseSchema = apiSuccessSchema(
  notificationPreferencesSchema
);
export const pushSubscriptionResponseSchema = apiSuccessSchema(pushSubscriptionSchema);
export const notificationFeedResponseSchema = apiSuccessSchema(notificationFeedSchema);

export type NotificationEvent = z.infer<typeof notificationEventSchema>;
export type NotificationChannel = z.infer<typeof notificationChannelSchema>;
export type NotificationStatus = z.infer<typeof notificationStatusSchema>;
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  work: { browser: true, telegram: true },
  break: { browser: true, telegram: true },
  routine: { browser: true, telegram: true },
  calendar: { browser: false, telegram: false },
  quietStart: null,
  quietEnd: null
};
export type PushSubscriptionCreate = z.infer<typeof pushSubscriptionCreateSchema>;
export type PushSubscription = z.infer<typeof pushSubscriptionSchema>;
export type NotificationDelivery = z.infer<typeof notificationDeliverySchema>;

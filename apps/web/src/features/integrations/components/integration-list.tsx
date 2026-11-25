import type { IntegrationStatus } from "@dashboard/contracts";

import { BrowserNotificationsCard } from "./browser-notifications-card";
import { GoogleCalendarCard } from "./google-calendar-card";
import type { CalendarConnectionStatus } from "./google-calendar-connect";
import { LocationCard } from "./location-card";
import { TelegramCard } from "./telegram-card";

import styles from "./integration-list.module.scss";

type IntegrationListProps = Readonly<{
  calendarStatus?: CalendarConnectionStatus | null;
  telegramStatus?: IntegrationStatus | null;
  webPushPublicKey?: string;
}>;

export function IntegrationList({
  calendarStatus = null,
  telegramStatus = null,
  webPushPublicKey = ""
}: IntegrationListProps) {
  return (
    <div className={styles.wrapper}>
      <ul className={styles.grid} role="list">
        <GoogleCalendarCard status={calendarStatus} />
        <TelegramCard status={telegramStatus} />
        <LocationCard />
        <BrowserNotificationsCard publicKey={webPushPublicKey} />
      </ul>
    </div>
  );
}

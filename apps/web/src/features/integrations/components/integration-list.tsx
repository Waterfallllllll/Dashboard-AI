import { BellRing, CalendarDays, LockKeyhole, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";

import { GoogleCalendarConnect, type CalendarConnectionStatus } from "./google-calendar-connect";
import { LocationCard } from "./location-card";

import styles from "./integration-list.module.scss";

type IntegrationCard = Readonly<{
  id: string;
  title: string;
  description: string;
  detail: string;
  action: string;
  status: string;
  icon: LucideIcon;
  tone: "neutral" | "warning";
}>;

const integrations: readonly IntegrationCard[] = [
  {
    id: "google-calendar",
    title: "Google Calendar",
    description: "События на сегодня и ближайшая встреча без возможности редактирования.",
    detail: "Запрашивается отдельный read-only scope только после вашего действия.",
    action: "Подключить календарь",
    status: "Не подключено",
    icon: CalendarDays,
    tone: "neutral"
  },
  {
    id: "telegram",
    title: "Telegram",
    description: "Уведомления таймера и резервный вход после безопасной привязки.",
    detail: "Привязка использует одноразовый короткоживущий токен.",
    action: "Подключить Telegram",
    status: "Не подключено",
    icon: Send,
    tone: "neutral"
  },
  {
    id: "browser-notifications",
    title: "Уведомления браузера",
    description: "Web Push сообщает о завершении рабочего интервала, даже если вкладка закрыта.",
    detail: "При отказе приложение продолжит показывать уведомления внутри интерфейса.",
    action: "Включить уведомления",
    status: "Выключены",
    icon: BellRing,
    tone: "warning"
  }
];

type IntegrationListProps = Readonly<{
  calendarStatus?: CalendarConnectionStatus | null;
}>;

export function IntegrationList({ calendarStatus = null }: IntegrationListProps) {
  const beforeLocation = integrations.slice(0, 2);
  const afterLocation = integrations.slice(2);

  return (
    <div className={styles.wrapper}>
      <aside className={styles.privacyNote}>
        <LockKeyhole aria-hidden="true" />
        <div>
          <strong>Контроль остаётся у вас</strong>
          <p>
            Интеграции подключаются отдельно. Токены и идентификаторы доставки не передаются клиенту
            без необходимости.
          </p>
        </div>
      </aside>

      <ul className={styles.grid} role="list">
        {beforeLocation.map((item) => renderIntegration(item, calendarStatus))}
        <LocationCard />
        {afterLocation.map((item) => renderIntegration(item, calendarStatus))}
      </ul>
    </div>
  );
}

function renderIntegration(item: IntegrationCard, calendarStatus: CalendarConnectionStatus | null) {
  const { action, description, detail, icon: Icon, id, status, title, tone } = item;
  const calendarConnected = id === "google-calendar" && calendarStatus === "connected";

  return (
    <li className={styles.card} key={title}>
      <div className={styles.cardHeader}>
        <div aria-hidden="true" className={styles.icon}>
          <Icon strokeWidth={1.8} />
        </div>
        <StatusBadge tone={calendarConnected ? "neutral" : tone}>
          {calendarConnected ? "Подключено" : status}
        </StatusBadge>
      </div>

      <div className={styles.cardCopy}>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <p className={styles.detail}>{detail}</p>

      <div className={styles.cardFooter}>
        {id === "google-calendar" ? (
          <GoogleCalendarConnect status={calendarStatus} />
        ) : (
          <>
            <button aria-describedby={`${id}-availability`} disabled type="button">
              {action}
            </button>
            <span id={`${id}-availability`}>Доступно после подключения API</span>
          </>
        )}
      </div>
    </li>
  );
}

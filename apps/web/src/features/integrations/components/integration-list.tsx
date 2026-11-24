import { BellRing, CalendarDays, LockKeyhole, MapPin, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";

import { GoogleCalendarConnect, type CalendarConnectionStatus } from "./google-calendar-connect";

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
    id: "location",
    title: "Местоположение",
    description: "Город или сокращённые координаты используются только для прогноза погоды.",
    detail: "Разрешение браузера будет запрошено только после явного нажатия.",
    action: "Настроить локацию",
    status: "Не настроено",
    icon: MapPin,
    tone: "warning"
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
        {integrations.map(
          ({ action, description, detail, icon: Icon, id, status, title, tone }) => (
            <li className={styles.card} key={title}>
              <div className={styles.cardHeader}>
                <div aria-hidden="true" className={styles.icon}>
                  <Icon strokeWidth={1.8} />
                </div>
                <StatusBadge
                  tone={
                    id === "google-calendar" && calendarStatus === "connected" ? "neutral" : tone
                  }
                >
                  {id === "google-calendar" && calendarStatus === "connected"
                    ? "Подключено"
                    : status}
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
          )
        )}
      </ul>
    </div>
  );
}

"use client";

import { LayoutGrid, Settings2 } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import { CalendarWidget, MOCK_CALENDAR_UPDATED_AT_OFFSET_MS } from "@/features/calendar";
import { DateTimeWidget } from "@/features/datetime";
import { MOCK_NEWS_UPDATED_AT_OFFSET_MS, NewsWidget } from "@/features/news";
import { RoutinesWidget } from "@/features/routines";
import { TimerWidget } from "@/features/timer";
import {
  createMockWeather,
  WeatherScene,
  WeatherWidget,
  type WeatherSnapshot
} from "@/features/weather";
import { formatUpdatedAt, getSystemTimeZone } from "@/lib/format/date-time";

import {
  getClockPreferencesServerSnapshot,
  getClockPreferencesSnapshot,
  resolveTimeZone,
  subscribeClockPreferences
} from "../model/clock-preferences";
import {
  DEFAULT_WIDGET_LAYOUT,
  getVisibleWidgets,
  WIDGET_TITLES,
  type WidgetPlacement,
  type WidgetType
} from "../model/widget-layout";
import {
  DEMO_WIDGET_STATES,
  showsWidgetContent,
  type WidgetStatus
} from "../model/widget-status";

import boardStyles from "./dashboard-board.module.scss";
import { WidgetCard } from "./widget-card";
import { WidgetErrorBoundary } from "./widget-error-boundary";

type DashboardBoardProps = Readonly<{
  layout?: readonly WidgetPlacement[];
  states?: Readonly<Partial<Record<WidgetPlacement["type"], WidgetStatus>>>;
}>;

export function DashboardBoard({
  layout = DEFAULT_WIDGET_LAYOUT,
  states = DEMO_WIDGET_STATES
}: DashboardBoardProps) {
  const widgets = getVisibleWidgets(layout);
  const [now] = useState(() => Date.now());
  const [systemTimeZone] = useState(() => getSystemTimeZone());
  const preferences = useSyncExternalStore(
    subscribeClockPreferences,
    getClockPreferencesSnapshot,
    getClockPreferencesServerSnapshot
  );
  const timeZone = resolveTimeZone(preferences.timezone);

  if (widgets.length === 0) {
    return (
      <div className={boardStyles.empty}>
        <LayoutGrid aria-hidden="true" strokeWidth={1.75} />
        <h2>Нет виджетов на экране</h2>
        <p>Включите карточки в настройках, чтобы снова собрать день в одном месте.</p>
        <Link className={boardStyles.emptyAction} href="/settings/widgets">
          Добавить виджеты
        </Link>
      </div>
    );
  }

  return (
    <div className={boardStyles.board}>
      <div className={boardStyles.toolbar}>
        <aside className={boardStyles.previewNotice}>
          <LayoutGrid aria-hidden="true" />
          <div>
            <strong>Мок-данные</strong>
            <p>
              Карточки показывают дату, погоду, календарь, рутины, таймер и новости. Обновление
              одной не блокирует остальные; API подключится позже.
            </p>
          </div>
        </aside>
        <Link className={boardStyles.settingsLink} href="/settings/widgets">
          <Settings2 aria-hidden="true" strokeWidth={1.8} />
          Настроить виджеты
        </Link>
      </div>

      <div className={boardStyles.viewport}>
        <ul aria-label="Виджеты дня" className={boardStyles.grid} role="list">
          {widgets.map((widget) => (
            <li className={boardStyles.item} data-size={widget.size} key={widget.type}>
              <WidgetErrorBoundary title={WIDGET_TITLES[widget.type]}>
                <IndependentWidget
                  initialStatus={states[widget.type] ?? "success"}
                  now={now}
                  systemTimeZone={systemTimeZone}
                  timeFormat={preferences.timeFormat}
                  timeZone={timeZone}
                  widget={widget}
                />
              </WidgetErrorBoundary>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function IndependentWidget({
  initialStatus,
  now,
  systemTimeZone,
  timeFormat,
  timeZone,
  widget
}: Readonly<{
  initialStatus: WidgetStatus;
  now: number;
  systemTimeZone: string;
  timeFormat: "12" | "24";
  timeZone: string;
  widget: WidgetPlacement;
}>) {
  const [status, setStatus] = useState(initialStatus);
  const showContent = showsWidgetContent(status);
  const weather = createMockWeather(now, timeZone);
  const weatherSurface = widget.type === "weather" && showContent;
  const updatedAtLabel = showContent ? getUpdatedAtLabel(widget.type, timeZone, now) : undefined;

  function recover() {
    setStatus("success");
  }

  return (
    <WidgetCard
      onRefresh={recover}
      onRetry={recover}
      status={status}
      widget={widget}
      {...(weatherSurface
        ? {
            background: <WeatherScene isDay={weather.isDay} scene={weather.scene} />,
            surface: weather.scene,
            tone: "weather" as const
          }
        : {})}
      {...(updatedAtLabel ? { updatedAtLabel } : {})}
    >
      <WidgetBody
        now={now}
        systemTimeZone={systemTimeZone}
        timeFormat={timeFormat}
        timeZone={timeZone}
        weather={weather}
        widget={widget}
      />
    </WidgetCard>
  );
}

function WidgetBody({
  now,
  systemTimeZone,
  timeFormat,
  timeZone,
  weather,
  widget
}: Readonly<{
  now: number;
  systemTimeZone: string;
  timeFormat: "12" | "24";
  timeZone: string;
  weather: WeatherSnapshot;
  widget: WidgetPlacement;
}>) {
  switch (widget.type) {
    case "datetime":
      return (
        <DateTimeWidget
          systemTimeZone={systemTimeZone}
          timeFormat={timeFormat}
          timeZone={timeZone}
        />
      );
    case "weather":
      return <WeatherWidget weather={weather} />;
    case "calendar":
      return <CalendarWidget now={now} timeZone={timeZone} />;
    case "routines":
      return <RoutinesWidget />;
    case "timer":
      return <TimerWidget persist={false} />;
    case "news":
      return <NewsWidget now={now} timeZone={timeZone} />;
  }
}

function getUpdatedAtLabel(type: WidgetType, timeZone: string, now: number): string | undefined {

  switch (type) {
    case "weather":
      return formatUpdatedAt(now - 8 * 60 * 1000, now, timeZone);
    case "calendar":
      return formatUpdatedAt(now - MOCK_CALENDAR_UPDATED_AT_OFFSET_MS, now, timeZone);
    case "news":
      return formatUpdatedAt(now - MOCK_NEWS_UPDATED_AT_OFFSET_MS, now, timeZone);
    default:
      return undefined;
  }
}

"use client";

import { LayoutGrid, PanelRight, Settings2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

import { CalendarWidget, MOCK_CALENDAR_UPDATED_AT_OFFSET_MS } from "@/features/calendar";
import { DateTimeWidget } from "@/features/datetime";
import { MOCK_NEWS_UPDATED_AT_OFFSET_MS, NewsWidget } from "@/features/news";
import {
  addDays,
  addOneOff,
  getRoutineLibraryServerSnapshot,
  getRoutineLibrarySnapshot,
  RoutinesWidget,
  subscribeRoutineLibrary,
  toggleOccurrenceDone,
  toWidgetOccurrences,
  updateRoutineLibrary,
  createOneOffRoutine,
  loadRoutineDay,
  patchRoutineOccurrence,
  type RoutineDayOffset
} from "@/features/routines";
import { rememberRemoteTimer, syncTimerAction, TimerWidget } from "@/features/timer";
import {
  locationLabel,
  getDeviceLocationServerSnapshot,
  getDeviceLocationSnapshot,
  subscribeDeviceLocation
} from "@/features/location";
import {
  createMockWeather,
  WeatherScene,
  WeatherWidget,
  type WeatherSnapshot
} from "@/features/weather";
import type { RemoteDashboard } from "@/lib/dashboard/map-dashboard";
import { reloadRemoteDashboard } from "@/lib/dashboard/reload-dashboard";
import { formatInZone, formatUpdatedAt, shiftLocalDate, getSystemTimeZone } from "@/lib/format/date-time";

import {
  getClockPreferencesServerSnapshot,
  getClockPreferencesSnapshot,
  resolveTimeZone,
  subscribeClockPreferences
} from "../model/clock-preferences";
import {
  getVisibleWidgets,
  WIDGET_TITLES,
  type WidgetPlacement,
  type WidgetType
} from "../model/widget-layout";
import { toWidgetPlacements, type WidgetPreference } from "../model/widget-preferences";
import {
  getWidgetPreferencesServerSnapshot,
  getWidgetPreferencesSnapshot,
  subscribeWidgetPreferences
} from "../model/widget-preferences-store";
import { DEMO_WIDGET_STATES, showsWidgetContent, type WidgetStatus } from "../model/widget-status";

import boardStyles from "./dashboard-board.module.scss";
import { WidgetCard } from "./widget-card";
import { WidgetEditorDrawer } from "./widget-editor";
import { WidgetErrorBoundary } from "./widget-error-boundary";

type DashboardBoardProps = Readonly<{
  layout?: readonly WidgetPlacement[];
  remote?: RemoteDashboard;
  states?: Readonly<Partial<Record<WidgetPlacement["type"], WidgetStatus>>>;
}>;

export function DashboardBoard({
  layout: layoutProp,
  remote,
  states: statesProp
}: DashboardBoardProps) {
  const [live, setLive] = useState(remote ?? null);
  const states = statesProp ?? live?.states ?? DEMO_WIDGET_STATES;
  const [editorOpen, setEditorOpen] = useState(false);
  const storedPreferences = useSyncExternalStore(
    subscribeWidgetPreferences,
    getWidgetPreferencesSnapshot,
    getWidgetPreferencesServerSnapshot
  );
  const widgetPreferences = layoutProp ? null : storedPreferences.preferences;
  const layout = layoutProp ?? toWidgetPlacements(storedPreferences.preferences);
  const widgets = getVisibleWidgets(layout);
  const [now] = useState(() => Date.now());
  const [systemTimeZone] = useState(() => getSystemTimeZone());
  const clockPreferences = useSyncExternalStore(
    subscribeClockPreferences,
    getClockPreferencesSnapshot,
    getClockPreferencesServerSnapshot
  );
  const timeZone = resolveTimeZone(clockPreferences.timezone);
  const clockSkewed = live !== null && Math.abs(now - live.serverNow) > 60_000;

  useEffect(() => {
    rememberRemoteTimer(live?.timerRemote ?? null);
  }, [live]);

  return (
    <div className={boardStyles.board}>
      <WidgetEditorDrawer
        onClose={() => {
          setEditorOpen(false);
        }}
        open={editorOpen}
      />
      {widgets.length === 0 ? (
        <div className={boardStyles.empty}>
          <LayoutGrid aria-hidden="true" strokeWidth={1.75} />
          <h2>Нет виджетов на экране</h2>
          <p>Включите карточки в настройках, чтобы снова собрать день в одном месте.</p>
          <Link className={boardStyles.emptyAction} href="/settings/widgets">
            Добавить виджеты
          </Link>
        </div>
      ) : null}
      {widgets.length > 0 ? (
        <>
          <div className={boardStyles.toolbar}>
            {live ? (
              clockSkewed ? (
                <aside className={boardStyles.previewNotice}>
                  <LayoutGrid aria-hidden="true" />
                  <div>
                    <strong>Время устройства отличается</strong>
                    <p>Разница с сервером больше минуты. Часы на карточке идут по этому устройству.</p>
                  </div>
                </aside>
              ) : null
            ) : (
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
            )}
            <div className={boardStyles.toolbarActions}>
              <button
                className={boardStyles.settingsLink}
                onClick={() => {
                  setEditorOpen(true);
                }}
                type="button"
              >
                <PanelRight aria-hidden="true" strokeWidth={1.8} />
                Быстрая настройка
              </button>
              <Link className={boardStyles.settingsLink} href="/settings/widgets">
                <Settings2 aria-hidden="true" strokeWidth={1.8} />
                Настроить виджеты
              </Link>
            </div>
          </div>

          <div className={boardStyles.viewport}>
            <ul aria-label="Виджеты дня" className={boardStyles.grid} role="list">
              {widgets.map((widget) => (
                <li className={boardStyles.item} data-size={widget.size} key={widget.type}>
                  <WidgetErrorBoundary title={WIDGET_TITLES[widget.type]}>
                    <IndependentWidget
                      initialStatus={states[widget.type] ?? "success"}
                      live={live}
                      now={now}
                      onLive={setLive}
                      preference={
                        widgetPreferences?.find((item) => item.type === widget.type) ?? null
                      }
                      systemTimeZone={systemTimeZone}
                      timeFormat={live?.timeFormat ?? clockPreferences.timeFormat}
                      timeZone={live?.timeZone ?? timeZone}
                      widget={widget}
                    />
                  </WidgetErrorBoundary>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}

function IndependentWidget({
  initialStatus,
  live,
  now,
  onLive,
  preference,
  systemTimeZone,
  timeFormat,
  timeZone,
  widget
}: Readonly<{
  initialStatus: WidgetStatus;
  live: RemoteDashboard | null;
  now: number;
  onLive: (next: RemoteDashboard) => void;
  preference: WidgetPreference | null;
  systemTimeZone: string;
  timeFormat: "12" | "24";
  timeZone: string;
  widget: WidgetPlacement;
}>) {
  const [status, setStatus] = useState(initialStatus);
  const showContent = showsWidgetContent(status);
  const routineLibrary = useSyncExternalStore(
    subscribeRoutineLibrary,
    getRoutineLibrarySnapshot,
    getRoutineLibraryServerSnapshot
  );
  const deviceLocation = useSyncExternalStore(
    subscribeDeviceLocation,
    getDeviceLocationSnapshot,
    getDeviceLocationServerSnapshot
  );
  const weatherBase = createMockWeather(now, timeZone);
  const place = locationLabel(deviceLocation);
  const localWeather = place ? { ...weatherBase, locationLabel: place } : weatherBase;
  const weather = live?.weather ?? localWeather;
  const today = formatInZone(now, timeZone, "yyyy-MM-dd");
  const weatherSurface = widget.type === "weather" && showContent;
  const updatedAtLabel = showContent
    ? live?.weather && widget.type === "weather"
      ? formatUpdatedAt(live.weather.updatedAt, now, timeZone)
      : live
        ? undefined
        : getUpdatedAtLabel(widget.type, timeZone, now)
    : undefined;

  async function recover() {
    if (!live) {
      setStatus("success");
      return;
    }

    setStatus("loading");
    const next = await reloadRemoteDashboard(live);

    if (!next) {
      setStatus("error");
      return;
    }

    onLive(next);
    setStatus(next.states[widget.type] ?? "success");
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
        live={live}
        now={now}
        onLive={onLive}
        preference={preference}
        systemTimeZone={systemTimeZone}
        timeFormat={timeFormat}
        routineLibrary={routineLibrary.library}
        timeZone={timeZone}
        today={today}
        weather={weather}
        widget={widget}
      />
    </WidgetCard>
  );
}

function WidgetBody({
  live,
  now,
  onLive,
  preference,
  routineLibrary,
  systemTimeZone,
  timeFormat,
  timeZone,
  today,
  weather,
  widget
}: Readonly<{
  live: RemoteDashboard | null;
  now: number;
  onLive: (next: RemoteDashboard) => void;
  preference: WidgetPreference | null;
  routineLibrary: ReturnType<typeof getRoutineLibrarySnapshot>["library"];
  systemTimeZone: string;
  timeFormat: "12" | "24";
  timeZone: string;
  today: string;
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
      return (
        <WeatherWidget
          temperatureUnit={preference?.temperatureUnit ?? "celsius"}
          weather={weather}
        />
      );
    case "calendar":
      return (
        <CalendarWidget
          now={now}
          timeZone={timeZone}
          {...(live?.calendarEvents ? { events: live.calendarEvents } : {})}
          {...(preference
            ? { calendarScope: preference.calendarScope, itemLimit: preference.itemLimit }
            : {})}
        />
      );
    case "routines":
      return (
        <RoutinesWidget
          {...(preference ? { itemLimit: preference.itemLimit } : {})}
          {...(live?.routineItems
            ? {
                occurrences: live.routineItems,
                onAdd: (title: string, offset: RoutineDayOffset) => {
                  void addRemoteRoutine(live, title, offset, onLive);
                },
                onToggle: (id: string) => {
                  void toggleRemoteRoutine(live, id, onLive);
                }
              }
            : routineLibrary.customized
              ? {
                  occurrences: toWidgetOccurrences(routineLibrary, today),
                  onAdd: (title: string, offset: RoutineDayOffset) => {
                    updateRoutineLibrary((current) =>
                      addOneOff(current, title, addDays(today, offset))
                    );
                  },
                  onToggle: (id: string) => {
                    updateRoutineLibrary((current) => toggleOccurrenceDone(current, id));
                  }
                }
              : {})}
        />
      );
    case "timer":
      return (
        <TimerWidget
          configurable
          {...(live?.timer
            ? {
                initialSession: live.timer,
                onCommit: (previous, next) => {
                  void syncTimerAction(previous, next);
                }
              }
            : { persist: true })}
        />
      );
    case "news":
      return (
        <NewsWidget
          now={now}
          timeZone={timeZone}
          {...(live?.newsItems ? { items: live.newsItems } : {})}
          {...(preference
            ? { itemLimit: preference.itemLimit, sourceMode: preference.newsSourceMode }
            : {})}
        />
      );
  }
}

async function toggleRemoteRoutine(
  live: RemoteDashboard,
  id: string,
  onLive: (next: RemoteDashboard) => void
): Promise<void> {
  const items = live.routineItems;

  if (!items) {
    return;
  }

  const current = items.find((item) => item.id === id);

  if (!current) {
    return;
  }

  const nextDone = !current.done;
  onLive({
    ...live,
    routineItems: items.map((item) => (item.id === id ? { ...item, done: nextDone } : item))
  });

  const saved = await patchRoutineOccurrence(id, nextDone ? "done" : "pending");

  if (!saved) {
    onLive(live);
  }
}

async function addRemoteRoutine(
  live: RemoteDashboard,
  title: string,
  offset: RoutineDayOffset,
  onLive: (next: RemoteDashboard) => void
): Promise<void> {
  const saved = await createOneOffRoutine(title, shiftLocalDate(live.date, offset));

  if (!saved) {
    return;
  }

  const loaded = await loadRoutineDay(shiftLocalDate(live.date, offset), offset);

  if (!loaded || !live.routineItems) {
    return;
  }

  onLive({
    ...live,
    routineItems: [...live.routineItems.filter((item) => item.dayOffset !== offset), ...loaded],
    states: { ...live.states, routines: "success" }
  });
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

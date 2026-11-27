"use client";

import { SECTION_ERROR_MESSAGE, type Dashboard } from "@dashboard/contracts";
import { LayoutGrid, PanelRight, Settings2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { CalendarSyncError, CalendarWidget, syncCalendar } from "@/features/calendar";
import { DateTimeWidget } from "@/features/datetime";
import { NewsWidget, loadNewsSection } from "@/features/news";
import { RoutinesWidget, type RoutineOccurrence } from "@/features/routines";
import { TimerWidget } from "@/features/timer";
import { WeatherScene, WeatherWidget } from "@/features/weather";
import { formatInZone, formatUpdatedAt, getSystemTimeZone } from "@/lib/format/date-time";

import { loadDashboard, loadWeatherSection } from "../api/load-dashboard";
import {
  getClockPreferencesServerSnapshot,
  getClockPreferencesSnapshot,
  hasStoredClockPreferences,
  resolveTimeZone,
  subscribeClockPreferences
} from "../model/clock-preferences";
import { presentDashboard, type PresentedDashboard } from "../model/present-dashboard";
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
import { showsWidgetContent, type WidgetStatus } from "../model/widget-status";

import boardStyles from "./dashboard-board.module.scss";
import { WidgetCard } from "./widget-card";
import { WidgetEditorDrawer } from "./widget-editor";
import { WidgetErrorBoundary } from "./widget-error-boundary";

type BoardLoad =
  | { readonly status: "loading" }
  | { readonly status: "anonymous" }
  | { readonly status: "error" }
  | { readonly status: "ready"; readonly dashboard: Dashboard; readonly weatherPending: boolean; readonly newsPending: boolean };

type RoutineEdit = Readonly<{
  key: string;
  items: readonly RoutineOccurrence[];
}>;

type DashboardBoardProps = Readonly<{
  layout?: readonly WidgetPlacement[];
  loadDay?: typeof loadDashboard;
  loadNews?: typeof loadNewsSection;
  syncCalendarDay?: typeof syncCalendar;
}>;

export function DashboardBoard({
  layout: layoutProp,
  loadDay = loadDashboard,
  loadNews = loadNewsSection,
  syncCalendarDay = syncCalendar
}: DashboardBoardProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [calendarSyncing, setCalendarSyncing] = useState(false);
  const [newsRefreshing, setNewsRefreshing] = useState(false);
  const [loadState, setLoadState] = useState<BoardLoad>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const calendarSyncGeneration = useRef(0);
  const newsRefreshGeneration = useRef(0);
  const [routineEdit, setRoutineEdit] = useState<RoutineEdit | null>(null);
  const [now] = useState(() => Date.now());
  const storedPreferences = useSyncExternalStore(
    subscribeWidgetPreferences,
    getWidgetPreferencesSnapshot,
    getWidgetPreferencesServerSnapshot
  );
  const clockPreferences = useSyncExternalStore(
    subscribeClockPreferences,
    getClockPreferencesSnapshot,
    getClockPreferencesServerSnapshot
  );
  const widgetPreferences = layoutProp ? null : storedPreferences.preferences;
  const layout = layoutProp ?? toWidgetPlacements(storedPreferences.preferences);
  const widgets = getVisibleWidgets(layout);
  const accountClock =
    loadState.status === "ready" && loadState.dashboard.datetime.status === "ready"
      ? loadState.dashboard.datetime
      : null;
  const useAccountClock = accountClock !== null && !hasStoredClockPreferences();
  const timeZone =
    useAccountClock && accountClock
      ? accountClock.timezone
      : resolveTimeZone(clockPreferences.timezone);
  const timeFormat =
    useAccountClock && accountClock ? accountClock.timeFormat : clockPreferences.timeFormat;
  const presented =
    loadState.status === "ready" ? presentDashboard(loadState.dashboard, timeZone) : null;

  function routineSource(): readonly RoutineOccurrence[] {
    if (routineEdit !== null && presented !== null && routineEdit.key === presented.generatedAt) {
      return routineEdit.items;
    }

    return presented?.routines.data ?? [];
  }

  const routineItems = routineSource();

  useEffect(() => {
    const controller = new AbortController();
    let ignore = false;
    const date = formatInZone(Date.now(), resolveTimeZone(clockPreferences.timezone), "yyyy-MM-dd");

    loadDay(date, fetch, controller.signal).then(
      (result) => {
        if (ignore) {
          return;
        }

        if (result.status === "anonymous") {
          setLoadState({ status: "anonymous" });
          return;
        }

        const weatherPending = result.dashboard.weather.status === "unavailable";
        const newsPending = result.dashboard.news.status === "pending";
        setLoadState({
          status: "ready",
          dashboard: result.dashboard,
          weatherPending,
          newsPending
        });

        if (weatherPending) {
          loadWeatherSection(fetch, controller.signal).then(
            (weather) => {
              if (!ignore) {
                setLoadState((current) =>
                  current.status === "ready"
                    ? {
                        status: "ready",
                        dashboard: { ...current.dashboard, weather },
                        weatherPending: false,
                        newsPending: current.newsPending
                      }
                    : current
                );
              }
            },
            (error: unknown) => {
              if (!ignore && !(error instanceof Error && error.name === "AbortError")) {
                setLoadState((current) =>
                  current.status === "ready" ? { ...current, weatherPending: false } : current
                );
              }
            }
          );
        }

        if (newsPending) {
          loadNews({}, fetch, controller.signal).then(
            (news) => {
              if (!ignore) {
                setLoadState((current) => withNewsSection(current, news));
              }
            },
            (error: unknown) => {
              if (!ignore && !(error instanceof Error && error.name === "AbortError")) {
                setLoadState((current) =>
                  withNewsSection(current, { status: "error", message: SECTION_ERROR_MESSAGE })
                );
              }
            }
          );
        }
      },
      (error: unknown) => {
        if (!ignore && !(error instanceof Error && error.name === "AbortError")) {
          setLoadState((current) => (current.status === "ready" ? current : { status: "error" }));
        }
      }
    );

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [clockPreferences.timezone, loadDay, loadNews, reloadKey]);

  function reload(): void {
    setReloadKey((value) => value + 1);
  }

  async function refreshCalendar(): Promise<void> {
    const generation = calendarSyncGeneration.current + 1;
    calendarSyncGeneration.current = generation;
    setCalendarSyncing(true);

    try {
      const date = formatInZone(
        Date.now(),
        resolveTimeZone(clockPreferences.timezone),
        "yyyy-MM-dd"
      );
      const section = await syncCalendarDay(date);

      if (calendarSyncGeneration.current !== generation) {
        return;
      }

      if (loadState.status === "ready") {
        setLoadState((current) => withCalendarSection(current, section));
        return;
      }

      reload();
    } catch (error) {
      if (calendarSyncGeneration.current !== generation || isAbortError(error)) {
        return;
      }

      if (error instanceof CalendarSyncError && error.code === "unauthenticated") {
        setLoadState({ status: "anonymous" });
        return;
      }

      const calendar =
        error instanceof CalendarSyncError && error.code === "missing"
          ? ({ status: "unavailable" } as const)
          : ({ status: "error", message: SECTION_ERROR_MESSAGE } as const);

      setLoadState((current) => withCalendarSection(current, calendar));
    } finally {
      if (calendarSyncGeneration.current === generation) {
        setCalendarSyncing(false);
      }
    }
  }

  async function refreshNews(): Promise<void> {
    const generation = newsRefreshGeneration.current + 1;
    newsRefreshGeneration.current = generation;
    setNewsRefreshing(true);

    try {
      const section = await loadNews({ refresh: true });

      if (newsRefreshGeneration.current !== generation) {
        return;
      }

      setLoadState((current) => withNewsSection(current, section));
    } catch (error) {
      if (newsRefreshGeneration.current !== generation || isAbortError(error)) {
        return;
      }

      setLoadState((current) =>
        withNewsSection(current, { status: "error", message: SECTION_ERROR_MESSAGE })
      );
    } finally {
      if (newsRefreshGeneration.current === generation) {
        setNewsRefreshing(false);
      }
    }
  }

  function toggleRoutine(id: string): void {
    if (!presented) {
      return;
    }

    const source = routineSource();
    setRoutineEdit({
      key: presented.generatedAt,
      items: source.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
    });
  }

  function addRoutine(title: string): void {
    const trimmed = title.trim();

    if (!presented || trimmed.length === 0) {
      return;
    }

    const source = routineSource();
    setRoutineEdit({
      key: presented.generatedAt,
      items: [
        ...source,
        { id: `quick-${source.length}-${trimmed}`, title: trimmed, dayOffset: 0, done: false }
      ]
    });
  }

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
      ) : (
        <>
          <div className={boardStyles.toolbar}>
            <BoardNotice
              status={loadState.status}
              onRetry={() => {
                reload();
              }}
            />
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
                      addRoutine={addRoutine}
                      emptyMode={loadState.status === "ready" ? "section" : "placeholder"}
                      now={now}
                      onReload={
                        widget.type === "calendar"
                          ? refreshCalendar
                          : widget.type === "news"
                            ? refreshNews
                            : reload
                      }
                      preference={
                        widgetPreferences?.find((item) => item.type === widget.type) ?? null
                      }
                      presented={presented}
                      routineItems={routineItems}
                      status={statusFor(
                        widget.type,
                        loadState,
                        presented,
                        (widget.type === "calendar" && calendarSyncing) ||
                          (widget.type === "news" && newsRefreshing)
                      )}
                      timeFormat={timeFormat}
                      timeZone={timeZone}
                      toggleRoutine={toggleRoutine}
                      widget={widget}
                    />
                  </WidgetErrorBoundary>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function BoardNotice({
  onRetry,
  status
}: Readonly<{ onRetry: () => void; status: BoardLoad["status"] }>) {
  if (status === "anonymous") {
    return (
      <aside className={boardStyles.notice}>
        <LayoutGrid aria-hidden="true" />
        <div>
          <strong>Нужен вход</strong>
          <p>Погода, календарь, рутины, таймер и новости загружаются из вашего аккаунта.</p>
          <a className={boardStyles.settingsLink} href="/api/v1/auth/google">
            Войти через Google
          </a>
        </div>
      </aside>
    );
  }

  if (status === "error") {
    return (
      <aside className={boardStyles.notice}>
        <LayoutGrid aria-hidden="true" />
        <div>
          <strong>Данные не загрузились</strong>
          <p>Проверьте соединение и повторите попытку.</p>
          <button className={boardStyles.settingsLink} onClick={onRetry} type="button">
            Повторить загрузку
          </button>
        </div>
      </aside>
    );
  }

  return null;
}

function IndependentWidget({
  addRoutine,
  emptyMode,
  now,
  onReload,
  preference,
  presented,
  routineItems,
  status,
  timeFormat,
  timeZone,
  toggleRoutine,
  widget
}: Readonly<{
  addRoutine: (title: string) => void;
  emptyMode: "section" | "placeholder";
  now: number;
  onReload: () => void;
  preference: WidgetPreference | null;
  presented: PresentedDashboard | null;
  routineItems: readonly RoutineOccurrence[];
  status: WidgetStatus;
  timeFormat: "12" | "24";
  timeZone: string;
  toggleRoutine: (id: string) => void;
  widget: WidgetPlacement;
}>) {
  const section = presented ? presented[widget.type] : null;
  const weather = widget.type === "weather" ? (presented?.weather.data ?? null) : null;
  const showContent = showsWidgetContent(status);
  const weatherSurface = widget.type === "weather" && showContent && weather !== null;
  const updatedAtLabel =
    showContent && section?.updatedAt !== null && section?.updatedAt !== undefined
      ? formatUpdatedAt(section.updatedAt, now, timeZone)
      : undefined;

  return (
    <WidgetCard
      emptyMode={emptyMode}
      onRefresh={onReload}
      onRetry={onReload}
      status={status}
      widget={widget}
      {...(weatherSurface && weather
        ? {
            background: <WeatherScene isDay={weather.isDay} scene={weather.scene} />,
            surface: weather.scene,
            tone: "weather" as const
          }
        : {})}
      {...(updatedAtLabel ? { updatedAtLabel } : {})}
    >
      <WidgetBody
        addRoutine={addRoutine}
        now={now}
        preference={preference}
        presented={presented}
        routineItems={routineItems}
        timeFormat={timeFormat}
        timeZone={timeZone}
        toggleRoutine={toggleRoutine}
        widget={widget}
      />
    </WidgetCard>
  );
}

function WidgetBody({
  addRoutine,
  now,
  preference,
  presented,
  routineItems,
  timeFormat,
  timeZone,
  toggleRoutine,
  widget
}: Readonly<{
  addRoutine: (title: string) => void;
  now: number;
  preference: WidgetPreference | null;
  presented: PresentedDashboard | null;
  routineItems: readonly RoutineOccurrence[];
  timeFormat: "12" | "24";
  timeZone: string;
  toggleRoutine: (id: string) => void;
  widget: WidgetPlacement;
}>) {
  switch (widget.type) {
    case "datetime":
      return (
        <DateTimeWidget
          systemTimeZone={getSystemTimeZone()}
          timeFormat={timeFormat}
          timeZone={timeZone}
        />
      );
    case "weather":
      return presented?.weather.data ? (
        <WeatherWidget
          temperatureUnit={preference?.temperatureUnit ?? "celsius"}
          weather={presented.weather.data}
        />
      ) : null;
    case "calendar":
      return (
        <CalendarWidget
          events={presented?.calendar.data ?? []}
          now={now}
          timeZone={timeZone}
          {...(preference
            ? { calendarScope: preference.calendarScope, itemLimit: preference.itemLimit }
            : {})}
        />
      );
    case "routines":
      return (
        <RoutinesWidget
          occurrences={routineItems}
          onAdd={addRoutine}
          onToggle={toggleRoutine}
          {...(preference ? { itemLimit: preference.itemLimit } : {})}
        />
      );
    case "timer":
      return (
        <TimerWidget
          configurable
          key={presented?.generatedAt ?? "pending"}
          persist={false}
          {...(presented?.timer.data ? { initialSession: presented.timer.data } : {})}
        />
      );
    case "news":
      return (
        <NewsWidget
          items={presented?.news.data ?? []}
          now={now}
          timeZone={timeZone}
          {...(preference
            ? { itemLimit: preference.itemLimit, sourceMode: preference.newsSourceMode }
            : {})}
        />
      );
  }
}

function withCalendarSection(current: BoardLoad, calendar: Dashboard["calendar"]): BoardLoad {
  if (current.status !== "ready") {
    return current;
  }

  return {
    status: "ready",
    dashboard: { ...current.dashboard, calendar },
    weatherPending: current.weatherPending,
    newsPending: current.newsPending
  };
}

function withNewsSection(current: BoardLoad, news: Dashboard["news"]): BoardLoad {
  if (current.status !== "ready") {
    return current;
  }

  return {
    status: "ready",
    dashboard: { ...current.dashboard, news },
    weatherPending: current.weatherPending,
    newsPending: false
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function statusFor(
  type: WidgetType,
  loadState: BoardLoad,
  presented: PresentedDashboard | null,
  syncing: boolean
): WidgetStatus {
  if (type === "calendar" && syncing) {
    return "loading";
  }

  if (type === "datetime") {
    return "success";
  }

  if (loadState.status === "loading") {
    return "loading";
  }

  if (loadState.status === "error") {
    return "error";
  }

  if (loadState.status === "anonymous" || presented === null) {
    return "empty";
  }

  if (type === "weather" && loadState.weatherPending) {
    return "loading";
  }

  if (type === "news" && loadState.status === "ready" && loadState.newsPending) {
    return "loading";
  }

  return presented[type].status;
}

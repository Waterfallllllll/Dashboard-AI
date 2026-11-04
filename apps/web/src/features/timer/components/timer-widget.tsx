"use client";

import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { useTickingNow } from "@/lib/browser/use-ticking-now";
import { publishProductNotice } from "@/features/notifications";

import { playTimerChime } from "../model/timer-chime";
import {
  getTimerSettingsServerSnapshot,
  getTimerSettingsSnapshot,
  recordFocusInterval,
  saveTimerSettings,
  subscribeTimerSettings
} from "../model/timer-settings-store";
import {
  alignIdleSession,
  clampGoal,
  clampMinutes,
  clampVolume,
  type TimerMode,
  type TimerSettings
} from "../model/timer-settings";
import {
  getTimerSessionServerSnapshot,
  getTimerSessionSnapshot,
  subscribeTimerSession,
  writeTimerSession
} from "../model/timer-storage";
import {
  completePhaseIfDue,
  createIdleTimer,
  formatRemaining,
  getDisplayedRemainingMs,
  getNextPhaseLabel,
  getPhaseLabel,
  isTimerActive,
  pauseTimer,
  resetTimer,
  skipPhase,
  startTimer,
  type TimerSession
} from "../model/timer-state";

import styles from "./timer-widget.module.scss";

type TimerWidgetProps = Readonly<{
  persist?: boolean;
  now?: number;
  initialSession?: TimerSession;
  configurable?: boolean;
}>;

const emptySubscribe = () => () => undefined;

export function TimerWidget({
  configurable = false,
  initialSession,
  now: nowProp,
  persist = false
}: TimerWidgetProps) {
  const liveNow = useTickingNow(nowProp === undefined);
  const now = nowProp ?? liveNow;
  const [localSession, setLocalSession] = useState<TimerSession>(
    () => initialSession ?? createIdleTimer()
  );
  const storedSession = useSyncExternalStore(
    persist ? subscribeTimerSession : emptySubscribe,
    persist ? getTimerSessionSnapshot : getTimerSessionServerSnapshot,
    getTimerSessionServerSnapshot
  );
  const settingsSnapshot = useSyncExternalStore(
    configurable ? subscribeTimerSettings : emptySubscribe,
    configurable ? getTimerSettingsSnapshot : getTimerSettingsServerSnapshot,
    getTimerSettingsServerSnapshot
  );
  const settings = configurable ? settingsSnapshot.settings : undefined;
  const session = persist ? storedSession : localSession;
  const aligned = settings ? alignIdleSession(session, settings) : session;
  const due = completePhaseIfDue(aligned, now, settings);
  const remainingMs = getDisplayedRemainingMs(due, now);
  const active = isTimerActive(due);
  const primaryLabel = due.runStatus === "running" ? "Пауза" : "Старт";
  const previous = useRef({
    phase: due.phase,
    runStatus: due.runStatus,
    endsAt: due.endsAt,
    durationMs: due.durationMs
  });
  const announcedKey = useRef<string | null>(null);

  function commit(next: TimerSession) {
    if (persist) {
      writeTimerSession(next);
      return;
    }

    setLocalSession(next);
  }

  if (due !== session) {
    if (persist) {
      writeTimerSession(due);
    } else {
      setLocalSession(due);
    }
  }

  useEffect(() => {
    const before = previous.current;
    const finished = before.runStatus === "running" && due.runStatus === "idle";
    const key = `timer:${before.phase}:${before.endsAt ?? now}`;

    previous.current = {
      phase: due.phase,
      runStatus: due.runStatus,
      endsAt: due.endsAt,
      durationMs: due.durationMs
    };

    if (!finished || !settings || announcedKey.current === key) {
      return;
    }

    announcedKey.current = key;

    if (before.phase === "work") {
      recordFocusInterval(Math.max(1, Math.round(before.durationMs / 60_000)), now);
    }

    playTimerChime(settings.volume);
    publishProductNotice({
      key,
      title: before.phase === "work" ? "Рабочий интервал завершён" : "Перерыв завершён",
      body:
        before.phase === "work"
          ? "Можно перейти к отдыху."
          : "Можно начать следующий рабочий интервал.",
      kind: before.phase === "work" ? "work" : "break",
      now: new Date(now)
    });
  }, [due, now, settings]);

  return (
    <div className={styles.widget} data-timer-active={active ? "true" : "false"}>
      <p aria-live="polite" className={styles.phase}>
        {getPhaseLabel(due.phase)}
      </p>
      <p className={styles.time} suppressHydrationWarning>
        {formatRemaining(remainingMs)}
      </p>
      <p className={styles.next}>{getNextPhaseLabel(due, settings)}</p>
      <p className={styles.goal}>
        Фокус сегодня: {due.completedWorkToday} / {due.dailyGoal}
      </p>
      <div className={styles.controls}>
        <button
          aria-label={primaryLabel}
          className={styles.primary}
          onClick={() => {
            commit(due.runStatus === "running" ? pauseTimer(due, now) : startTimer(due, now));
          }}
          type="button"
        >
          {due.runStatus === "running" ? (
            <Pause aria-hidden="true" strokeWidth={1.8} />
          ) : (
            <Play aria-hidden="true" strokeWidth={1.8} />
          )}
          {primaryLabel}
        </button>
        <button
          aria-label="Пропустить интервал"
          className={styles.iconButton}
          onClick={() => {
            commit(skipPhase(due, settings));
          }}
          type="button"
        >
          <SkipForward aria-hidden="true" strokeWidth={1.8} />
        </button>
        <button
          aria-label="Сбросить таймер"
          className={styles.iconButton}
          onClick={() => {
            commit(resetTimer());
          }}
          type="button"
        >
          <RotateCcw aria-hidden="true" strokeWidth={1.8} />
        </button>
      </div>
      {settings ? (
        <TimerSettingsPanel
          journal={settingsSnapshot.journal}
          onChange={saveTimerSettings}
          settings={settings}
        />
      ) : null}
    </div>
  );
}

function TimerSettingsPanel({
  journal,
  onChange,
  settings
}: Readonly<{
  journal: readonly { id: string; endedAt: number; minutes: number }[];
  onChange: (settings: TimerSettings) => void;
  settings: TimerSettings;
}>) {
  function patch(partial: Partial<TimerSettings>) {
    onChange({ ...settings, ...partial });
  }

  return (
    <details className={styles.settings}>
      <summary>Настроить таймер</summary>
      <fieldset>
        <legend>Режим</legend>
        {(
          [
            ["pomodoro", "Pomodoro"],
            ["custom", "Свой режим"],
            ["manual", "Один интервал"]
          ] as const
        ).map(([mode, label]) => (
          <label key={mode}>
            <input
              checked={settings.mode === mode}
              name="timer-mode"
              onChange={() => {
                patch({ mode: mode satisfies TimerMode });
              }}
              type="radio"
              value={mode}
            />
            {label}
          </label>
        ))}
      </fieldset>
      {settings.mode === "custom" ? (
        <div className={styles.durations}>
          <DurationField
            label="Работа, минуты"
            onChange={(workMinutes) => {
              patch({ workMinutes });
            }}
            value={settings.workMinutes}
          />
          <DurationField
            label="Короткий отдых, минуты"
            onChange={(shortBreakMinutes) => {
              patch({ shortBreakMinutes });
            }}
            value={settings.shortBreakMinutes}
          />
          <DurationField
            label="Длинный отдых, минуты"
            onChange={(longBreakMinutes) => {
              patch({ longBreakMinutes });
            }}
            value={settings.longBreakMinutes}
          />
        </div>
      ) : null}
      {settings.mode === "manual" ? (
        <DurationField
          label="Длительность, минуты"
          onChange={(manualMinutes) => {
            patch({ manualMinutes });
          }}
          value={settings.manualMinutes}
        />
      ) : null}
      <label className={styles.field}>
        Цель фокус-сессий
        <input
          max={24}
          min={1}
          onChange={(event) => {
            patch({ dailyGoal: clampGoal(event.currentTarget.valueAsNumber) });
          }}
          type="number"
          value={settings.dailyGoal}
        />
      </label>
      <label className={styles.field}>
        Громкость сигнала
        <input
          max={100}
          min={0}
          onChange={(event) => {
            patch({ volume: clampVolume(event.currentTarget.valueAsNumber / 100) });
          }}
          type="range"
          value={Math.round(settings.volume * 100)}
        />
      </label>
      <div>
        <h3>Журнал фокуса</h3>
        {journal.length === 0 ? (
          <p>Завершённых интервалов пока нет.</p>
        ) : (
          <ul>
            {journal.map((entry) => (
              <li key={entry.id}>{entry.minutes} мин</li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

function DurationField({
  label,
  onChange,
  value
}: Readonly<{
  label: string;
  onChange: (value: number) => void;
  value: number;
}>) {
  return (
    <label className={styles.field}>
      {label}
      <input
        max={120}
        min={1}
        onChange={(event) => {
          onChange(clampMinutes(event.currentTarget.valueAsNumber));
        }}
        type="number"
        value={value}
      />
    </label>
  );
}

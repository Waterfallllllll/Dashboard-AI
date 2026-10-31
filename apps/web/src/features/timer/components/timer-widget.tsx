"use client";

import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { useState } from "react";

import { useTickingNow } from "@/lib/browser/use-ticking-now";

import { writeTimerSession } from "../model/timer-storage";
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
}>;

export function TimerWidget({
  initialSession,
  now: nowProp,
  persist = false
}: TimerWidgetProps) {
  const liveNow = useTickingNow(nowProp === undefined);
  const now = nowProp ?? liveNow;
  const [session, setSession] = useState<TimerSession>(
    () => initialSession ?? createIdleTimer()
  );
  const due = completePhaseIfDue(session, now);

  if (due !== session) {
    setSession(due);
  }

  const remainingMs = getDisplayedRemainingMs(due, now);
  const active = isTimerActive(due);
  const primaryLabel = due.runStatus === "running" ? "Пауза" : "Старт";

  function commit(next: TimerSession) {
    setSession(next);

    if (persist) {
      writeTimerSession(next);
    }
  }

  return (
    <div className={styles.widget} data-timer-active={active ? "true" : "false"}>
      <p aria-live="polite" className={styles.phase}>
        {getPhaseLabel(due.phase)}
      </p>
      <p className={styles.time} suppressHydrationWarning>
        {formatRemaining(remainingMs)}
      </p>
      <p className={styles.next}>{getNextPhaseLabel(due)}</p>
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
            commit(skipPhase(due));
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
    </div>
  );
}

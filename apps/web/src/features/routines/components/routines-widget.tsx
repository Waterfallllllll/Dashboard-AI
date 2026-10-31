"use client";

import { Plus } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";

import {
  addOccurrence,
  getDayOccurrences,
  getDayProgress,
  isMissedOccurrence,
  restoreOccurrence,
  ROUTINE_DAY_OPTIONS,
  toggleOccurrence,
  type RoutineDayOffset,
  type RoutineOccurrence
} from "../model/routine-day";
import { MOCK_ROUTINE_OCCURRENCES } from "../model/mock-occurrences";

import styles from "./routines-widget.module.scss";

const UNDO_WINDOW_MS = 5_000;

type RoutinesWidgetProps = Readonly<{
  initialItems?: readonly RoutineOccurrence[];
}>;

export function RoutinesWidget({
  initialItems = MOCK_ROUTINE_OCCURRENCES
}: RoutinesWidgetProps) {
  const formId = useId();
  const [dayOffset, setDayOffset] = useState<RoutineDayOffset>(0);
  const [items, setItems] = useState<RoutineOccurrence[]>(() => [...initialItems]);
  const [draft, setDraft] = useState("");
  const [undo, setUndo] = useState<RoutineOccurrence | null>(null);
  const occurrences = getDayOccurrences(items, dayOffset);
  const progress = getDayProgress(items, dayOffset);

  useEffect(() => {
    if (!undo) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setUndo(null);
    }, UNDO_WINDOW_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [undo]);

  function handleToggle(id: string) {
    const result = toggleOccurrence(items, id);
    setItems(result.items);
    setUndo(result.previous);
  }

  function handleUndo() {
    if (!undo) {
      return;
    }

    setItems((current) => restoreOccurrence(current, undo));
    setUndo(null);
  }

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setItems((current) => addOccurrence(current, draft, dayOffset));
    setDraft("");
  }

  return (
    <div className={styles.widget}>
      <div className={styles.days} role="radiogroup" aria-label="Дата рутин">
        {ROUTINE_DAY_OPTIONS.map((option) => (
          <label key={option.offset}>
            <input
              checked={dayOffset === option.offset}
              name="routine-day"
              onChange={() => {
                setDayOffset(option.offset);
              }}
              type="radio"
              value={option.offset}
            />
            {option.label}
          </label>
        ))}
      </div>

      <div className={styles.progress}>
        <span>
          {progress.done} / {progress.total}
        </span>
        <progress max={Math.max(progress.total, 1)} value={progress.done} />
      </div>

      {occurrences.length === 0 ? (
        <p className={styles.empty}>
          На эту дату дел нет. Создайте рутину, чтобы она появилась здесь.
        </p>
      ) : (
        <ul className={styles.list}>
          {occurrences.map((item) => {
            const missed = isMissedOccurrence(item, dayOffset);

            return (
              <li className={styles.item} data-done={item.done} data-missed={missed} key={item.id}>
                <label className={styles.check}>
                  <input
                    checked={item.done}
                    onChange={() => {
                      handleToggle(item.id);
                    }}
                    type="checkbox"
                  />
                  <span className={styles.title}>{item.title}</span>
                  {missed ? <span className={styles.missed}>Пропущено</span> : null}
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {undo ? (
        <button className={styles.undo} onClick={handleUndo} type="button">
          Отменить
        </button>
      ) : null}

      <form className={styles.quickAdd} onSubmit={handleAdd}>
        <label className={styles.liveRegion} htmlFor={formId}>
          Быстрое дело
        </label>
        <input
          id={formId}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          placeholder="Быстрое дело на эту дату"
          value={draft}
        />
        <button aria-label="Добавить дело" type="submit">
          <Plus aria-hidden="true" strokeWidth={1.8} />
        </button>
      </form>
    </div>
  );
}

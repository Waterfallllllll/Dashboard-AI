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
  itemLimit?: number;
  occurrences?: readonly RoutineOccurrence[];
  onToggle?: (id: string) => void;
  onAdd?: (title: string, dayOffset: RoutineDayOffset) => void;
}>;

export function RoutinesWidget({
  initialItems = MOCK_ROUTINE_OCCURRENCES,
  itemLimit,
  occurrences,
  onAdd,
  onToggle
}: RoutinesWidgetProps) {
  const formId = useId();
  const [dayOffset, setDayOffset] = useState<RoutineDayOffset>(0);
  const [items, setItems] = useState<RoutineOccurrence[]>(() => [...initialItems]);
  const visibleItems = occurrences ?? items;
  const [draft, setDraft] = useState("");
  const [undo, setUndo] = useState<RoutineOccurrence | null>(null);
  const dayOccurrences = getDayOccurrences(visibleItems, dayOffset);
  const visibleOccurrences =
    itemLimit === undefined ? dayOccurrences : dayOccurrences.slice(0, itemLimit);
  const progress = getDayProgress(visibleItems, dayOffset);

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
    const result = toggleOccurrence(visibleItems, id);

    if (onToggle) {
      const previous = result.previous;
      onToggle(id);
      queueMicrotask(() => {
        setUndo(previous);
      });
      return;
    }

    setItems(result.items);
    setUndo(result.previous);
  }

  function handleUndo() {
    if (!undo) {
      return;
    }

    if (onToggle) {
      onToggle(undo.id);
    } else {
      setItems((current) => restoreOccurrence(current, undo));
    }

    setUndo(null);
  }

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (onAdd) {
      onAdd(draft, dayOffset);
    } else {
      setItems((current) => addOccurrence(current, draft, dayOffset));
    }

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

      {visibleOccurrences.length === 0 ? (
        <p className={styles.empty}>
          На эту дату дел нет. Создайте рутину, чтобы она появилась здесь.
        </p>
      ) : (
        <ul className={styles.list}>
          {visibleOccurrences.map((item) => {
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

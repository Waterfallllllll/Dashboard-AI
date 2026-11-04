"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";

import { useTickingNow } from "@/lib/browser/use-ticking-now";
import { formatInZone, getSystemTimeZone } from "@/lib/format/date-time";

import {
  getRoutineLibraryServerSnapshot,
  getRoutineLibrarySnapshot,
  replaceRoutineLibrary,
  subscribeRoutineLibrary,
  updateRoutineLibrary
} from "../model/routine-library-store";
import {
  createRoutine,
  describeSchedule,
  endSeries,
  hasDuplicateTitle,
  hideOccurrence,
  parseRoutineDraft,
  setRoutineStatus,
  templateFilterStatus,
  upcomingDates,
  updateRoutine,
  type RoutineActivity,
  type RoutineDraft,
  type RoutineEditScope,
  type RoutineField,
  type RoutineLibrary,
  type RoutineRecurrence,
  type RoutineTemplate,
  type Weekday
} from "../model/routine-rules";

import styles from "./routine-library-editor.module.scss";

const WEEKDAYS: readonly Readonly<{ day: Weekday; label: string }>[] = [
  { day: 1, label: "Пн" },
  { day: 2, label: "Вт" },
  { day: 3, label: "Ср" },
  { day: 4, label: "Чт" },
  { day: 5, label: "Пт" },
  { day: 6, label: "Сб" },
  { day: 0, label: "Вс" }
];

const FILTERS = [
  { value: "active", label: "Текущие" },
  { value: "paused", label: "На паузе" },
  { value: "completed", label: "Завершённые дела" }
] as const;

type FilterValue = (typeof FILTERS)[number]["value"];

export function RoutineLibraryEditor() {
  const formId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const snapshot = useSyncExternalStore(
    subscribeRoutineLibrary,
    getRoutineLibrarySnapshot,
    getRoutineLibraryServerSnapshot
  );
  const now = useTickingNow(false);
  const [timeZone] = useState(getSystemTimeZone);
  const today = formatInZone(now, timeZone, "yyyy-MM-dd");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterValue>("active");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState("");
  const [openEnded, setOpenEnded] = useState(true);
  const [recurrenceKind, setRecurrenceKind] = useState<RoutineRecurrence["kind"]>("daily");
  const [days, setDays] = useState<Weekday[]>([1, 2, 3, 4, 5]);
  const [reminderTime, setReminderTime] = useState("");
  const [status, setStatus] = useState<RoutineActivity>("active");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scopeDate, setScopeDate] = useState(today);
  const [errors, setErrors] = useState<Partial<Record<RoutineField, string>>>({});
  const [undo, setUndo] = useState<RoutineLibrary | null>(null);
  const [pendingDraft, setPendingDraft] = useState<RoutineDraft | null>(null);

  useEffect(() => {
    if (!undo) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setUndo(null);
    }, 5_000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [undo]);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (pendingDraft && !dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    }

    if (!pendingDraft && dialog.open) {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }
  }, [pendingDraft]);

  const normalizedQuery = query.trim().toLocaleLowerCase("ru");
  const visible = snapshot.library.templates.filter((template) => {
    const matchesStatus = templateFilterStatus(template, today) === filter;
    const matchesQuery =
      normalizedQuery.length === 0 ||
      template.title.toLocaleLowerCase("ru").includes(normalizedQuery);

    return matchesStatus && matchesQuery;
  });
  const duplicate = editingId
    ? hasDuplicateTitle(snapshot.library, title, editingId)
    : hasDuplicateTitle(snapshot.library, title);

  function remember(next: RoutineLibrary) {
    setUndo(snapshot.library);
    replaceRoutineLibrary(next);
  }

  function fill(template: RoutineTemplate) {
    setEditingId(template.id);
    setTitle(template.title);
    setDescription(template.description);
    setStartDate(template.startDate);
    setEndDate(template.endDate ?? "");
    setOpenEnded(template.endDate === null);
    setRecurrenceKind(template.recurrence.kind);
    setDays(template.recurrence.kind === "days" ? [...template.recurrence.days] : [1, 2, 3, 4, 5]);
    setReminderTime(template.reminderTime ?? "");
    setStatus(template.status);
    setScopeDate(today < template.startDate ? template.startDate : today);
    setErrors({});
  }

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setStartDate(today);
    setEndDate("");
    setOpenEnded(true);
    setRecurrenceKind("daily");
    setReminderTime("");
    setStatus("active");
    setErrors({});
  }

  function recurrence(): RoutineRecurrence {
    if (recurrenceKind === "days") {
      return { kind: "days", days };
    }

    return { kind: recurrenceKind };
  }

  function apply(draft: RoutineDraft, scope: RoutineEditScope) {
    const current = snapshot.library;

    const next =
      editingId === null
        ? createRoutine(current, draft)
        : updateRoutine(current, editingId, draft, scope, scopeDate);

    remember(next);
    resetForm();
    setPendingDraft(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseRoutineDraft({
      title,
      description,
      startDate,
      endDate,
      openEnded,
      recurrence: recurrence(),
      reminderTime,
      status
    });

    if (!parsed.ok) {
      setErrors(parsed.fieldErrors);
      return;
    }

    setErrors({});
    const current = snapshot.library.templates.find((template) => template.id === editingId);

    if (current && current.recurrence.kind !== "once" && parsed.draft.recurrence.kind !== "once") {
      setPendingDraft(parsed.draft);
      return;
    }

    apply(parsed.draft, "template");
  }

  return (
    <section aria-labelledby={`${formId}-title`} className={styles.editor}>
      <header>
        <h2 id={`${formId}-title`}>Ваши рутины</h2>
        <p>
          Дела сохраняются на этом устройстве и сразу попадают в виджет. Общий аккаунт подключится
          вместе с API.
        </p>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label>
          Название
          <input
            maxLength={120}
            onChange={(event) => {
              setTitle(event.currentTarget.value);
            }}
            required
            value={title}
          />
        </label>
        {errors.title ? <p role="alert">{errors.title}</p> : null}
        {duplicate ? (
          <p role="status">Уже есть рутина с таким названием. Можно сохранить ещё одну.</p>
        ) : null}
        <label>
          Описание
          <textarea
            maxLength={500}
            onChange={(event) => {
              setDescription(event.currentTarget.value);
            }}
            value={description}
          />
        </label>
        {errors.description ? <p role="alert">{errors.description}</p> : null}
        <label>
          Дата начала
          <input
            onChange={(event) => {
              setStartDate(event.currentTarget.value);
            }}
            type="date"
            value={startDate}
          />
        </label>
        {errors.startDate ? <p role="alert">{errors.startDate}</p> : null}
        <label>
          <input
            checked={openEnded}
            onChange={(event) => {
              setOpenEnded(event.currentTarget.checked);
            }}
            type="checkbox"
          />
          Без даты окончания
        </label>
        {openEnded ? null : (
          <label>
            Дата окончания
            <input
              onChange={(event) => {
                setEndDate(event.currentTarget.value);
              }}
              type="date"
              value={endDate}
            />
          </label>
        )}
        {errors.endDate ? <p role="alert">{errors.endDate}</p> : null}
        <label>
          Повторение
          <select
            onChange={(event) => {
              setRecurrenceKind(event.currentTarget.value as RoutineRecurrence["kind"]);
            }}
            value={recurrenceKind}
          >
            <option value="daily">Ежедневно</option>
            <option value="weekdays">По рабочим дням</option>
            <option value="days">Выбранные дни</option>
            <option value="once">Однократно</option>
          </select>
        </label>
        {recurrenceKind === "days" ? (
          <fieldset>
            <legend>Дни недели</legend>
            {WEEKDAYS.map((item) => (
              <label key={item.day}>
                <input
                  checked={days.includes(item.day)}
                  onChange={() => {
                    setDays((current) =>
                      current.includes(item.day)
                        ? current.filter((day) => day !== item.day)
                        : [...current, item.day]
                    );
                  }}
                  type="checkbox"
                />
                {item.label}
              </label>
            ))}
          </fieldset>
        ) : null}
        {errors.recurrence ? <p role="alert">{errors.recurrence}</p> : null}
        <label>
          Время напоминания
          <input
            onChange={(event) => {
              setReminderTime(event.currentTarget.value);
            }}
            type="time"
            value={reminderTime}
          />
        </label>
        {errors.reminderTime ? <p role="alert">{errors.reminderTime}</p> : null}
        <label>
          <input
            checked={status === "active"}
            onChange={(event) => {
              setStatus(event.currentTarget.checked ? "active" : "paused");
            }}
            type="checkbox"
          />
          Рутина активна
        </label>
        <div className={styles.actions}>
          <button type="submit">{editingId ? "Сохранить изменения" : "Сохранить рутину"}</button>
          {editingId ? (
            <button onClick={resetForm} type="button">
              Отменить редактирование
            </button>
          ) : null}
        </div>
      </form>

      <div className={styles.toolbar}>
        <label>
          Поиск по своим рутинам
          <input
            onChange={(event) => {
              setQuery(event.currentTarget.value);
            }}
            type="search"
            value={query}
          />
        </label>
        <fieldset>
          <legend>Показать</legend>
          {FILTERS.map((item) => (
            <label key={item.value}>
              <input
                checked={filter === item.value}
                name="library-filter"
                onChange={() => {
                  setFilter(item.value);
                }}
                type="radio"
                value={item.value}
              />
              {item.label}
            </label>
          ))}
        </fieldset>
      </div>

      {visible.length === 0 ? (
        <h3>Своих рутин пока нет</h3>
      ) : (
        <ul className={styles.list}>
          {visible.map((template) => (
            <li key={template.id}>
              <h3>{template.title}</h3>
              <p>{describeSchedule(template)}</p>
              <p>
                {upcomingDates(template, today, 3).length > 0
                  ? `Ближайшие даты: ${upcomingDates(template, today, 3).join(", ")}`
                  : "Новые экземпляры не создаются"}
              </p>
              <div className={styles.actions}>
                <button
                  onClick={() => {
                    fill(template);
                  }}
                  type="button"
                >
                  Изменить «{template.title}»
                </button>
                <button
                  onClick={() => {
                    remember(
                      setRoutineStatus(
                        snapshot.library,
                        template.id,
                        template.status === "paused" ? "active" : "paused"
                      )
                    );
                  }}
                  type="button"
                >
                  {template.status === "paused" ? "Возобновить" : "Приостановить"} «{template.title}
                  »
                </button>
                <label>
                  Дата экземпляра
                  <input
                    onChange={(event) => {
                      setScopeDate(event.currentTarget.value);
                    }}
                    type="date"
                    value={scopeDate}
                  />
                </label>
                <button
                  onClick={() => {
                    remember(hideOccurrence(snapshot.library, template.id, scopeDate));
                  }}
                  type="button"
                >
                  Скрыть в этот день
                </button>
                <button
                  onClick={() => {
                    remember(endSeries(snapshot.library, template.id, scopeDate));
                  }}
                  type="button"
                >
                  Удалить серию «{template.title}»
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p aria-live="polite">
        {snapshot.saveStatus === "error"
          ? "Не удалось сохранить рутины. Показан последний удачный вариант."
          : snapshot.saveStatus === "pending"
            ? "Сохраняем…"
            : snapshot.saveStatus === "saved"
              ? "Сохранено на этом устройстве."
              : "Изменения рутин сохраняются на этом устройстве."}
      </p>
      {undo ? (
        <button
          onClick={() => {
            updateRoutineLibrary(() => undo);
            setUndo(null);
          }}
          type="button"
        >
          Отменить удаление или изменение
        </button>
      ) : null}

      <dialog aria-labelledby={`${formId}-scope`} className={styles.dialog} ref={dialogRef}>
        <h2 id={`${formId}-scope`}>К каким датам применить изменение?</h2>
        <label>
          Дата, с которой меняем
          <input
            onChange={(event) => {
              setScopeDate(event.currentTarget.value);
            }}
            type="date"
            value={scopeDate}
          />
        </label>
        <div className={styles.actions}>
          <button
            onClick={() => {
              if (pendingDraft) {
                apply(pendingDraft, "date");
              }
            }}
            type="button"
          >
            Только эту дату
          </button>
          <button
            onClick={() => {
              if (pendingDraft) {
                apply(pendingDraft, "following");
              }
            }}
            type="button"
          >
            Эту и следующие
          </button>
          <button
            onClick={() => {
              if (pendingDraft) {
                apply(pendingDraft, "template");
              }
            }}
            type="button"
          >
            Весь шаблон
          </button>
          <button
            onClick={() => {
              setPendingDraft(null);
            }}
            type="button"
          >
            Не менять
          </button>
        </div>
      </dialog>
    </section>
  );
}

"use client";

import { useId, useState, type FormEvent } from "react";

import type { RoutineRuleCreate } from "@dashboard/contracts";

import { useTickingNow } from "@/lib/browser/use-ticking-now";
import { formatInZone, getSystemTimeZone } from "@/lib/format/date-time";

import {
  RoutineRulesError,
  createRoutineRule,
  type CreateRoutineRule
} from "../api/routine-rules-client";
import { notifyAccountRoutinesChanged } from "../model/account-routine-refresh";
import {
  parseRoutineDraft,
  type RoutineDraft,
  type RoutineField,
  type RoutineRecurrence,
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

type RoutineLibraryEditorProps = Readonly<{
  createRule?: CreateRoutineRule;
}>;

function accountRecurrence(recurrence: RoutineRecurrence): RoutineRuleCreate["recurrence"] {
  if (recurrence.kind === "days") {
    return { kind: "weekly", days: [...recurrence.days] };
  }

  return { kind: recurrence.kind };
}

function toAccountCreate(draft: RoutineDraft): RoutineRuleCreate {
  return {
    title: draft.title,
    description: draft.description.length === 0 ? null : draft.description,
    startDate: draft.startDate,
    endDate: draft.endDate,
    recurrence: accountRecurrence(draft.recurrence),
    reminderLocalTime: draft.reminderTime,
    status: draft.status
  };
}

function newIdempotencyKey(): string {
  const suffix =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;

  return `routine-${suffix}`;
}

export function RoutineLibraryEditor({ createRule = createRoutineRule }: RoutineLibraryEditorProps) {
  const formId = useId();
  const now = useTickingNow(false);
  const [timeZone] = useState(getSystemTimeZone);
  const today = formatInZone(now, timeZone, "yyyy-MM-dd");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState("");
  const [recurrenceKind, setRecurrenceKind] = useState<RoutineRecurrence["kind"]>("daily");
  const [days, setDays] = useState<Weekday[]>([1, 2, 3, 4, 5]);
  const [reminderTime, setReminderTime] = useState("");
  const [errors, setErrors] = useState<Partial<Record<RoutineField, string>>>({});
  const [saving, setSaving] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");
  const [accountError, setAccountError] = useState("");

  function resetForm() {
    setTitle("");
    setDescription("");
    setStartDate(today);
    setEndDate("");
    setRecurrenceKind("daily");
    setReminderTime("");
    setErrors({});
  }

  function recurrence(): RoutineRecurrence {
    if (recurrenceKind === "days") {
      return { kind: "days", days };
    }

    return { kind: recurrenceKind };
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseRoutineDraft({
      title,
      description,
      startDate,
      endDate,
      openEnded: endDate.trim() === "",
      recurrence: recurrence(),
      reminderTime,
      status: "active"
    });

    if (!parsed.ok) {
      setErrors(parsed.fieldErrors);
      const firstField = (
        ["title", "description", "startDate", "endDate", "recurrence", "reminderTime"] as const
      ).find((field) => parsed.fieldErrors[field]);
      const fieldId =
        firstField === "startDate"
          ? "routine-editor-start"
          : firstField === "endDate"
            ? "routine-editor-end"
            : firstField === "reminderTime"
              ? "routine-editor-reminder"
              : firstField
                ? `routine-editor-${firstField}`
                : null;

      if (fieldId) {
        document.getElementById(fieldId)?.focus();
      }

      return;
    }

    setErrors({});
    setAccountError("");
    setAccountMessage("");
    void saveToAccount(parsed.draft);
  }

  async function saveToAccount(draft: RoutineDraft) {
    setSaving(true);

    try {
      await createRule(toAccountCreate(draft), newIdempotencyKey());
      resetForm();
      setAccountMessage("Рутина добавлена в список активных.");
      notifyAccountRoutinesChanged();

      try {
        document.getElementById("account-routines")?.scrollIntoView({ block: "start" });
      } catch {
        // В тестовой среде прокрутка страницы не реализована.
      }
    } catch (error) {
      if (error instanceof RoutineRulesError) {
        setAccountError(error.message);
        applyFieldErrors(error.fieldErrors);
        return;
      }

      setAccountError("Не удалось создать рутину.");
    } finally {
      setSaving(false);
    }
  }

  function applyFieldErrors(fieldErrors: Readonly<Record<string, readonly string[]>>) {
    const next: Partial<Record<RoutineField, string>> = {};
    const reminder = fieldErrors.reminderLocalTime?.[0];

    if (fieldErrors.title?.[0]) {
      next.title = fieldErrors.title[0];
    }

    if (fieldErrors.description?.[0]) {
      next.description = fieldErrors.description[0];
    }

    if (fieldErrors.startDate?.[0]) {
      next.startDate = fieldErrors.startDate[0];
    }

    if (fieldErrors.endDate?.[0]) {
      next.endDate = fieldErrors.endDate[0];
    }

    if (fieldErrors.recurrence?.[0]) {
      next.recurrence = fieldErrors.recurrence[0];
    }

    if (reminder) {
      next.reminderTime = reminder;
    }

    if (Object.keys(next).length > 0) {
      setErrors(next);
    }
  }

  return (
    <section aria-labelledby={`${formId}-title`} className={styles.editor} id="routine-editor">
      <header>
        <h2 id={`${formId}-title`}>Ваши рутины</h2>
        <p>Новая рутина сохраняется в аккаунт и появляется в списке «Активные» выше.</p>
      </header>

      <form aria-labelledby={`${formId}-title`} className={styles.form} onSubmit={handleSubmit}>
        <p className={styles.lead}>После сохранения она появится среди активных.</p>
        <div className={styles.field}>
          <label htmlFor="routine-editor-title">Название</label>
          <input
            aria-describedby={errors.title ? "routine-editor-title-error" : undefined}
            aria-invalid={errors.title ? true : undefined}
            id="routine-editor-title"
            maxLength={120}
            name="title"
            onChange={(event) => {
              setTitle(event.currentTarget.value);
            }}
            required
            value={title}
          />
          {errors.title ? (
            <p id="routine-editor-title-error" role="alert">
              {errors.title}
            </p>
          ) : null}
        </div>
        <div className={styles.field}>
          <label htmlFor="routine-editor-description">Описание</label>
          <textarea
            aria-describedby={
              errors.description
                ? "routine-editor-description-error"
                : "routine-editor-description-hint"
            }
            aria-invalid={errors.description ? true : undefined}
            id="routine-editor-description"
            maxLength={500}
            name="description"
            onChange={(event) => {
              setDescription(event.currentTarget.value);
            }}
            value={description}
          />
          <p className={styles.hint} id="routine-editor-description-hint">
            Необязательно.
          </p>
          {errors.description ? (
            <p id="routine-editor-description-error" role="alert">
              {errors.description}
            </p>
          ) : null}
        </div>
        <div className={styles.schedule}>
          <h3>Когда выполнять</h3>
          <div className={styles.dates}>
            <div className={styles.field}>
              <label htmlFor="routine-editor-start">Дата начала</label>
              <input
                aria-describedby={errors.startDate ? "routine-editor-start-error" : undefined}
                aria-invalid={errors.startDate ? true : undefined}
                id="routine-editor-start"
                name="startDate"
                onChange={(event) => {
                  setStartDate(event.currentTarget.value);
                }}
                type="date"
                value={startDate}
              />
              {errors.startDate ? (
                <p id="routine-editor-start-error" role="alert">
                  {errors.startDate}
                </p>
              ) : null}
            </div>
            <div className={styles.field}>
              <label htmlFor="routine-editor-end">Дата окончания</label>
              <input
                aria-describedby={
                  errors.endDate ? "routine-editor-end-error" : "routine-editor-end-hint"
                }
                aria-invalid={errors.endDate ? true : undefined}
                id="routine-editor-end"
                min={startDate}
                name="endDate"
                onChange={(event) => {
                  setEndDate(event.currentTarget.value);
                }}
                type="date"
                value={endDate}
              />
              <p className={styles.hint} id="routine-editor-end-hint">
                Необязательно. Пустое поле — рутина без конца.
              </p>
              {errors.endDate ? (
                <p id="routine-editor-end-error" role="alert">
                  {errors.endDate}
                </p>
              ) : null}
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor="routine-editor-recurrence">Повторение</label>
            <select
              aria-describedby={errors.recurrence ? "routine-editor-recurrence-error" : undefined}
              aria-invalid={errors.recurrence ? true : undefined}
              id="routine-editor-recurrence"
              name="recurrence"
              onChange={(event) => {
                setRecurrenceKind(event.currentTarget.value as RoutineRecurrence["kind"]);
              }}
              value={recurrenceKind}
            >
              <option value="daily">Ежедневно</option>
              <option value="weekdays">По рабочим дням</option>
              <option value="days">В выбранные дни</option>
              <option value="once">Один раз</option>
            </select>
          </div>
          {recurrenceKind === "days" ? (
            <fieldset className={styles.days}>
              <legend>Дни недели</legend>
              {WEEKDAYS.map((item) => {
                const selected = days.includes(item.day);

                return (
                  <button
                    aria-pressed={selected}
                    key={item.day}
                    onClick={() => {
                      setDays((current) =>
                        current.includes(item.day)
                          ? current.filter((day) => day !== item.day)
                          : [...current, item.day]
                      );
                    }}
                    type="button"
                  >
                    {item.label}
                  </button>
                );
              })}
            </fieldset>
          ) : null}
          {errors.recurrence ? (
            <p id="routine-editor-recurrence-error" role="alert">
              {errors.recurrence}
            </p>
          ) : null}
          <div className={styles.field}>
            <label htmlFor="routine-editor-reminder">Время напоминания</label>
            <input
              aria-describedby={
                errors.reminderTime
                  ? "routine-editor-reminder-error"
                  : "routine-editor-reminder-hint"
              }
              aria-invalid={errors.reminderTime ? true : undefined}
              id="routine-editor-reminder"
              name="reminderTime"
              onChange={(event) => {
                setReminderTime(event.currentTarget.value);
              }}
              type="time"
              value={reminderTime}
            />
            <p className={styles.hint} id="routine-editor-reminder-hint">
              Необязательно.
            </p>
            {errors.reminderTime ? (
              <p id="routine-editor-reminder-error" role="alert">
                {errors.reminderTime}
              </p>
            ) : null}
          </div>
        </div>
        {accountError ? <p role="alert">{accountError}</p> : null}
        {accountMessage ? <p role="status">{accountMessage}</p> : null}
        <div className={styles.actions}>
          <button disabled={saving} type="submit">
            {saving ? "Сохраняем…" : "Сохранить рутину"}
          </button>
        </div>
      </form>
    </section>
  );
}

"use client";

import { CalendarDays, CirclePause, CirclePlay, Plus, Search } from "lucide-react";
import { useState } from "react";

import { StatusBadge } from "@/components/ui/status-badge";

import { filterRoutines } from "../model/filter-routines";
import type { RoutineStatus } from "../model/filter-routines";

import styles from "./routine-management.module.scss";

type RoutinePreview = Readonly<{
  id: string;
  title: string;
  schedule: string;
  status: RoutineStatus;
  statusLabel: string;
  nextDates: readonly string[];
}>;

const routines: readonly RoutinePreview[] = [
  {
    id: "morning-exercise",
    title: "Утренняя зарядка",
    schedule: "По рабочим дням · 08:00",
    status: "active",
    statusLabel: "Активна",
    nextDates: ["Сегодня", "26 окт.", "27 окт."]
  },
  {
    id: "reading",
    title: "Читать 20 минут",
    schedule: "Ежедневно · без напоминания",
    status: "paused",
    statusLabel: "Приостановлена",
    nextDates: []
  },
  {
    id: "budget-review",
    title: "Проверить бюджет",
    schedule: "Однократно · 21 октября",
    status: "completed",
    statusLabel: "Завершена",
    nextDates: ["Выполнено 21 окт."]
  }
];

const filters: readonly Readonly<{ value: RoutineStatus; label: string }>[] = [
  { value: "active", label: "Активные" },
  { value: "paused", label: "Приостановленные" },
  { value: "completed", label: "Завершённые" }
];

const statusTone: Readonly<Record<RoutineStatus, "success" | "warning" | "neutral">> = {
  active: "success",
  paused: "warning",
  completed: "neutral"
};

export function RoutineManagement() {
  const [filter, setFilter] = useState<RoutineStatus>("active");
  const [query, setQuery] = useState("");
  const filteredRoutines = filterRoutines(routines, filter, query);

  return (
    <div className={styles.management}>
      <aside className={styles.previewNotice}>
        <CalendarDays aria-hidden="true" />
        <div>
          <strong>Предпросмотр структуры</strong>
          <p>
            Поиск и фильтры работают на демонстрационных данных. Создание и изменение будут
            подключены вместе с API рутин.
          </p>
        </div>
      </aside>

      <div className={styles.toolbar}>
        <div className={styles.searchField}>
          <label htmlFor="routine-search">Поиск по названию</label>
          <div className={styles.searchControl}>
            <Search aria-hidden="true" />
            <input
              autoComplete="off"
              id="routine-search"
              name="q"
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Например, зарядка"
              spellCheck={false}
              type="search"
              value={query}
            />
          </div>
        </div>

        <button
          aria-describedby="create-routine-availability"
          className={styles.createButton}
          disabled
          type="button"
        >
          <Plus aria-hidden="true" />
          Создать рутину
        </button>
        <p className={styles.actionHint} id="create-routine-availability">
          Доступно после подключения API
        </p>
      </div>

      <fieldset className={styles.filters}>
        <legend>Статус рутины</legend>
        {filters.map((item) => (
          <label key={item.value}>
            <input
              checked={filter === item.value}
              name="routine-status"
              onChange={() => setFilter(item.value)}
              type="radio"
              value={item.value}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </fieldset>

      <div className={styles.resultsHeader}>
        <h2>{filters.find((item) => item.value === filter)?.label}</h2>
        <span>Найдено: {filteredRoutines.length}</span>
      </div>

      {filteredRoutines.length > 0 ? (
        <ul className={styles.list} role="list">
          {filteredRoutines.map((routine) => (
            <li className={styles.routine} key={routine.id}>
              <div aria-hidden="true" className={styles.routineIcon}>
                {routine.status === "paused" ? <CirclePause /> : <CirclePlay />}
              </div>

              <div className={styles.routineMain}>
                <div className={styles.routineTitle}>
                  <h3>{routine.title}</h3>
                  <StatusBadge tone={statusTone[routine.status]}>{routine.statusLabel}</StatusBadge>
                </div>
                <p>{routine.schedule}</p>

                {routine.nextDates.length > 0 ? (
                  <div className={styles.nextDates}>
                    <span>Ближайшие даты</span>
                    <ul role="list">
                      {routine.nextDates.map((date) => (
                        <li key={date}>{date}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className={styles.noDates}>Новые экземпляры не создаются</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.empty}>
          <Search aria-hidden="true" />
          <h3>Ничего не найдено</h3>
          <p>Измените запрос или выберите другой статус.</p>
        </div>
      )}
    </div>
  );
}

"use client";

import type { RoutineRule } from "@dashboard/contracts";
import { CirclePause, CirclePlay, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { StatusBadge } from "@/components/ui/status-badge";
import { formatInZone, getSystemTimeZone } from "@/lib/format/date-time";

import {
  RoutineRulesError,
  isAbortError,
  listRoutineRules,
  type ListRoutineRules
} from "../api/routine-rules-client";
import { subscribeAccountRoutines } from "../model/account-routine-refresh";
import { filterRoutines } from "../model/filter-routines";
import type { RoutineStatus } from "../model/filter-routines";
import { presentRoutineRule } from "../model/present-routine-rule";

import styles from "./routine-management.module.scss";

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

type LoadPhase = "loading" | "ready" | "error" | "unauthenticated";

type RoutineManagementProps = Readonly<{
  listRules?: ListRoutineRules;
  today?: string;
}>;

export function RoutineManagement({
  listRules = listRoutineRules,
  today: todayProp
}: RoutineManagementProps) {
  const [filter, setFilter] = useState<RoutineStatus>("active");
  const [query, setQuery] = useState("");
  const [rules, setRules] = useState<readonly RoutineRule[]>([]);
  const [phase, setPhase] = useState<LoadPhase>("loading");
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [clockToday, setClockToday] = useState<string | null>(todayProp ?? null);
  const today = todayProp ?? clockToday;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    listRules(fetch, controller.signal).then(
      (loaded) => {
        if (!active) {
          return;
        }

        if (!todayProp) {
          setClockToday(formatInZone(Date.now(), getSystemTimeZone(), "yyyy-MM-dd"));
        }

        setRules(loaded);
        setPhase("ready");
      },
      (error: unknown) => {
        if (!active || isAbortError(error)) {
          return;
        }

        if (error instanceof RoutineRulesError && error.code === "unauthenticated") {
          setPhase("unauthenticated");
          setLoadError(error.message);
          return;
        }

        setPhase("error");
        setLoadError(error instanceof RoutineRulesError ? error.message : "Не удалось загрузить рутины.");
      }
    );

    return () => {
      active = false;
      controller.abort();
    };
  }, [listRules, reloadKey, todayProp]);

  useEffect(() => {
    return subscribeAccountRoutines(() => {
      setFilter("active");
      setQuery("");
      setReloadKey((current) => current + 1);
    });
  }, []);

  const cards =
    today === null
      ? []
      : rules.map((rule) => presentRoutineRule(rule, today));
  const filteredRoutines = filterRoutines(cards, filter, query);
  const ready = phase === "ready" && today !== null;

  function focusRoutineForm() {
    const section = document.getElementById("routine-editor");
    const title = document.getElementById("routine-editor-title");

    try {
      section?.scrollIntoView({ block: "start" });
    } catch {
      // В тестовой среде прокрутка страницы не реализована.
    }

    if (title instanceof HTMLInputElement) {
      title.focus();
    }
  }

  return (
    <div className={styles.management} id="account-routines">
      <div className={styles.toolbar}>
        <search className={styles.searchField}>
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
        </search>

        <button className={styles.createButton} onClick={focusRoutineForm} type="button">
          <Plus aria-hidden="true" />
          Создать рутину
        </button>
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

      {phase === "loading" ? (
        <p className={styles.status} role="status">
          Загружаем рутины
        </p>
      ) : null}

      {phase === "unauthenticated" ? (
        <div className={styles.empty} role="alert">
          <h3>Нужен вход</h3>
          <p>{loadError}</p>
          <a href="/api/v1/auth/google">Войти через Google</a>
        </div>
      ) : null}

      {phase === "error" ? (
        <div className={styles.empty} role="alert">
          <h3>Рутины не загрузились</h3>
          <p>{loadError}</p>
          <button
            className={styles.secondaryButton}
            onClick={() => {
              setLoadError("");
              setPhase("loading");
              setReloadKey((current) => current + 1);
            }}
            type="button"
          >
            Повторить
          </button>
        </div>
      ) : null}

      {ready ? (
        <>
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
              <h3>{rules.length === 0 && query.trim().length === 0 ? "Рутин пока нет" : "Ничего не найдено"}</h3>
              <p>
                {rules.length === 0 && query.trim().length === 0
                  ? "Создайте первую рутину."
                  : "Измените запрос или выберите другой статус."}
              </p>
            </div>
          )}
        </>
      ) : null}

    </div>
  );
}

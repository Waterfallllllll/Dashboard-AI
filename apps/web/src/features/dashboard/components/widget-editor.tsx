"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import { WIDGET_TITLES } from "../model/widget-catalog";
import {
  getWidgetPreferencesServerSnapshot,
  getWidgetPreferencesSnapshot,
  subscribeWidgetPreferences,
  updateWidgetPreferences
} from "../model/widget-preferences-store";
import {
  EDITOR_SIZES,
  ITEM_LIMITS,
  REFRESH_MINUTES,
  WIDGET_SUMMARIES,
  allowedSizesForWidget,
  createDefaultPreferences,
  isWidgetType,
  moveWidget,
  reorderWidgets,
  setWidgetOption,
  setWidgetSize,
  toggleWidget,
  widgetSupportsItemLimit,
  widgetSupportsRefresh,
  type CalendarScope,
  type EditorSize,
  type ItemLimit,
  type NewsSourceMode,
  type RefreshMinutes,
  type TemperatureUnit,
  type WidgetPreference
} from "../model/widget-preferences";

import styles from "./widget-editor.module.scss";

const SIZE_LABELS: Readonly<Record<EditorSize, string>> = {
  compact: "Компактный",
  standard: "Стандартный",
  wide: "Широкий"
};

const STATUS_TEXT = {
  idle: "Изменения сохраняются автоматически.",
  pending: "Сохраняем…",
  saved: "Сохранено.",
  error: "Не удалось сохранить настройки. Показан последний удачный вариант."
} as const;

type WidgetEditorProps = Readonly<{
  headingId?: string;
  onClose?: () => void;
  variant?: "page" | "drawer";
}>;

export function WidgetEditor({ headingId, onClose, variant = "page" }: WidgetEditorProps) {
  const generatedHeadingId = useId();
  const titleId = headingId ?? generatedHeadingId;
  const snapshot = useSyncExternalStore(
    subscribeWidgetPreferences,
    getWidgetPreferencesSnapshot,
    getWidgetPreferencesServerSnapshot
  );
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    getReducedMotionServer
  );
  const [resetArmed, setResetArmed] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const widgets = [...snapshot.preferences].sort((left, right) => left.position - right.position);

  function handleDragEnd(event: DragEndEvent) {
    const activeType = String(event.active.id);
    const overType = event.over ? String(event.over.id) : "";

    if (!isWidgetType(activeType) || !isWidgetType(overType)) {
      return;
    }

    updateWidgetPreferences((current) => reorderWidgets(current, activeType, overType));
  }

  return (
    <div className={styles.shell} data-variant={variant}>
      <header className={styles.header}>
        <div>
          <h2 id={titleId}>Порядок и параметры</h2>
          <p>
            Включайте карточки, меняйте порядок и размер. Пустые промежутки в сетке не появляются.
          </p>
        </div>
        {onClose ? (
          <button className={styles.close} onClick={onClose} type="button">
            <X aria-hidden="true" strokeWidth={1.8} />
            Закрыть
          </button>
        ) : null}
      </header>

      <div className={styles.body}>
        <DndContext
          id="widget-editor"
          accessibility={{
            announcements: {
              onDragStart({ active }) {
                return `Выбран виджет «${widgetLabel(active.id)}».`;
              },
              onDragOver({ active, over }) {
                return over
                  ? `Виджет «${widgetLabel(active.id)}» перемещается на место «${widgetLabel(over.id)}».`
                  : `Виджет «${widgetLabel(active.id)}» больше не над другим виджетом.`;
              },
              onDragEnd({ active, over }) {
                return over
                  ? `Виджет «${widgetLabel(active.id)}» поставлен на место «${widgetLabel(over.id)}».`
                  : `Перемещение «${widgetLabel(active.id)}» отменено.`;
              },
              onDragCancel({ active }) {
                return `Перемещение «${widgetLabel(active.id)}» отменено.`;
              }
            },
            screenReaderInstructions: {
              draggable:
                "Чтобы взять виджет, нажмите пробел. Перемещайте его стрелками вверх и вниз. Пробел ставит виджет на новое место, Escape отменяет."
            }
          }}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          sensors={sensors}
        >
          <SortableContext
            items={widgets.map((widget) => widget.type)}
            strategy={verticalListSortingStrategy}
          >
            <ul className={styles.list}>
              {widgets.map((widget, index) => (
                <SortableWidgetRow
                  allowedSizes={allowedSizesForWidget(widgets, widget.type)}
                  index={index}
                  key={widget.type}
                  reduceMotion={reduceMotion}
                  total={widgets.length}
                  widget={widget}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </div>

      <footer className={styles.footer}>
        <p aria-live="polite" className={styles.status} role="status">
          {STATUS_TEXT[snapshot.saveStatus]}
        </p>
        {resetArmed ? (
          <div aria-labelledby={`${titleId}-reset`} className={styles.confirm} role="alertdialog">
            <p id={`${titleId}-reset`}>
              Вернуть виджеты к исходному порядку, размерам и параметрам?
            </p>
            <div className={styles.confirmActions}>
              <button
                className={styles.primary}
                onClick={() => {
                  updateWidgetPreferences(() => createDefaultPreferences());
                  setResetArmed(false);
                }}
                type="button"
              >
                Вернуть
              </button>
              <button
                className={styles.secondary}
                onClick={() => setResetArmed(false)}
                type="button"
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <button className={styles.secondary} onClick={() => setResetArmed(true)} type="button">
            Вернуть настройки по умолчанию
          </button>
        )}
      </footer>
    </div>
  );
}

export function WidgetEditorDrawer({
  onClose,
  open
}: Readonly<{ onClose: () => void; open: boolean }>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    }

    if (!open && dialog.open) {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }
  }, [open]);

  return (
    <dialog
      aria-labelledby={headingId}
      className={styles.drawer}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <WidgetEditor headingId={headingId} onClose={onClose} variant="drawer" />
    </dialog>
  );
}

function SortableWidgetRow({
  allowedSizes,
  index,
  reduceMotion,
  total,
  widget
}: Readonly<{
  allowedSizes: readonly EditorSize[];
  index: number;
  reduceMotion: boolean;
  total: number;
  widget: WidgetPreference;
}>) {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition
  } = useSortable({
    id: widget.type,
    transition: reduceMotion ? null : { duration: 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
  });
  const title = WIDGET_TITLES[widget.type];
  const titleId = useId();

  return (
    <li
      aria-label={title}
      className={styles.row}
      data-dragging={isDragging ? "true" : "false"}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition
      }}
    >
      <div className={styles.rowHeader}>
        <button
          aria-label={`Перетащить «${title}»`}
          className={styles.handle}
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden="true" strokeWidth={1.8} />
        </button>
        <div className={styles.identity}>
          <h3 id={titleId}>{title}</h3>
          <p>{WIDGET_SUMMARIES[widget.type]}</p>
        </div>
        <label className={styles.switch}>
          <input
            aria-label={`Показывать «${title}»`}
            checked={widget.enabled}
            onChange={(event) => {
              updateWidgetPreferences((current) =>
                toggleWidget(current, widget.type, event.target.checked)
              );
            }}
            role="switch"
            type="checkbox"
          />
          <span aria-hidden="true" className={styles.track} />
        </label>
      </div>

      <div className={styles.moves}>
        <button
          aria-label={`Поднять «${title}»`}
          disabled={index === 0}
          onClick={() => {
            updateWidgetPreferences((current) => moveWidget(current, widget.type, -1));
          }}
          type="button"
        >
          Выше
        </button>
        <button
          aria-label={`Опустить «${title}»`}
          disabled={index === total - 1}
          onClick={() => {
            updateWidgetPreferences((current) => moveWidget(current, widget.type, 1));
          }}
          type="button"
        >
          Ниже
        </button>
      </div>

      <fieldset className={styles.sizes}>
        <legend>Размер</legend>
        {EDITOR_SIZES.map((size) => {
          const allowed = allowedSizes.includes(size);

          return (
            <label key={size}>
              <input
                checked={widget.size === size}
                disabled={!allowed}
                {...(allowed ? {} : { title: "Этот размер оставит пустой промежуток в сетке" })}
                name={`widget-size-${widget.type}`}
                onChange={() => {
                  updateWidgetPreferences((current) => setWidgetSize(current, widget.type, size));
                }}
                type="radio"
                value={size}
              />
              {SIZE_LABELS[size]}
            </label>
          );
        })}
      </fieldset>

      <WidgetParameters widget={widget} />
    </li>
  );
}

function WidgetParameters({ widget }: Readonly<{ widget: WidgetPreference }>) {
  const showItems = widgetSupportsItemLimit(widget.type);
  const showRefresh = widgetSupportsRefresh(widget.type);
  const showTemperature = widget.type === "weather";
  const showSources = widget.type === "news";
  const showCalendar = widget.type === "calendar";

  if (!showItems && !showRefresh && !showTemperature && !showSources && !showCalendar) {
    return null;
  }

  return (
    <div className={styles.parameters}>
      <p>Параметры</p>
      {showItems ? (
        <label>
          Сколько элементов
          <select
            onChange={(event) => {
              const itemLimit = parseItemLimit(event.target.value);

              if (itemLimit) {
                updateWidgetPreferences((current) =>
                  setWidgetOption(current, widget.type, "itemLimit", itemLimit)
                );
              }
            }}
            value={widget.itemLimit}
          >
            {ITEM_LIMITS.map((limit) => (
              <option key={limit} value={limit}>
                {limit}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {showRefresh ? (
        <label>
          Как часто обновлять
          <select
            onChange={(event) => {
              const refreshMinutes = parseRefreshMinutes(event.target.value);

              if (refreshMinutes) {
                updateWidgetPreferences((current) =>
                  setWidgetOption(current, widget.type, "refreshMinutes", refreshMinutes)
                );
              }
            }}
            value={widget.refreshMinutes}
          >
            {REFRESH_MINUTES.map((minutes) => (
              <option key={minutes} value={minutes}>
                Каждые {minutes} мин
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {showTemperature ? (
        <fieldset>
          <legend>Единицы температуры</legend>
          <TemperatureChoice unit="celsius" widget={widget} label="Цельсий" />
          <TemperatureChoice unit="fahrenheit" widget={widget} label="Фаренгейт" />
        </fieldset>
      ) : null}
      {showSources ? (
        <fieldset>
          <legend>Источники новостей</legend>
          <NewsChoice mode="all" widget={widget} label="Все источники" />
          <NewsChoice mode="official" widget={widget} label="Только официальные" />
        </fieldset>
      ) : null}
      {showCalendar ? (
        <fieldset>
          <legend>Календари</legend>
          <CalendarChoice scope="all" widget={widget} label="Все календари" />
          <CalendarChoice scope="work" widget={widget} label="Только рабочие" />
        </fieldset>
      ) : null}
    </div>
  );
}

function TemperatureChoice({
  label,
  unit,
  widget
}: Readonly<{ label: string; unit: TemperatureUnit; widget: WidgetPreference }>) {
  return (
    <label>
      <input
        checked={widget.temperatureUnit === unit}
        name={`temperature-${widget.type}`}
        onChange={() => {
          updateWidgetPreferences((current) =>
            setWidgetOption(current, widget.type, "temperatureUnit", unit)
          );
        }}
        type="radio"
        value={unit}
      />
      {label}
    </label>
  );
}

function NewsChoice({
  label,
  mode,
  widget
}: Readonly<{ label: string; mode: NewsSourceMode; widget: WidgetPreference }>) {
  return (
    <label>
      <input
        checked={widget.newsSourceMode === mode}
        name={`news-sources-${widget.type}`}
        onChange={() => {
          updateWidgetPreferences((current) =>
            setWidgetOption(current, widget.type, "newsSourceMode", mode)
          );
        }}
        type="radio"
        value={mode}
      />
      {label}
    </label>
  );
}

function CalendarChoice({
  label,
  scope,
  widget
}: Readonly<{ label: string; scope: CalendarScope; widget: WidgetPreference }>) {
  return (
    <label>
      <input
        checked={widget.calendarScope === scope}
        name={`calendar-scope-${widget.type}`}
        onChange={() => {
          updateWidgetPreferences((current) =>
            setWidgetOption(current, widget.type, "calendarScope", scope)
          );
        }}
        type="radio"
        value={scope}
      />
      {label}
    </label>
  );
}

function parseItemLimit(value: string): ItemLimit | null {
  const parsed = Number(value);
  return ITEM_LIMITS.find((limit) => limit === parsed) ?? null;
}

function parseRefreshMinutes(value: string): RefreshMinutes | null {
  const parsed = Number(value);
  return REFRESH_MINUTES.find((minutes) => minutes === parsed) ?? null;
}

function widgetLabel(id: UniqueIdentifier): string {
  const value = String(id);
  return isWidgetType(value) ? WIDGET_TITLES[value] : value;
}

function subscribeReducedMotion(onStoreChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") {
    return () => undefined;
  }

  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onStoreChange);
  return () => {
    query.removeEventListener("change", onStoreChange);
  };
}

function getReducedMotion(): boolean {
  if (typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServer(): boolean {
  return false;
}

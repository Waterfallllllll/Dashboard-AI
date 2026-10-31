"use client";

import { LayoutGrid, Settings2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  DEFAULT_WIDGET_LAYOUT,
  getVisibleWidgets,
  WIDGET_TITLES,
  type WidgetPlacement
} from "../model/widget-layout";
import {
  DEMO_WIDGET_STATES,
  getWidgetPreviewCopy,
  type WidgetStatus
} from "../model/widget-status";

import boardStyles from "./dashboard-board.module.scss";
import { WidgetCard } from "./widget-card";
import { WidgetErrorBoundary } from "./widget-error-boundary";

type DashboardBoardProps = Readonly<{
  layout?: readonly WidgetPlacement[];
  states?: Readonly<Partial<Record<WidgetPlacement["type"], WidgetStatus>>>;
}>;

export function DashboardBoard({
  layout = DEFAULT_WIDGET_LAYOUT,
  states = DEMO_WIDGET_STATES
}: DashboardBoardProps) {
  const widgets = getVisibleWidgets(layout);

  if (widgets.length === 0) {
    return (
      <div className={boardStyles.empty}>
        <LayoutGrid aria-hidden="true" strokeWidth={1.75} />
        <h2>Нет виджетов на экране</h2>
        <p>Включите карточки в настройках, чтобы снова собрать день в одном месте.</p>
        <Link className={boardStyles.emptyAction} href="/settings/widgets">
          Добавить виджеты
        </Link>
      </div>
    );
  }

  return (
    <div className={boardStyles.board}>
      <div className={boardStyles.toolbar}>
        <aside className={boardStyles.previewNotice}>
          <LayoutGrid aria-hidden="true" />
          <div>
            <strong>Независимые карточки</strong>
            <p>
              Сетка уже адаптивная: каждый виджет держит своё состояние загрузки, ошибки, пустых и
              устаревших данных. Содержимое времени, погоды и остальных виджетов появится на
              следующем этапе.
            </p>
          </div>
        </aside>
        <Link className={boardStyles.settingsLink} href="/settings/widgets">
          <Settings2 aria-hidden="true" strokeWidth={1.8} />
          Настроить виджеты
        </Link>
      </div>

      <div className={boardStyles.viewport}>
        <ul aria-label="Виджеты дня" className={boardStyles.grid} role="list">
          {widgets.map((widget) => (
            <li className={boardStyles.item} data-size={widget.size} key={widget.type}>
              <WidgetErrorBoundary title={WIDGET_TITLES[widget.type]}>
                <IndependentWidget
                  initialStatus={states[widget.type] ?? "loading"}
                  widget={widget}
                />
              </WidgetErrorBoundary>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function IndependentWidget({
  initialStatus,
  widget
}: Readonly<{
  initialStatus: WidgetStatus;
  widget: WidgetPlacement;
}>) {
  const [status, setStatus] = useState(initialStatus);

  function recover() {
    setStatus("success");
  }

  return (
    <WidgetCard
      onRefresh={recover}
      onRetry={recover}
      status={status}
      widget={widget}
      {...(status === "stale" ? { updatedAtLabel: "сегодня в 09:12" } : {})}
    >
      <p>{getWidgetPreviewCopy(widget.type)}</p>
    </WidgetCard>
  );
}

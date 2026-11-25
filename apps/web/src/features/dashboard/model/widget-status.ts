import type { WidgetType } from "./widget-catalog";

export const WIDGET_STATUSES = [
  "loading",
  "success",
  "empty",
  "permission-required",
  "disconnected",
  "stale",
  "error"
] as const;

export type WidgetStatus = (typeof WIDGET_STATUSES)[number];

export const DEMO_WIDGET_STATES: Readonly<Record<WidgetType, WidgetStatus>> = {
  datetime: "success",
  weather: "success",
  calendar: "success",
  routines: "success",
  timer: "success",
  news: "success"
};

export const STALE_DATA_NOTICE = "Данные могут быть устаревшими";

export type WidgetStatusAction = Readonly<{
  label: string;
  kind: "retry" | "link";
  href?: string;
}>;

export type WidgetStatusCopy = Readonly<{
  title: string;
  description: string;
  action?: WidgetStatusAction;
}>;

export function showsWidgetContent(status: WidgetStatus): boolean {
  return status === "success" || status === "stale";
}

export function showsStaleNotice(status: WidgetStatus): boolean {
  return status === "stale";
}

export function canRetryWidget(status: WidgetStatus): boolean {
  return status === "error";
}

export function canRefreshWidget(status: WidgetStatus, hasExternalSource: boolean): boolean {
  return hasExternalSource && status !== "loading";
}

export function getWidgetStatusLabel(status: WidgetStatus): string {
  switch (status) {
    case "loading":
      return "Загрузка";
    case "success":
      return "Актуально";
    case "empty":
      return "Пусто";
    case "permission-required":
      return "Нужно разрешение";
    case "disconnected":
      return "Не подключено";
    case "stale":
      return STALE_DATA_NOTICE;
    case "error":
      return "Ошибка";
  }
}

const GENERIC_EMPTY_COPY: WidgetStatusCopy = {
  title: "Пока нет данных",
  description: "В этой карточке появится содержимое, когда источник начнёт отдавать записи.",
  action: { label: "Настроить виджеты", kind: "link", href: "/settings/widgets" }
};

export function getWidgetStatusCopy(
  type: WidgetType,
  status: WidgetStatus,
  emptyMode: "section" | "placeholder" = "section"
): WidgetStatusCopy | null {
  if (status === "loading" || showsWidgetContent(status)) {
    return null;
  }

  if (status === "empty" && emptyMode === "placeholder" && (type === "calendar" || type === "news")) {
    return GENERIC_EMPTY_COPY;
  }

  if (status === "empty") {
    if (type === "routines") {
      return {
        title: "На сегодня нет рутин",
        description: "Создайте повторяющееся дело, чтобы оно появилось на главном экране.",
        action: { label: "Открыть рутины", kind: "link", href: "/settings/routines" }
      };
    }

    if (type === "calendar") {
      return {
        title: "На сегодня событий нет",
        description:
          "Завершившиеся события скрыты. Обновление запросит список у Google Calendar."
      };
    }

    if (type === "news") {
      return {
        title: "За последние сутки новостей нет",
        description: "В ленте нет материалов за сегодня и последние 24 часа."
      };
    }

    return GENERIC_EMPTY_COPY;
  }

  if (status === "permission-required") {
    return {
      title: "Нужно разрешение",
      description:
        type === "weather"
          ? "Разрешите геолокацию или укажите город вручную, чтобы показать прогноз."
          : "Откройте настройки и выдайте доступ, чтобы виджет смог обновиться.",
      action: { label: "Открыть настройки", kind: "link", href: "/settings/integrations" }
    };
  }

  if (status === "disconnected") {
    if (type === "weather") {
      return {
        title: "Место не задано",
        description: "Укажите город или разрешите геолокацию, чтобы показать прогноз.",
        action: { label: "Указать место", kind: "link", href: "/settings/integrations" }
      };
    }

    return {
      title: type === "calendar" ? "Календарь не подключён" : "Источник не подключён",
      description:
        type === "calendar"
          ? "Подключите Google Calendar, чтобы видеть события на сегодня."
          : "Подключите сервис, чтобы виджет снова показывал данные.",
      action: { label: "Подключить", kind: "link", href: "/settings/integrations" }
    };
  }

  return {
    title: "Не удалось обновить данные",
    description: "Проверьте соединение и повторите попытку. Остальные виджеты продолжают работать.",
    action: { label: "Повторить", kind: "retry" }
  };
}


import type { WidgetSettings, WidgetSize, WidgetType } from "@dashboard/contracts";

export type WidgetRecord = {
  readonly widgetType: WidgetType;
  readonly enabled: boolean;
  readonly position: number;
  readonly size: WidgetSize;
  readonly settings: WidgetSettings;
  readonly version: number;
  readonly updatedAt: Date;
};

export type DashboardConfigRecord = {
  readonly userId: string;
  readonly widgets: readonly WidgetRecord[];
  readonly updatedAt: Date;
};

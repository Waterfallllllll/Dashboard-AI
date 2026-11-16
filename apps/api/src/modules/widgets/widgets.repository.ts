import type { DashboardConfigRecord, WidgetRecord } from "./widgets.types.js";

export type WidgetsRepository = {
  findByUser(userId: string): Promise<DashboardConfigRecord | null>;
  insert(config: DashboardConfigRecord): Promise<"inserted" | "exists">;
  replace(
    userId: string,
    widgets: readonly WidgetRecord[],
    expectedUpdatedAt: Date,
    now: Date
  ): Promise<DashboardConfigRecord | "conflict">;
};

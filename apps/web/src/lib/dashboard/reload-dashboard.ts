import { dashboardResponseSchema, routineDayResponseSchema } from "@dashboard/contracts";

import { browserApi } from "@/lib/api/browser-api-client";
import { mapDashboard, type RemoteDashboard } from "@/lib/dashboard/map-dashboard";
import { shiftLocalDate } from "@/lib/format/date-time";

export async function reloadRemoteDashboard(
  current: Pick<RemoteDashboard, "date" | "timeZone" | "timeFormat">
): Promise<RemoteDashboard | null> {
  const [dashboard, yesterday, tomorrow] = await Promise.all([
    browserApi({
      path: "/api/v1/dashboard",
      schema: dashboardResponseSchema,
      query: { date: current.date }
    }),
    browserApi({
      path: "/api/v1/routines",
      schema: routineDayResponseSchema,
      query: { date: shiftLocalDate(current.date, -1) }
    }),
    browserApi({
      path: "/api/v1/routines",
      schema: routineDayResponseSchema,
      query: { date: shiftLocalDate(current.date, 1) }
    })
  ]);

  if (!dashboard.ok) {
    return null;
  }

  return mapDashboard({
    date: current.date,
    timeZone: current.timeZone,
    timeFormat: current.timeFormat,
    dashboard: dashboard.data.data,
    yesterday: yesterday.ok ? yesterday.data.data : null,
    tomorrow: tomorrow.ok ? tomorrow.data.data : null
  });
}

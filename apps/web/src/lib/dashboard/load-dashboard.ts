import {
  dashboardResponseSchema,
  routineDayResponseSchema,
  type Session
} from "@dashboard/contracts";

import { serverApi } from "@/lib/api/server-api-client";
import { mapDashboard, type RemoteDashboard } from "@/lib/dashboard/map-dashboard";
import { localDateInTimeZone, shiftLocalDate } from "@/lib/format/date-time";

export async function loadDashboardView(session: Session): Promise<RemoteDashboard> {
  const date = localDateInTimeZone(session.user.timezone);
  const [dashboard, yesterday, tomorrow] = await Promise.all([
    serverApi({
      path: "/api/v1/dashboard",
      schema: dashboardResponseSchema,
      query: { date },
      timeoutMs: 8_000
    }),
    serverApi({
      path: "/api/v1/routines",
      schema: routineDayResponseSchema,
      query: { date: shiftLocalDate(date, -1) },
      timeoutMs: 8_000
    }),
    serverApi({
      path: "/api/v1/routines",
      schema: routineDayResponseSchema,
      query: { date: shiftLocalDate(date, 1) },
      timeoutMs: 8_000
    })
  ]);

  return mapDashboard({
    date,
    timeZone: session.user.timezone,
    timeFormat: session.user.timeFormat,
    dashboard: dashboard.ok ? dashboard.data.data : null,
    yesterday: yesterday.ok ? yesterday.data.data : null,
    tomorrow: tomorrow.ok ? tomorrow.data.data : null
  });
}

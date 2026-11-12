import { dashboardResponseSchema, localDateQuerySchema } from "@dashboard/contracts";

import { parseRequest } from "../../shared/errors/api-error.js";
import { asyncHandler } from "../../shared/http/async-handler.js";
import { requireViewer } from "../../shared/http/require-actor.js";
import { requestIdFrom } from "../../shared/http/request-id.js";
import { sendParsed } from "../../shared/http/respond.js";
import type { DashboardService } from "./dashboard.service.js";

export function createDashboardController(dashboard: DashboardService) {
  return {
    get: asyncHandler(async (req, res) => {
      const viewer = requireViewer(req);
      const query = parseRequest(localDateQuerySchema, req.query);
      sendParsed(res, dashboardResponseSchema, 200, {
        data: await dashboard.load(viewer, query.date),
        meta: { requestId: requestIdFrom(req) }
      });
    })
  };
}

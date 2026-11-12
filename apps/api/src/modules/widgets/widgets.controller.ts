import {
  widgetPreferencesPatchSchema,
  widgetPreferencesResponseSchema
} from "@dashboard/contracts";

import { parseRequest } from "../../shared/errors/api-error.js";
import { asyncHandler } from "../../shared/http/async-handler.js";
import { requireActor } from "../../shared/http/require-actor.js";
import { requestIdFrom } from "../../shared/http/request-id.js";
import { sendParsed } from "../../shared/http/respond.js";
import type { WidgetsService } from "./widgets.service.js";

export function createWidgetsController(widgets: WidgetsService) {
  return {
    get: asyncHandler(async (req, res) => {
      sendParsed(res, widgetPreferencesResponseSchema, 200, {
        data: await widgets.get(requireActor(req)),
        meta: { requestId: requestIdFrom(req) }
      });
    }),
    update: asyncHandler(async (req, res) => {
      const patch = parseRequest(widgetPreferencesPatchSchema, req.body);
      sendParsed(res, widgetPreferencesResponseSchema, 200, {
        data: await widgets.update(requireActor(req), patch),
        meta: { requestId: requestIdFrom(req) }
      });
    })
  };
}

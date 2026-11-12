import {
  apiSuccessSchema,
  calendarSectionSchema,
  localDateQuerySchema
} from "@dashboard/contracts";

import { parseRequest } from "../../shared/errors/api-error.js";
import { asyncHandler } from "../../shared/http/async-handler.js";
import { requireViewer } from "../../shared/http/require-actor.js";
import { requestIdFrom } from "../../shared/http/request-id.js";
import { sendParsed } from "../../shared/http/respond.js";
import type { CalendarService } from "./calendar.service.js";

const calendarSectionResponseSchema = apiSuccessSchema(calendarSectionSchema);

export function createCalendarController(calendar: CalendarService) {
  return {
    list: asyncHandler(async (req, res) => {
      const viewer = requireViewer(req);
      const query = parseRequest(localDateQuerySchema, req.query);
      sendParsed(res, calendarSectionResponseSchema, 200, {
        data: await calendar.load(viewer, query.date),
        meta: { requestId: requestIdFrom(req) }
      });
    }),
    sync: asyncHandler(async (req, res) => {
      const viewer = requireViewer(req);
      const query = parseRequest(localDateQuerySchema, req.query);
      sendParsed(res, calendarSectionResponseSchema, 200, {
        data: await calendar.sync(viewer, query.date),
        meta: { requestId: requestIdFrom(req) }
      });
    })
  };
}

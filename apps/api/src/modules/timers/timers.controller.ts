import {
  timerHistoryQuerySchema,
  timerHistoryResponseSchema,
  timerPatchSchema,
  timerSnapshotResponseSchema,
  timerStartSchema
} from "@dashboard/contracts";

import { parseRequest } from "../../shared/errors/api-error.js";
import { asyncHandler } from "../../shared/http/async-handler.js";
import { readIdempotencyKey, readRouteId } from "../../shared/http/idempotency-key.js";
import { localDateInTimeZone } from "../../shared/local-date.js";
import { requireViewer } from "../../shared/http/require-actor.js";
import { requestIdFrom } from "../../shared/http/request-id.js";
import { sendParsed } from "../../shared/http/respond.js";
import type { TimersService } from "./timers.service.js";

export function createTimersController(timers: TimersService) {
  return {
    current: asyncHandler(async (req, res) => {
      const viewer = requireViewer(req);
      sendParsed(res, timerSnapshotResponseSchema, 200, {
        data: await timers.current(
          viewer,
          localDateInTimeZone(new Date(), viewer.timezone),
          viewer.timezone
        ),
        meta: { requestId: requestIdFrom(req) }
      });
    }),
    history: asyncHandler(async (req, res) => {
      const query = parseRequest(timerHistoryQuerySchema, req.query);
      const page = await timers.history(requireViewer(req), query);
      sendParsed(res, timerHistoryResponseSchema, 200, {
        data: page.sessions,
        meta: { requestId: requestIdFrom(req), page: { nextCursor: page.nextCursor } }
      });
    }),
    start: asyncHandler(async (req, res) => {
      const viewer = requireViewer(req);
      const body = parseRequest(timerStartSchema, req.body);
      const today = localDateInTimeZone(new Date(), viewer.timezone);
      const started = await timers.start(
        viewer,
        body,
        today,
        viewer.timezone,
        readIdempotencyKey(req)
      );
      sendParsed(res, timerSnapshotResponseSchema, started.replayed ? 200 : 201, {
        data: started.snapshot,
        meta: { requestId: requestIdFrom(req) }
      });
    }),
    update: asyncHandler(async (req, res) => {
      const viewer = requireViewer(req);
      const patch = parseRequest(timerPatchSchema, req.body);
      const today = localDateInTimeZone(new Date(), viewer.timezone);
      sendParsed(res, timerSnapshotResponseSchema, 200, {
        data: await timers.update(viewer, readRouteId(req), patch, today, viewer.timezone),
        meta: { requestId: requestIdFrom(req) }
      });
    })
  };
}

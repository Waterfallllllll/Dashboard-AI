import {
  localDateQuerySchema,
  routineDayResponseSchema,
  routineDeletionResponseSchema,
  routineListQuerySchema,
  routineOccurrencePatchSchema,
  routineOccurrenceResponseSchema,
  routineRuleChangeResponseSchema,
  routineRuleCreateSchema,
  routineRuleListResponseSchema,
  routineRulePatchSchema,
  routineRuleResponseSchema
} from "@dashboard/contracts";

import { parseRequest } from "../../shared/errors/api-error.js";
import { asyncHandler } from "../../shared/http/async-handler.js";
import { readIdempotencyKey, readRouteId } from "../../shared/http/idempotency-key.js";
import { localDateInTimeZone } from "../../shared/local-date.js";
import { requireViewer } from "../../shared/http/require-actor.js";
import { requestIdFrom } from "../../shared/http/request-id.js";
import { sendParsed } from "../../shared/http/respond.js";
import type { RoutinesService } from "./routines.service.js";

export function createRoutinesController(routines: RoutinesService) {
  return {
    listDay: asyncHandler(async (req, res) => {
      const viewer = requireViewer(req);
      const query = parseRequest(localDateQuerySchema, req.query);
      sendParsed(res, routineDayResponseSchema, 200, {
        data: await routines.listDay(
          viewer,
          query.date,
          localDateInTimeZone(new Date(), viewer.timezone)
        ),
        meta: { requestId: requestIdFrom(req) }
      });
    }),
    listRules: asyncHandler(async (req, res) => {
      const viewer = requireViewer(req);
      const query = parseRequest(routineListQuerySchema, req.query);
      const page = await routines.list(
        viewer,
        query,
        localDateInTimeZone(new Date(), viewer.timezone)
      );
      sendParsed(res, routineRuleListResponseSchema, 200, {
        data: page.rules,
        meta: { requestId: requestIdFrom(req), page: { nextCursor: page.nextCursor } }
      });
    }),
    create: asyncHandler(async (req, res) => {
      const viewer = requireViewer(req);
      const body = parseRequest(routineRuleCreateSchema, req.body);
      const created = await routines.create(viewer, body, viewer.timezone, readIdempotencyKey(req));
      sendParsed(res, routineRuleResponseSchema, created.replayed ? 200 : 201, {
        data: created.rule,
        meta: { requestId: requestIdFrom(req) }
      });
    }),
    update: asyncHandler(async (req, res) => {
      const viewer = requireViewer(req);
      const patch = parseRequest(routineRulePatchSchema, req.body);
      sendParsed(res, routineRuleChangeResponseSchema, 200, {
        data: await routines.update(viewer, readRouteId(req), patch),
        meta: { requestId: requestIdFrom(req) }
      });
    }),
    remove: asyncHandler(async (req, res) => {
      await routines.remove(requireViewer(req), readRouteId(req));
      sendParsed(res, routineDeletionResponseSchema, 200, {
        data: { deleted: true },
        meta: { requestId: requestIdFrom(req) }
      });
    }),
    restore: asyncHandler(async (req, res) => {
      sendParsed(res, routineRuleResponseSchema, 200, {
        data: await routines.restore(requireViewer(req), readRouteId(req)),
        meta: { requestId: requestIdFrom(req) }
      });
    }),
    updateOccurrence: asyncHandler(async (req, res) => {
      const patch = parseRequest(routineOccurrencePatchSchema, req.body);
      sendParsed(res, routineOccurrenceResponseSchema, 200, {
        data: await routines.updateOccurrence(requireViewer(req), readRouteId(req), patch),
        meta: { requestId: requestIdFrom(req) }
      });
    })
  };
}

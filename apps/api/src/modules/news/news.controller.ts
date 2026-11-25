import { apiSuccessSchema, newsQuerySchema, newsSectionSchema } from "@dashboard/contracts";
import type { NewsQuery } from "@dashboard/contracts";

import { parseRequest } from "../../shared/errors/api-error.js";
import { asyncHandler } from "../../shared/http/async-handler.js";
import { requireViewer } from "../../shared/http/require-actor.js";
import { requestIdFrom } from "../../shared/http/request-id.js";
import { sendParsed } from "../../shared/http/respond.js";
import type { NewsService } from "./news.service.js";

const newsSectionResponseSchema = apiSuccessSchema(newsSectionSchema);

export function createNewsController(news: NewsService) {
  return {
    get: asyncHandler(async (req, res) => {
      const viewer = requireViewer(req);
      const query = parseRequest(newsQuerySchema, req.query);
      const filter = newsFilter(query);
      sendParsed(res, newsSectionResponseSchema, 200, {
        data:
          query.refresh === "1"
            ? await news.refreshSection(viewer, filter)
            : await news.loadSettled(viewer, filter),
        meta: { requestId: requestIdFrom(req) }
      });
    })
  };
}

function newsFilter(query: NewsQuery): NewsQuery {
  return {
    ...(query.language !== undefined ? { language: query.language } : {}),
    ...(query.sourceMode !== undefined ? { sourceMode: query.sourceMode } : {})
  };
}

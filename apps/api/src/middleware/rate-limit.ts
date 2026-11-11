import { API_ERROR_CODES } from "@dashboard/contracts";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

import { ApiError, toPublicErrorResponse } from "../shared/errors/api-error.js";
import { requestIdFrom } from "../shared/http/request-id.js";

export function createRateLimiter(options: { readonly windowMs: number; readonly limit: number }) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    requestPropertyName: "rateLimit",
    keyGenerator(req) {
      return ipKeyGenerator(req.ip ?? "0.0.0.0");
    },
    handler(req, res) {
      const response = toPublicErrorResponse(
        new ApiError({ code: API_ERROR_CODES.rateLimited }),
        requestIdFrom(req)
      );
      res.setHeader("Cache-Control", "no-store");
      res.status(response.status).json(response.body);
    }
  });
}

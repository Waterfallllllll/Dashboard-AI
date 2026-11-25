import {
  apiSuccessSchema,
  weatherLocationInputSchema,
  weatherLocationResponseSchema,
  weatherPlacesResponseSchema,
  weatherQuerySchema,
  weatherSectionSchema,
  placeQuerySchema
} from "@dashboard/contracts";

import { parseRequest } from "../../shared/errors/api-error.js";
import { asyncHandler } from "../../shared/http/async-handler.js";
import { requireActor, requireViewer } from "../../shared/http/require-actor.js";
import { requestIdFrom } from "../../shared/http/request-id.js";
import { sendParsed } from "../../shared/http/respond.js";
import type { WeatherService } from "./weather.service.js";

const weatherSectionResponseSchema = apiSuccessSchema(weatherSectionSchema);

export function createWeatherController(weather: WeatherService) {
  return {
    read: asyncHandler(async (req, res) => {
      const actor = requireActor(req);
      sendParsed(res, weatherLocationResponseSchema, 200, {
        data: { location: await weather.current(actor) },
        meta: { requestId: requestIdFrom(req) }
      });
    }),
    get: asyncHandler(async (req, res) => {
      const viewer = requireViewer(req);
      const query = parseRequest(weatherQuerySchema, req.query);
      const data =
        query.latitude === undefined
          ? await weather.load(viewer)
          : await weather.forCoordinates(viewer, query);
      sendParsed(res, weatherSectionResponseSchema, 200, {
        data,
        meta: { requestId: requestIdFrom(req) }
      });
    }),
    places: asyncHandler(async (req, res) => {
      const query = parseRequest(placeQuerySchema, req.query);
      sendParsed(res, weatherPlacesResponseSchema, 200, {
        data: { places: await weather.search(query) },
        meta: { requestId: requestIdFrom(req) }
      });
    }),
    save: asyncHandler(async (req, res) => {
      const actor = requireActor(req);
      const body = parseRequest(weatherLocationInputSchema, req.body);
      sendParsed(res, weatherLocationResponseSchema, 200, {
        data: { location: await weather.save(actor, body) },
        meta: { requestId: requestIdFrom(req) }
      });
    }),
    clear: asyncHandler(async (req, res) => {
      const actor = requireActor(req);
      await weather.clear(actor);
      sendParsed(res, weatherLocationResponseSchema, 200, {
        data: { location: null },
        meta: { requestId: requestIdFrom(req) }
      });
    })
  };
}

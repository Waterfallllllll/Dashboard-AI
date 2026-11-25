import { Router } from "express";

import { requireSession } from "../../middleware/require-session.js";
import { createWeatherController } from "./weather.controller.js";
import type { WeatherService } from "./weather.service.js";

export function createWeatherRouter(weather: WeatherService) {
  const router = Router();
  const controller = createWeatherController(weather);
  router.get("/weather/location", requireSession, controller.read);
  router.get("/weather", requireSession, controller.get);
  router.get("/weather/places", requireSession, controller.places);
  router.put("/weather/location", requireSession, controller.save);
  router.delete("/weather/location", requireSession, controller.clear);
  return router;
}

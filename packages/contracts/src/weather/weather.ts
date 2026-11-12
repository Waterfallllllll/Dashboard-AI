import { z } from "zod";

import { apiSuccessSchema } from "../common/api-response.js";
import { utcDateTimeSchema } from "../common/primitives.js";
import { temperatureUnitSchema } from "../widgets/preferences.js";

export const WEATHER_SCENES = ["clear", "cloudy", "rain", "storm", "snow", "fog", "night"] as const;

const temperatureSchema = z
  .number()
  .finite()
  .min(-100, { error: "Температура вне допустимого диапазона." })
  .max(200, { error: "Температура вне допустимого диапазона." });

const probabilitySchema = z
  .number()
  .int({ error: "Вероятность осадков указывается целым числом." })
  .min(0)
  .max(100);

const weatherCodeSchema = z.number().int({ error: "Некорректный код погоды." }).min(0).max(99);

const coordinateQuerySchema = z
  .string()
  .regex(/^-?\d{1,3}(?:\.\d{1,6})?$/, { error: "Некорректные координаты." });

export const weatherPlaceSchema = z.strictObject({
  latitude: z
    .number()
    .finite()
    .min(-90, { error: "Широта указывается от -90 до 90." })
    .max(90, { error: "Широта указывается от -90 до 90." }),
  longitude: z
    .number()
    .finite()
    .min(-180, { error: "Долгота указывается от -180 до 180." })
    .max(180, { error: "Долгота указывается от -180 до 180." }),
  label: z
    .string()
    .trim()
    .min(1, { error: "Укажите название места." })
    .max(80, { error: "Название места слишком длинное." })
    .refine((value) => !hasUnsafeText(value), {
      error: "Название места содержит недопустимые символы."
    })
});

export const weatherLocationInputSchema = weatherPlaceSchema;

export const weatherQuerySchema = z
  .strictObject({
    latitude: coordinateQuerySchema.optional(),
    longitude: coordinateQuerySchema.optional()
  })
  .refine((value) => (value.latitude === undefined) === (value.longitude === undefined), {
    error: "Укажите широту и долготу вместе.",
    path: ["latitude"]
  });

export const placeQuerySchema = z.strictObject({
  query: z
    .string()
    .trim()
    .min(2, { error: "Введите хотя бы два символа." })
    .max(80, { error: "Запрос слишком длинный." })
    .refine((value) => !hasUnsafeText(value), { error: "Запрос содержит недопустимые символы." })
});

export const weatherHourSchema = z.strictObject({
  at: utcDateTimeSchema,
  temperature: temperatureSchema,
  precipitationProbability: probabilitySchema,
  weatherCode: weatherCodeSchema
});

export const weatherSnapshotSchema = z.strictObject({
  locationLabel: weatherPlaceSchema.shape.label,
  temperature: temperatureSchema,
  apparentTemperature: temperatureSchema,
  description: z.string().min(1).max(80),
  precipitationProbability: probabilitySchema,
  windSpeedKmh: z.number().finite().min(0).max(400),
  min: temperatureSchema,
  max: temperatureSchema,
  weatherCode: weatherCodeSchema,
  isDay: z.boolean(),
  scene: z.enum(WEATHER_SCENES),
  unit: temperatureUnitSchema,
  hourly: z.array(weatherHourSchema).max(6)
});

export const weatherPlacesSchema = z.strictObject({
  places: z.array(weatherPlaceSchema).max(5)
});

export const weatherLocationStateSchema = z.strictObject({
  location: weatherPlaceSchema.nullable()
});

export const weatherResponseSchema = apiSuccessSchema(weatherSnapshotSchema);
export const weatherPlacesResponseSchema = apiSuccessSchema(weatherPlacesSchema);
export const weatherLocationResponseSchema = apiSuccessSchema(weatherLocationStateSchema);

export type WeatherScene = (typeof WEATHER_SCENES)[number];
export type WeatherPlace = z.infer<typeof weatherPlaceSchema>;
export type WeatherQuery = z.infer<typeof weatherQuerySchema>;
export type PlaceQuery = z.infer<typeof placeQuerySchema>;
export type WeatherSnapshot = z.infer<typeof weatherSnapshotSchema>;
export type WeatherLocationInput = z.infer<typeof weatherLocationInputSchema>;

function hasUnsafeText(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);

    if (code <= 31 || code === 127 || char === "<" || char === ">") {
      return true;
    }
  }

  return false;
}

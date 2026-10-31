export const WEATHER_SCENES = [
  "clear",
  "cloudy",
  "rain",
  "storm",
  "snow",
  "fog",
  "night"
] as const;

export type WeatherSceneId = (typeof WEATHER_SCENES)[number];

export type HourlyForecast = Readonly<{
  hourLabel: string;
  temperatureC: number;
  precipitationProbability: number;
  weatherCode: number;
}>;

export type WeatherSnapshot = Readonly<{
  locationLabel: string;
  temperatureC: number;
  apparentTemperatureC: number;
  description: string;
  precipitationProbability: number;
  windSpeedKmh: number;
  minC: number;
  maxC: number;
  weatherCode: number;
  isDay: boolean;
  scene: WeatherSceneId;
  updatedAt: number;
  hourly: readonly HourlyForecast[];
}>;

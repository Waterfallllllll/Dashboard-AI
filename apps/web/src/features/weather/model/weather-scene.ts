import type { WeatherSceneId } from "./weather-types";

export function getWeatherScene(weatherCode: number, isDay: boolean): WeatherSceneId {
  if (weatherCode === 45 || weatherCode === 48) {
    return "fog";
  }

  if (
    weatherCode === 71 ||
    weatherCode === 73 ||
    weatherCode === 75 ||
    weatherCode === 77 ||
    weatherCode === 85 ||
    weatherCode === 86
  ) {
    return "snow";
  }

  if (weatherCode >= 95) {
    return "storm";
  }

  if (
    (weatherCode >= 51 && weatherCode <= 67) ||
    (weatherCode >= 80 && weatherCode <= 82)
  ) {
    return "rain";
  }

  if (weatherCode === 2 || weatherCode === 3) {
    return "cloudy";
  }

  if (!isDay && (weatherCode === 0 || weatherCode === 1)) {
    return "night";
  }

  return "clear";
}

export function shouldReduceWeatherParticles(): boolean {
  if (typeof navigator === "undefined") {
    return true;
  }

  if ("deviceMemory" in navigator && typeof navigator.deviceMemory === "number") {
    return navigator.deviceMemory <= 4;
  }

  return false;
}

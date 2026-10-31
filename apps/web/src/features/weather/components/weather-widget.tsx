"use client";

import { useState } from "react";

import { formatTemperature, formatWind, MOCK_WEATHER } from "../model/mock-weather";
import type { WeatherSnapshot } from "../model/weather-types";

import styles from "./weather-widget.module.scss";

type WeatherWidgetProps = Readonly<{
  weather?: WeatherSnapshot;
}>;

export function WeatherWidget({ weather = MOCK_WEATHER }: WeatherWidgetProps) {
  const [forecastOpen, setForecastOpen] = useState(false);

  return (
    <div className={styles.widget}>
      <div className={styles.panel}>
        <p className={styles.location}>{weather.locationLabel}</p>
        <p className={styles.temperature}>{formatTemperature(weather.temperatureC)}</p>
        <p className={styles.description}>{weather.description}</p>
        <dl className={styles.stats}>
          <div>
            <dt>Ощущается</dt>
            <dd>{formatTemperature(weather.apparentTemperatureC)}</dd>
          </div>
          <div>
            <dt>Осадки</dt>
            <dd>{weather.precipitationProbability}%</dd>
          </div>
          <div>
            <dt>Ветер</dt>
            <dd>{formatWind(weather.windSpeedKmh)}</dd>
          </div>
          <div>
            <dt>День</dt>
            <dd>
              {formatTemperature(weather.minC)} / {formatTemperature(weather.maxC)}
            </dd>
          </div>
        </dl>
        <button
          aria-expanded={forecastOpen}
          className={styles.forecastToggle}
          onClick={() => {
            setForecastOpen((open) => !open);
          }}
          type="button"
        >
          {forecastOpen ? "Скрыть прогноз на 6 часов" : "Прогноз на 6 часов"}
        </button>
        {forecastOpen ? (
          <ol className={styles.hourly}>
            {weather.hourly.map((hour) => (
              <li key={hour.hourLabel}>
                <span>{hour.hourLabel}</span>
                <strong>{formatTemperature(hour.temperatureC)}</strong>
                <span>{hour.precipitationProbability}%</span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </div>
  );
}

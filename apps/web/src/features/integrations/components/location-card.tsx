"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";

import type { WeatherPlace } from "@dashboard/contracts";

import { StatusBadge } from "@/components/ui/status-badge";

import { WeatherPlaceForm } from "./weather-place-form";

import styles from "./integration-list.module.scss";

export function LocationCard() {
  const [place, setPlace] = useState<WeatherPlace | null>(null);

  return (
    <li className={styles.card}>
      <div className={styles.cardHeader}>
        <div aria-hidden="true" className={styles.icon}>
          <MapPin strokeWidth={1.8} />
        </div>
        <StatusBadge tone={place ? "success" : "warning"}>
          {place ? "Настроено" : "Не настроено"}
        </StatusBadge>
      </div>

      <div className={styles.cardCopy}>
        <h2 id="location-title">Местоположение</h2>
        <p>Город или сокращённые координаты используются только для прогноза погоды.</p>
      </div>

      <p className={styles.detail}>Разрешение браузера будет запрошено только после явного нажатия.</p>

      <div className={styles.cardFooter}>
        <WeatherPlaceForm onPlaceChange={setPlace} />
      </div>
    </li>
  );
}

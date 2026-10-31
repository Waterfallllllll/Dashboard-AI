import clsx from "clsx";

import { shouldReduceWeatherParticles } from "../model/weather-scene";
import type { WeatherSceneId } from "../model/weather-types";

import styles from "./weather-scene.module.scss";

type WeatherSceneProps = Readonly<{
  scene: WeatherSceneId;
  isDay: boolean;
}>;

export function WeatherScene({ isDay, scene }: WeatherSceneProps) {
  const reduced = shouldReduceWeatherParticles();

  return (
    <div
      aria-hidden="true"
      className={clsx(styles.scene, reduced && styles.reduced)}
      data-day={isDay ? "day" : "night"}
      data-scene={scene}
    >
      <span className={styles.sky} />
      <span className={styles.glow} />
      <span className={styles.cloud} data-layer="back" />
      <span className={styles.cloud} data-layer="front" />
      <span className={styles.precip} />
      <span className={styles.stars} />
      <span className={styles.flash} />
    </div>
  );
}

import { describe, expect, it } from "vitest";

import { getWeatherScene } from "./weather-scene";

describe("getWeatherScene", () => {
  it("выбирает сцену по weather code и времени суток", () => {
    expect(getWeatherScene(0, true)).toBe("clear");
    expect(getWeatherScene(0, false)).toBe("night");
    expect(getWeatherScene(3, true)).toBe("cloudy");
    expect(getWeatherScene(61, true)).toBe("rain");
    expect(getWeatherScene(71, true)).toBe("snow");
    expect(getWeatherScene(45, true)).toBe("fog");
    expect(getWeatherScene(95, true)).toBe("storm");
  });
});

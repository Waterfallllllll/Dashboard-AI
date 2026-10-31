import { describe, expect, it } from "vitest";

import {
  addOccurrence,
  getDayProgress,
  isMissedOccurrence,
  restoreOccurrence,
  toggleOccurrence,
  type RoutineOccurrence
} from "./routine-day";

const items: readonly RoutineOccurrence[] = [
  { id: "water", title: "Вода", dayOffset: 0, done: false },
  { id: "cat", title: "Кот", dayOffset: -1, done: false }
];

describe("routine day", () => {
  it("считает прогресс и отмечает пропущенное вчера", () => {
    expect(getDayProgress(items, 0)).toEqual({ done: 0, total: 1 });
    expect(isMissedOccurrence(items[1]!, -1)).toBe(true);
  });

  it("переключает выполнение и умеет вернуть предыдущее состояние", () => {
    const toggled = toggleOccurrence(items, "water");
    expect(toggled.items[0]?.done).toBe(true);
    expect(restoreOccurrence(toggled.items, toggled.previous!)[0]?.done).toBe(false);
  });

  it("добавляет дело на выбранную дату и игнорирует пустой заголовок", () => {
    expect(addOccurrence(items, "   ", 0)).toHaveLength(2);
    expect(addOccurrence(items, "Зарядка", 1).at(-1)).toMatchObject({
      title: "Зарядка",
      dayOffset: 1,
      done: false
    });
  });
});

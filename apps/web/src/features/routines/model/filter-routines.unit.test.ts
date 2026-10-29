import { describe, expect, it } from "vitest";

import { filterRoutines } from "./filter-routines";

const routines = [
  { id: "morning", title: "Утренняя зарядка", status: "active" as const },
  { id: "reading", title: "Читать 20 минут", status: "paused" as const },
  { id: "budget", title: "Проверить бюджет", status: "completed" as const },
  { id: "walk", title: "Вечерняя зарядка", status: "active" as const }
];

describe("filterRoutines", () => {
  it("оставляет рутины выбранного статуса", () => {
    expect(filterRoutines(routines, "paused", "").map((routine) => routine.id)).toEqual(["reading"]);
  });

  it("ищет по названию без учёта регистра и пробелов", () => {
    expect(filterRoutines(routines, "active", "  ЗАРЯДКА ").map((routine) => routine.id)).toEqual([
      "morning",
      "walk"
    ]);
  });

  it("возвращает пустой список, если ничего не совпало", () => {
    expect(filterRoutines(routines, "completed", "зарядка")).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";

import {
  addOneOff,
  createEmptyLibrary,
  createRoutine,
  endSeries,
  hasDuplicateTitle,
  hideOccurrence,
  listOnDate,
  parseRoutineDraft,
  updateRoutine,
  upcomingDates
} from "./routine-rules";

const today = "2026-11-04";

function dailyDraft(title = "Зарядка") {
  const parsed = parseRoutineDraft({
    title,
    description: "",
    startDate: "2026-11-01",
    endDate: "",
    openEnded: true,
    recurrence: { kind: "daily" },
    reminderTime: "08:00",
    status: "active"
  });

  if (!parsed.ok) {
    throw new Error("draft");
  }

  return parsed.draft;
}

describe("routine rules", () => {
  it("отклоняет пустое название и конец раньше начала", () => {
    const parsed = parseRoutineDraft({
      title: " ",
      description: "",
      startDate: "2026-11-10",
      endDate: "2026-11-01",
      openEnded: false,
      recurrence: { kind: "daily" },
      reminderTime: "",
      status: "active"
    });

    expect(parsed.ok).toBe(false);

    if (!parsed.ok) {
      expect(parsed.fieldErrors.title).toBeTruthy();
      expect(parsed.fieldErrors.endDate).toBeTruthy();
    }
  });

  it("разрешает одинаковое название и предупреждает о нём", () => {
    const library = createRoutine(createEmptyLibrary(), dailyDraft("Вода"));

    expect(hasDuplicateTitle(library, " вода ")).toBe(true);
    expect(createRoutine(library, dailyDraft("Вода")).templates).toHaveLength(2);
  });

  it("ставит ежедневную рутину на сегодня и пропускает выходной у рабочих дней", () => {
    const daily = createRoutine(createEmptyLibrary(), dailyDraft());
    const weekdays = createRoutine(createEmptyLibrary(), {
      ...dailyDraft("Планёрка"),
      recurrence: { kind: "weekdays" }
    });

    expect(listOnDate(daily, today, today).map((item) => item.title)).toEqual(["Зарядка"]);
    expect(listOnDate(weekdays, "2026-11-07", "2026-11-07")).toEqual([]);
    expect(upcomingDates(weekdays.templates[0]!, "2026-11-06", 1)).toEqual(["2026-11-06"]);
  });

  it("скрывает один день и оставляет прошлую историю при удалении серии", () => {
    const library = createRoutine(createEmptyLibrary(), dailyDraft());
    const templateId = library.templates[0]!.id;
    const hidden = hideOccurrence(library, templateId, today);
    const ended = endSeries(library, templateId, today);

    expect(listOnDate(hidden, today, today)).toEqual([]);
    expect(listOnDate(hidden, "2026-11-03", today)).toHaveLength(1);
    expect(listOnDate(ended, "2026-11-03", today)).toHaveLength(1);
    expect(listOnDate(ended, today, today)).toEqual([]);
  });

  it("изменение с этой даты не трогает выполнение в прошлом", () => {
    const library = createRoutine(createEmptyLibrary(), dailyDraft());
    const templateId = library.templates[0]!.id;
    const marked = hideOccurrence(library, templateId, "2026-11-03");
    const split = updateRoutine(
      {
        ...marked,
        overrides: marked.overrides.map((override) =>
          override.date === "2026-11-03" ? { ...override, hidden: false, done: true } : override
        )
      },
      templateId,
      { ...dailyDraft("Вечерняя зарядка"), startDate: today },
      "following",
      today
    );

    expect(listOnDate(split, "2026-11-03", today)[0]?.done).toBe(true);
    expect(listOnDate(split, "2026-11-03", today)[0]?.title).toBe("Зарядка");
    expect(listOnDate(split, today, today)[0]?.title).toBe("Вечерняя зарядка");
  });

  it("быстрое дело создаёт одноразовую рутину на выбранную дату", () => {
    const library = addOneOff(createEmptyLibrary(), "Вынести мусор", today);

    expect(listOnDate(library, today, today)).toHaveLength(1);
    expect(listOnDate(library, "2026-11-05", today)).toEqual([]);
  });
});

export type RoutineDayOffset = -1 | 0 | 1;

export type RoutineOccurrence = Readonly<{
  id: string;
  title: string;
  dayOffset: RoutineDayOffset;
  done: boolean;
}>;

export const ROUTINE_DAY_OPTIONS: readonly Readonly<{
  offset: RoutineDayOffset;
  label: string;
}>[] = [
  { offset: -1, label: "Вчера" },
  { offset: 0, label: "Сегодня" },
  { offset: 1, label: "Завтра" }
];

export function getDayOccurrences(
  items: readonly RoutineOccurrence[],
  dayOffset: RoutineDayOffset
): RoutineOccurrence[] {
  return items.filter((item) => item.dayOffset === dayOffset);
}

export function getDayProgress(
  items: readonly RoutineOccurrence[],
  dayOffset: RoutineDayOffset
): Readonly<{ done: number; total: number }> {
  const occurrences = getDayOccurrences(items, dayOffset);
  return {
    done: occurrences.filter((item) => item.done).length,
    total: occurrences.length
  };
}

export function isMissedOccurrence(
  item: RoutineOccurrence,
  dayOffset: RoutineDayOffset
): boolean {
  return dayOffset === -1 && item.dayOffset === -1 && !item.done;
}

export function toggleOccurrence(
  items: readonly RoutineOccurrence[],
  id: string
): {
  items: RoutineOccurrence[];
  previous: RoutineOccurrence | null;
} {
  const previous = items.find((item) => item.id === id) ?? null;

  return {
    previous,
    items: items.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
  };
}

export function restoreOccurrence(
  items: readonly RoutineOccurrence[],
  previous: RoutineOccurrence
): RoutineOccurrence[] {
  return items.map((item) => (item.id === previous.id ? previous : item));
}

export function addOccurrence(
  items: readonly RoutineOccurrence[],
  title: string,
  dayOffset: RoutineDayOffset
): RoutineOccurrence[] {
  const trimmed = title.trim();

  if (trimmed.length === 0) {
    return [...items];
  }

  return [
    ...items,
    {
      id: `quick-${dayOffset}-${items.length}-${trimmed.toLocaleLowerCase("ru")}`,
      title: trimmed,
      dayOffset,
      done: false
    }
  ];
}

import type { RoutineOccurrence } from "./routine-day";

export const MOCK_ROUTINE_OCCURRENCES: readonly RoutineOccurrence[] = [
  { id: "water", title: "Выпить 1 литр воды", dayOffset: 0, done: true },
  { id: "cat", title: "Погладить кота", dayOffset: 0, done: false },
  { id: "exercise", title: "Сделать зарядку", dayOffset: 0, done: false },
  { id: "journal", title: "Записать мысли", dayOffset: -1, done: true },
  { id: "walk", title: "Прогулка 20 минут", dayOffset: -1, done: false },
  { id: "read", title: "Читать 20 минут", dayOffset: 1, done: false },
  { id: "stretch", title: "Растяжка перед сном", dayOffset: 1, done: false }
];

export type RoutineStatus = "active" | "paused" | "completed";

export type RoutineFilterItem = Readonly<{
  status: RoutineStatus;
  title: string;
}>;

export function filterRoutines<T extends RoutineFilterItem>(
  routines: readonly T[],
  status: RoutineStatus,
  query: string
): T[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("ru");

  return routines.filter(
    (routine) =>
      routine.status === status &&
      (normalizedQuery.length === 0 ||
        routine.title.toLocaleLowerCase("ru").includes(normalizedQuery))
  );
}

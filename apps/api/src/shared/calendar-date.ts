const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function calendarDate(value: string): Date | null {
  if (!DATE_PATTERN.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || formatCalendarDate(date) !== value) {
    return null;
  }

  return date;
}

export function formatCalendarDate(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function requiredCalendarDate(value: string): Date {
  const date = calendarDate(value);

  if (!date) {
    throw new Error("Некорректная дата рутины");
  }

  return date;
}

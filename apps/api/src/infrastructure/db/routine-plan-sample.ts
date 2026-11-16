import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

export const PLAN_SAMPLE_USER_NAME = "Проверка плана рутин";

// На пустой таблице partial-индексы (user_id, status) и (user_id, start_date)
// стоят одинаково. Короткая выборка одного пользователя делает индекс статуса дешевле.
const SAMPLE_ROWS = 40;

type StatementClient = Prisma.TransactionClient | PrismaClient;

export async function prepareRoutineStatusSample(
  tx: StatementClient,
  userId: string
): Promise<void> {
  await tx.user.create({
    data: {
      id: userId,
      displayName: PLAN_SAMPLE_USER_NAME,
      locale: "ru",
      timezone: "Europe/Moscow"
    }
  });
  await tx.routineRule.createMany({
    data: Array.from({ length: SAMPLE_ROWS }, (_, index) => ({
      userId,
      title: "Вода",
      startDate: new Date(Date.UTC(2026, 0, (index % 28) + 1)),
      recurrenceKind: "daily",
      recurrenceDays: [],
      timezone: "Europe/Moscow",
      status: index % 2 === 0 ? "active" : "paused"
    }))
  });
  await tx.$executeRaw`ANALYZE "routine_rules"`;
}

export async function prepareRoutineReminderSample(
  tx: StatementClient,
  userId: string
): Promise<void> {
  await tx.user.create({
    data: {
      id: userId,
      displayName: PLAN_SAMPLE_USER_NAME,
      locale: "ru",
      timezone: "Europe/Moscow"
    }
  });
  await tx.routineRule.createMany({
    data: Array.from({ length: SAMPLE_ROWS }, (_, index) => {
      const reminded = index % 4 !== 0;
      const minute = String(index % 60).padStart(2, "0");

      return {
        userId,
        title: "Вода",
        startDate: new Date(Date.UTC(2026, 0, (index % 28) + 1)),
        recurrenceKind: "daily" as const,
        recurrenceDays: [],
        reminderLocalTime: reminded ? `08:${minute}` : null,
        timezone: "Europe/Moscow",
        status: reminded ? ("active" as const) : ("paused" as const),
        deletedAt: index % 5 === 0 ? new Date("2026-11-01T00:00:00.000Z") : null
      };
    })
  });
  await tx.$executeRaw`ANALYZE "routine_rules"`;
}

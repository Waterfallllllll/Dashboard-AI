import { describe, expect, it } from "vitest";

import { API_ERROR_CODES, RESTORE_EXPIRED } from "@dashboard/contracts";

import { MemoryRoutinesRepository } from "../personal-memory.js";
import { RoutinesService } from "./routines.service.js";
import type { RoutinesRepository } from "./routines.repository.js";

const owner = "a".repeat(24);
const actor = { userId: owner, sessionId: "session" };
let clock = new Date("2026-11-11T09:00:00.000Z");

function service() {
  return new RoutinesService(new MemoryRoutinesRepository(), () => clock);
}

describe("рутины пользователя", () => {
  it("показывает дело на дату, сохраняет выполнение и не отдаёт чужой экземпляр", async () => {
    const routines = service();
    const created = await routines.create(
      actor,
      {
        title: "Зарядка",
        startDate: "2026-11-11",
        recurrence: { kind: "daily" }
      },
      "Europe/Moscow",
      "routine-key-001"
    );
    const replay = await routines.create(
      actor,
      {
        title: "Другое имя",
        startDate: "2026-11-12",
        recurrence: { kind: "once" }
      },
      "Europe/Moscow",
      "routine-key-001"
    );
    expect(replay.rule.id).toBe(created.rule.id);
    expect(replay.replayed).toBe(true);

    const day = await routines.listDay(actor, "2026-11-11", "2026-11-11");
    expect(day.items).toHaveLength(1);
    const item = day.items[0];

    if (!item) {
      throw new Error("Дело не создано");
    }

    const done = await routines.updateOccurrence(actor, item.id, { status: "done" });
    expect(done.status).toBe("done");
    expect(done.completedAt).toBe(clock.toISOString());

    const repository: Pick<RoutinesRepository, "findOccurrence"> = {
      async findOccurrence() {
        return {
          id: item.id,
          userId: "b".repeat(24),
          ruleId: created.rule.id,
          localDate: "2026-11-11",
          titleOverride: null,
          status: "pending",
          completedAt: null,
          excludedAt: null
        };
      }
    };
    const foreign = new RoutinesService(repository as RoutinesRepository, () => clock);
    await expect(
      foreign.updateOccurrence({ userId: owner, sessionId: "session" }, item.id, { status: "done" })
    ).rejects.toMatchObject({ code: API_ERROR_CODES.notFound });
  });

  it("делит серию с выбранной даты и разрешает отмену удаления только пять секунд", async () => {
    const routines = service();
    const created = await routines.create(
      actor,
      { title: "Вода", startDate: "2026-11-01", recurrence: { kind: "daily" } },
      "Europe/Moscow",
      null
    );
    const split = await routines.update(actor, created.rule.id, {
      scope: "following",
      date: "2026-11-11",
      title: "Вода дальше"
    });
    expect(split.replacedRuleId).toBe(created.rule.id);
    expect(split.rule.startDate).toBe("2026-11-11");

    const today = await routines.listDay(actor, "2026-11-11", "2026-11-11");
    expect(today.items.map((item) => item.title)).toEqual(["Вода дальше"]);
    const yesterday = await routines.listDay(actor, "2026-11-10", "2026-11-11");
    expect(yesterday.items.map((item) => item.title)).toEqual(["Вода"]);

    await routines.remove(actor, split.rule.id);
    const restored = await routines.restore(actor, split.rule.id);
    expect(restored.title).toBe("Вода дальше");

    await routines.remove(actor, split.rule.id);
    clock = new Date(clock.getTime() + 6_000);
    await expect(routines.restore(actor, split.rule.id)).rejects.toMatchObject({
      code: RESTORE_EXPIRED
    });
  });
});

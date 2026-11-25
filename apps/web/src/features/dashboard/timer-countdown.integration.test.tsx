import { dashboardSchema } from "@dashboard/contracts";
import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithUser } from "@/test/render";

import { DashboardBoard } from "./components/dashboard-board";
import { sampleDashboardBody } from "./model/sample-dashboard";

const readyDashboard = dashboardSchema.parse(sampleDashboardBody);

describe("таймер на дашборде", () => {
  it("уменьшает оставшееся время после старта", async () => {
    const { user } = renderWithUser(
      <DashboardBoard
        loadDay={async () => ({ status: "ready" as const, dashboard: readyDashboard })}
      />
    );
    const timer = await screen.findByRole("article", { name: "Таймер" });

    expect(timer).toHaveTextContent("25:00");
    await user.click(within(timer).getByRole("button", { name: "Старт" }));

    await waitFor(
      () => {
        expect(timer.textContent ?? "").toMatch(/24:5\d/);
      },
      { timeout: 3_000 }
    );
  });
});

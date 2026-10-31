import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { WidgetErrorBoundary } from "./widget-error-boundary";

function BrokenWidget(): ReactNode {
  throw new Error("widget crashed");
}

describe("WidgetErrorBoundary", () => {
  it("не даёт ошибке одного виджета погасить соседние", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <div>
        <WidgetErrorBoundary title="Таймер">
          <BrokenWidget />
        </WidgetErrorBoundary>
        <p>Погода продолжает работать</p>
      </div>
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Не удалось показать виджет");
    expect(screen.getByText("Погода продолжает работать")).toBeInTheDocument();
    errorSpy.mockRestore();
  });
});

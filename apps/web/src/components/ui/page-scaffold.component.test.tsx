import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageScaffold } from "./page-scaffold";

describe("PageScaffold", () => {
  it("связывает заголовок страницы с секцией", () => {
    render(
      <PageScaffold description="Описание раздела" eyebrow="Сегодня" title="Ваш день">
        <p>Контент</p>
      </PageScaffold>
    );

    expect(screen.getByRole("heading", { level: 1, name: "Ваш день" })).toHaveAttribute(
      "id",
      "page-title"
    );
    expect(screen.getByRole("region", { name: "Ваш день" })).toBeInTheDocument();
    expect(screen.getByText("Контент")).toBeInTheDocument();
  });
});

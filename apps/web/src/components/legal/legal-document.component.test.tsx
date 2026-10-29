import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LegalDocument } from "./legal-document";

describe("LegalDocument", () => {
  it("строит содержание с якорными ссылками на разделы", () => {
    render(
      <LegalDocument
        description="Кратко о данных"
        sections={[
          {
            id: "data",
            title: "Какие данные используются",
            paragraphs: ["Только необходимые данные."],
            items: ["Имя и аватар"]
          }
        ]}
        title="Политика конфиденциальности"
        updatedAt="октябрь 2026"
      />
    );

    expect(
      screen.getByRole("navigation", { name: "Содержание документа «Политика конфиденциальности»" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Какие данные используются" })).toHaveAttribute(
      "href",
      "#data"
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Какие данные используются" }).closest("section")
    ).toHaveAttribute("id", "data");
  });
});

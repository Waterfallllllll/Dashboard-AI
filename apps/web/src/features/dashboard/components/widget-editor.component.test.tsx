import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { renderWithUser } from "@/test/render";

import { resetWidgetPreferencesStoreForTests } from "../model/widget-preferences-store";
import { WidgetEditor } from "./widget-editor";

describe("WidgetEditor", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetWidgetPreferencesStoreForTests();
  });

  it("меняет порядок кнопками и запрещает размер с пустым промежутком", async () => {
    const { user } = renderWithUser(<WidgetEditor />);
    const weather = screen.getByRole("listitem", { name: "Погода" });

    expect(within(weather).getByRole("radio", { name: "Стандартный" })).toBeDisabled();
    expect(within(weather).getByRole("radio", { name: "Широкий" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Поднять «Дата и время»" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Поднять «Таймер»" }));

    expect(screen.getAllByRole("listitem").map((item) => item.getAttribute("aria-label"))).toEqual([
      "Дата и время",
      "Таймер",
      "Погода",
      "Календарь",
      "Рутины",
      "Новости"
    ]);
  });

  it("возвращает настройки только после подтверждения", async () => {
    const { user } = renderWithUser(<WidgetEditor />);

    await user.click(screen.getByRole("switch", { name: "Показывать «Новости»" }));
    await user.click(screen.getByRole("button", { name: "Вернуть настройки по умолчанию" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "Вернуть виджеты к исходному порядку"
    );
    expect(screen.getByRole("switch", { name: "Показывать «Новости»" })).not.toBeChecked();

    await user.click(screen.getByRole("button", { name: "Вернуть" }));

    expect(screen.getByRole("switch", { name: "Показывать «Новости»" })).toBeChecked();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

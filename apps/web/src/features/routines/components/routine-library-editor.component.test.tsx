import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { renderWithUser } from "@/test/render";

import { resetRoutineLibraryStoreForTests } from "../model/routine-library-store";

import { RoutineLibraryEditor } from "./routine-library-editor";

describe("RoutineLibraryEditor", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetRoutineLibraryStoreForTests();
  });

  it("сохраняет рутину и предупреждает о таком же названии", async () => {
    const { user } = renderWithUser(<RoutineLibraryEditor />);

    await user.type(screen.getByRole("textbox", { name: "Название" }), "Вечерняя прогулка");
    await user.click(screen.getByRole("button", { name: "Сохранить рутину" }));

    expect(screen.getByRole("heading", { name: "Вечерняя прогулка" })).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "Название" }), "Вечерняя прогулка");
    expect(screen.getByRole("status")).toHaveTextContent("Уже есть рутина с таким названием");
  });
});

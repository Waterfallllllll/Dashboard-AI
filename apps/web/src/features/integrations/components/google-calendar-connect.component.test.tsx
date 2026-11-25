import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CalendarConnectError } from "../api/connect-google-calendar";

import { GoogleCalendarConnect } from "./google-calendar-connect";

describe("GoogleCalendarConnect", () => {
  it("открывает адрес Google после явного нажатия", async () => {
    const connect = vi.fn().mockResolvedValue("https://accounts.google.com/o/oauth2/v2/auth");
    const navigate = vi.fn();
    const user = userEvent.setup();

    render(<GoogleCalendarConnect connect={connect} navigate={navigate} />);
    await user.click(screen.getByRole("button", { name: "Подключить календарь" }));

    expect(connect).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith("https://accounts.google.com/o/oauth2/v2/auth");
  });

  it("предлагает вход, если сессии нет", async () => {
    const user = userEvent.setup();

    render(
      <GoogleCalendarConnect
        connect={vi.fn().mockRejectedValue(new CalendarConnectError("unauthenticated"))}
      />
    );
    await user.click(screen.getByRole("button", { name: "Подключить календарь" }));

    expect(screen.getByRole("link", { name: "Войти через Google" })).toHaveAttribute(
      "href",
      "/api/v1/auth/google"
    );
  });

  it("не предлагает подключить календарь, если он уже подключён", () => {
    render(<GoogleCalendarConnect status="connected" />);

    expect(screen.queryByRole("button", { name: "Подключить календарь" })).not.toBeInTheDocument();
    expect(screen.getByText("Календарь подключён. Доступ только на чтение.")).toBeInTheDocument();
  });
});

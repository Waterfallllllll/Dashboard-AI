import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithUser } from "@/test/render";

import { WebPushControls } from "./web-push-controls";

const PUBLIC_KEY = Buffer.from(
  Uint8Array.from({ length: 65 }, (_, index) => (index === 0 ? 4 : index))
).toString("base64url");

describe("WebPushControls", () => {
  it("не запрашивает разрешение, пока доставка недоступна", async () => {
    const requestPermission = vi.fn();
    vi.stubGlobal("Notification", { permission: "default", requestPermission });
    renderWithUser(<WebPushControls publicKey="" />);

    const button = await screen.findByRole("button", {
      name: "Включить доставку при закрытой вкладке"
    });

    expect(button).toBeDisabled();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/не принимает Web Push|ключ Web Push не задан/)
    ).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("подписывается только после нажатия и не пишет ключ в localStorage", async () => {
    const subscribe = vi.fn().mockResolvedValue({ endpoint: "https://push.example/subscription" });
    const requestPermission = vi.fn().mockResolvedValue("granted");
    vi.stubGlobal("Notification", { permission: "default", requestPermission });
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: class PushManager {}
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistration: vi.fn().mockResolvedValue(null),
        register: vi.fn().mockResolvedValue({
          pushManager: { subscribe }
        })
      }
    });
    const { user } = renderWithUser(<WebPushControls publicKey={PUBLIC_KEY} />);

    const button = await screen.findByRole("button", {
      name: "Включить доставку при закрытой вкладке"
    });
    await waitFor(() => {
      expect(button).toBeEnabled();
    });
    expect(requestPermission).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
    await user.click(button);

    expect(requestPermission).toHaveBeenCalledOnce();
    expect(subscribe).toHaveBeenCalledOnce();
    expect(JSON.stringify(window.localStorage)).not.toContain("push.example");
    vi.unstubAllGlobals();
  });
});

"use client";

import { useEffect, useState } from "react";

export function useTickingNow(enabled = true, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function tick() {
      setNow(Date.now());
    }

    tick();
    const intervalId = window.setInterval(tick, intervalMs);

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        tick();
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, intervalMs]);

  return now;
}

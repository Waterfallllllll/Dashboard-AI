"use client";

import { useEffect } from "react";

import { registerAppServiceWorker } from "../model/register-service-worker";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    void registerAppServiceWorker();
  }, []);

  return null;
}

import { parsePushMessage, safeNotificationPath } from "./push-contract.js";

const SHELL_CACHE = "evergreen-shell-v1";
const STATIC_CACHE = "evergreen-static-v2";
const STATIC_CACHE_LIMIT = 60;
const SHELL_URLS = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== STATIC_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(event.request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(immutableStatic(event.request));
    return;
  }

  if (url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirstStatic(event.request));
  }
});

self.addEventListener("push", (event) => {
  let payload = null;

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = null;
    }
  }

  const message = parsePushMessage(payload);

  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: message.tag,
      data: { path: message.path }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = safeNotificationPath(event.notification?.data?.path);
  event.waitUntil(focusOrOpen(path));
});

async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    return (await cache.match("/offline.html")) ?? Response.error();
  }
}

async function immutableStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  if (cached && isImmutable(cached)) {
    return cached;
  }

  const response = await fetch(request);

  if (response.ok && isImmutable(response)) {
    await cache.put(request, response.clone());
    await trimCache(cache, STATIC_CACHE_LIMIT);
  }

  return response;
}

function isImmutable(response) {
  return (response.headers.get("cache-control") ?? "").includes("immutable");
}

async function cacheFirstStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (response.ok) {
    await cache.put(request, response.clone());
    await trimCache(cache, STATIC_CACHE_LIMIT);
  }

  return response;
}

async function trimCache(cache, limit) {
  const keys = await cache.keys();
  const extra = keys.length - limit;

  if (extra <= 0) {
    return;
  }

  await Promise.all(keys.slice(0, extra).map((key) => cache.delete(key)));
}

async function focusOrOpen(path) {
  const absolute = new URL(path, self.location.origin).href;
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

  for (const client of windows) {
    if (!client.url.startsWith(self.location.origin)) {
      continue;
    }

    if ("focus" in client) {
      await client.focus();
    }

    if ("navigate" in client) {
      try {
        await client.navigate(absolute);
      } catch {
        // Окно уже открыто: переход по уведомлению необязателен.
      }
    }

    return;
  }

  await self.clients.openWindow(absolute);
}

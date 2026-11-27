"use client";

const STATIC_CACHE_VERSION = "evergreen-static-v2";

const resetScript = `
  try {
    var version = ${JSON.stringify(STATIC_CACHE_VERSION)};
    if (localStorage.getItem("evergreen-static-cache") === version || !navigator.serviceWorker) {
      // Версия кэша уже совпадает.
    } else {
      navigator.serviceWorker.getRegistration().then(function (registration) {
        if (!registration) {
          localStorage.setItem("evergreen-static-cache", version);
          return;
        }

        return registration.update().then(function () {
          var worker = registration.installing || registration.waiting;
          if (!worker) {
            return;
          }

          return new Promise(function (resolve) {
            function finished() {
              if (worker.state === "activated" || worker.state === "redundant") {
                resolve();
              }
            }

            worker.addEventListener("statechange", finished);
            finished();
          });
        }).then(function () {
          return caches.keys();
        }).then(function (keys) {
          return Promise.all(keys.filter(function (key) {
            return key.indexOf("evergreen-static-v1") === 0;
          }).map(function (key) {
            return caches.delete(key);
          }));
        }).then(function () {
          localStorage.setItem("evergreen-static-cache", version);
          location.reload();
        });
      }).catch(function () {});
    }
  } catch (error) {}
`;

export function StaticCacheResetScript() {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: resetScript }}
      suppressHydrationWarning
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
    />
  );
}

/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = "showcase-v2";

self.addEventListener("install", (event) => {
  // Don't precache — let the first navigation populate the cache naturally.
  // Precaching "/" can store a redirected response which Safari rejects.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Navigation requests: network-first, cache fallback for offline
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Only cache non-redirected, successful responses
          if (response.ok && !response.redirected) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", clone));
          }
          return response;
        })
        .catch(() =>
          caches.match("/index.html").then((cached) => cached ?? new Response("Offline", { status: 503 })),
        ),
    );
    return;
  }

  // Showcase data: network-first
  if (url.pathname.endsWith("showcase.json")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached ?? new Response("Offline", { status: 503 }))),
    );
    return;
  }

  // Everything else (JS, CSS, fonts, images): cache-first
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ??
        fetch(event.request).then((response) => {
          if (response.ok && !response.redirected && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        }),
    ),
  );
});

export {};

// Service worker: la app abre al instante y aguanta sin cobertura.
// - Archivos estáticos (JS, CSS, iconos, fuentes): de la caché y, si no están, de la red.
// - Pantallas: siempre de la red; si no hay conexión, la última versión guardada.
const CACHE = "panel-v5";
const PAGES = "panel-pages-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== PAGES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  if (req.mode === "navigate" && !url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(url.pathname, copy));
          }
          return res;
        })
        .catch(() => caches.match(url.pathname, { cacheName: PAGES }).then((hit) => hit || caches.match("/", { cacheName: PAGES }))),
    );
    return;
  }

  const isStatic = url.pathname.startsWith("/_next/static/") || /\.(png|ico|webmanifest|woff2)$/.test(url.pathname);
  if (!isStatic) return;
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

// --- Notificaciones ---
self.addEventListener("push", (event) => {
  let data = { title: "moi.", body: "", url: "/" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    /* sin datos */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/logo-m-192.png",
      badge: "/logo-m-192.png",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

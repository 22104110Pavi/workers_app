// =========================================================
// SafeWorker PWA — sw.js  v2.2
// Update this CACHE_NAME version string each deployment
// to trigger the "Update Available" banner in the app.
// =========================================================

const CACHE_NAME = 'safeworker-v2.2';   // ← bump this on every release

const PRECACHE = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icon-192.png',
];

// ── INSTALL ──────────────────────────────────────────────
self.addEventListener('install', event => {
  // Do NOT skipWaiting here — let the app control the update timing
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .catch(() => {})
  );
});

// ── ACTIVATE ─────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// ── FETCH ─────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // NETWORK ONLY — ThingSpeak (safety data must always be live)
  if (url.hostname.includes('thingspeak.com') ||
      url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    return;
  }

  // CACHE FIRST with network fallback for same-origin assets
  if (url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        const cache  = await caches.open(CACHE_NAME);
        const cached = await cache.match(event.request);
        if (cached) {
          // Refresh in background
          fetch(event.request).then(res => {
            if (res && res.ok) cache.put(event.request, res.clone()).catch(() => {});
          }).catch(() => {});
          return cached;
        }
        try {
          const res = await fetch(event.request);
          if (res && res.ok && event.request.method === 'GET') {
            cache.put(event.request, res.clone()).catch(() => {});
          }
          return res;
        } catch {
          return cache.match('./index.html');
        }
      })()
    );
  }
});

// ── MESSAGE — app triggers skipWaiting via applyUpdate() ──
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting(); // take control → triggers controllerchange → page reloads
  }
});

// ── PUSH NOTIFICATIONS ────────────────────────────────────
self.addEventListener('push', event => {
  let data = { title: 'SafeWorker', body: 'Check your dashboard.' };
  try { if (event.data) data = event.data.json(); } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:     data.body,
      icon:     './icon-192.png',
      badge:    './icon-192.png',
      tag:      'safeworker',
      renotify: true,
      vibrate:  [200, 100, 200, 100, 400],
      actions:  [{ action: 'open', title: 'Open App' }]
    })
  );
});

// ── NOTIFICATION CLICK ────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow('./');
    })
  );
});

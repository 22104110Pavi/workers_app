

// =========================================================
// SafeWorker PWA — sw.js
// Service Worker v2.1
// Handles: offline caching, push notifications, background sync
// =========================================================
 
const CACHE_NAME  = 'safeworker-v2.1';
 
// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icon-192.png',
];
 
// ── INSTALL ──────────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
 
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .catch(err => console.warn('[SW] Pre-cache partial failure:', err))
  );
});
 
// ── ACTIVATE ─────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
      await self.clients.claim();
      console.log('[SW] Activated — cache:', CACHE_NAME);
    })()
  );
});
 
// ── FETCH ────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
 
  // NETWORK ONLY — ThingSpeak API (safety data must always be fresh)
  if (url.hostname === 'api.thingspeak.com' || url.hostname.includes('thingspeak')) {
    return; // fall through to network, no caching
  }
 
  // NETWORK FIRST with cache fallback — Google Fonts
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
 
  // CACHE FIRST — same-origin static assets (stale-while-revalidate)
  if (url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        const cache  = await caches.open(CACHE_NAME);
        const cached = await cache.match(event.request);
 
        // Always fetch fresh in background
        const fetchPromise = fetch(event.request)
          .then(res => {
            if (res && res.ok && event.request.method === 'GET') {
              cache.put(event.request, res.clone()).catch(() => {});
            }
            return res;
          })
          .catch(() => null);
 
        // Return cached immediately, network as update
        return cached || fetchPromise || cache.match('./index.html');
      })()
    );
  }
});
 
// ── PUSH NOTIFICATIONS ───────────────────────────────────
self.addEventListener('push', event => {
  let data = { title: 'SafeWorker Alert', body: 'Check your dashboard.' };
  try {
    if (event.data) data = event.data.json();
  } catch {
    data.body = event.data ? event.data.text() : 'New safety alert.';
  }
 
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:     data.body,
      icon:     './icon-192.png',
      badge:    './icon-192.png',
      tag:      'safeworker-push',
      renotify: true,
      vibrate:  [200, 100, 200, 100, 400],
      actions: [
        { action: 'open',    title: 'Open Dashboard' },
        { action: 'dismiss', title: 'Dismiss' },
      ]
    })
  );
});
 
// ── NOTIFICATION CLICK ───────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
 
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        for (const client of list) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow('./');
      })
  );
});
 
// ── MESSAGE HANDLER ──────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING')  self.skipWaiting();
  if (event.data?.type === 'CLEAR_CACHE')   caches.delete(CACHE_NAME);
});
 
console.log('[SW] SafeWorker Service Worker v2.1 ready');

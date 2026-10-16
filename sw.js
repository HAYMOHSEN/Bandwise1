/* Bandwise service worker — offline app shell; exam guide data refreshed from the network when online. */
const VERSION = 'bandwise-v1.1.0';
const SHELL = [
  "./",
  "index.html",
  "app.css",
  "manifest.webmanifest",
  "privacy.html",
  "js/learning.js",
  "js/learning-i18n.js",
  "js/views-learning.js",
  "data/guide.json",
  "js/ai.js",
  "js/analyzer.js",
  "js/app.js",
  "js/charts.js",
  "js/content.js",
  "js/i18n.js",
  "js/runner.js",
  "js/speaking.js",
  "js/tts.js",
  "js/util.js",
  "js/views-home.js",
  "js/views-more.js",
  "js/views-practice.js",
  "js/writing.js",
  "icons/icon-180.png",
  "icons/icon-192-maskable.png",
  "icons/icon-192.png",
  "icons/icon-32.png",
  "icons/icon-512-maskable.png",
  "icons/icon-512.png",
  "icons/icon.svg"
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('bandwise-') && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // Exam guide: network first, so rule changes reach installed apps without a Store update.
  if (url.pathname.endsWith('/data/guide.json')) {
    event.respondWith(fetch(req).then(res => { if (!res.ok) throw new Error('Guide unavailable'); const copy = res.clone(); event.waitUntil(caches.open(VERSION).then(c => c.put(req, copy))); return res; }).catch(() => caches.match(req)));
    return;
  }
  // App shell: cache first, falling back to the network; navigations fall back to index.html.
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => req.mode === 'navigate' ? caches.match('index.html') : undefined))
  );
});

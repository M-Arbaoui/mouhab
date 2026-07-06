/* ═══════════════════════════════════════════════
   Watchy. — Service Worker v3
   Cache-first: app shell + images
   Network-first: TMDB API
   Never cache: stream embeds
   ═══════════════════════════════════════════════ */
const CACHE     = 'watchy-shell-v3';
const API_CACHE = 'watchy-api-v3';
const IMG_CACHE = 'watchy-img-v3';

const SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './manifest.json',
  './og-image.png',
  './icon-192.png',
  './icon-512.png',
];

const EMBED_HOSTS = new Set([
  'vidsrc.to','vidsrc.xyz','2embed.cc',
  'vidking.net','ezvidapi.com','streamdb.dev',
  'videasy.net','vidnest.online','p-stream.co',
  'youtube.com','youtube-nocookie.com','youtu.be',
]);

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => ![CACHE, API_CACHE, IMG_CACHE].includes(k))
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never intercept embeds, YouTube, or extension requests
  if ([...EMBED_HOSTS].some(h => url.hostname.includes(h))) return;
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

  // TMDB API — network-first, stale fallback, 8s timeout
  if (url.hostname === 'api.themoviedb.org') {
    e.respondWith(networkFirst(e.request, API_CACHE, 8000));
    return;
  }

  // TMDB images — cache-first
  if (url.hostname === 'image.tmdb.org') {
    e.respondWith(cacheFirst(e.request, IMG_CACHE));
    return;
  }

  // Google Fonts — cache-first
  if (url.hostname.includes('fonts.g')) {
    e.respondWith(cacheFirst(e.request, CACHE));
    return;
  }

  // App shell — cache-first
  if (url.hostname === self.location.hostname) {
    e.respondWith(cacheFirst(e.request, CACHE));
  }
});

async function cacheFirst(req, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok && res.status < 400) cache.put(req, res.clone());
    return res;
  } catch(_) {
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

async function networkFirst(req, cacheName, timeoutMs = 8000) {
  const cache = await caches.open(cacheName);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(req, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch(_) {
    clearTimeout(timer);
    return cache.match(req) ||
      new Response('{"results":[]}', {
        headers: { 'Content-Type': 'application/json' }
      });
  }
}

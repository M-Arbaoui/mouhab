/* ═══════════════════════════════════════════════
  Watchy. — Service Worker v10
   Cache-first: app shell + images
   Network-first: TMDB API
   Never cache: stream embeds
   ═══════════════════════════════════════════════ */
const CACHE     = 'watchy-shell-v10';
const API_CACHE = 'watchy-api-v5';
const IMG_CACHE = 'watchy-img-v5';

const SHELL = [
  './',
  './index.html',
  './css/style.min.css',
  './css/wordmark.css',
  './css/fieldnotes.css',
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
  'vidrift.net','ani.pm',
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
        keys.filter(k => k.startsWith('watchy-') && ![CACHE, API_CACHE, IMG_CACHE].includes(k))
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

  // App shell — network-first, cache as the offline fallback.
  if (url.hostname === self.location.hostname && e.request.method === 'GET') {
    e.respondWith(shellNetworkFirst(e.request));
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

async function shellNetworkFirst(req) {
  const cache = await caches.open(CACHE);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(req, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch(_) {
    clearTimeout(timer);
    return (await cache.match(req)) ||
      new Response('', { status: 503, statusText: 'Offline' });
  }
}
/* Watchy. — root-scoped service worker
 * Network-first app shell, network-first TMDB API, cache-first TMDB images.
 * Stream embeds are never intercepted or cached.
 */
'use strict';

const CACHE = 'watchy-shell-v6';
const API_CACHE = 'watchy-api-v6';
const IMG_CACHE = 'watchy-img-v6';

const SHELL = [
  './',
  './index.html',
  './css/style.min.css',
  './js/app.min.js',
  './manifest.json',
  './og-image.png',
  './icon-192.png',
  './icon-512.png',
];

const EMBED_HOSTS = new Set([
  'vidsrc.to', 'vidsrc.xyz', 'vidsrc.sbs', 'vidsrc.cc',
  '2embed.cc', 'vidking.net', 'ezvidapi.com', 'streamdb.dev',
  'videasy.net', 'vidnest.online', 'p-stream.co', 'vidrift.net',
  'ani.pm', 'framextv.xyz', 'framextv.cc',
  'youtube.com', 'youtube-nocookie.com', 'youtu.be',
]);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => ![CACHE, API_CACHE, IMG_CACHE].includes(key))
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept stream embeds or extension/non-web requests.
  if ([...EMBED_HOSTS].some(host =>
    url.hostname === host || url.hostname.endsWith('.' + host)
  )) return;
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

  if (url.hostname === 'api.themoviedb.org') {
    event.respondWith(networkFirst(event.request, API_CACHE, 8000));
    return;
  }

  if (url.hostname === 'image.tmdb.org') {
    event.respondWith(cacheFirst(event.request, IMG_CACHE));
    return;
  }

  if (url.hostname.includes('fonts.g')) {
    event.respondWith(cacheFirst(event.request, CACHE));
    return;
  }

  if (url.origin === self.location.origin && event.request.method === 'GET') {
    event.respondWith(networkFirst(event.request, CACHE, 4000));
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (_) {
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

async function networkFirst(request, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (_) {
    clearTimeout(timer);
    const cached = await cache.match(request);
    if (cached) return cached;

    if (cacheName === API_CACHE) {
      return new Response('{"results":[]}', {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

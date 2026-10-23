/* ═══════════════════════════════════════════════
   Watchy. — Nuvio compatibility helpers
   Isolated from playback. Does not fetch streams.
   ═══════════════════════════════════════════════ */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WatchyNuvio = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TOKEN_RE = /(?:token|auth|signature|sig|expires|exp|key|cookie|authorization)=[^&\s]+/gi;
  const SENSITIVE_HEADER = /^(authorization|cookie|set-cookie|x-api-key|proxy-authorization)$/i;

  const INTEGRATION = Object.freeze({
    id: 'nuvio_compat',
    providerName: 'Nuvio',
    category: 'addon',
    enabled: false,
    streamResolution: false,
    supportedMediaTypes: Object.freeze(['movie', 'series']),
    supportedPlaybackTypes: Object.freeze([]),
    officialApi: 'https://api.nuvio.tv',
    officialDocs: 'https://nuvio.tv/docs',
    reason:
      'Nuvio’s public API syncs profiles, addons, library, and watch progress. It does not resolve playable media. Community Nuvio “providers” are sandboxed scrapers for the Nuvio apps, not a supported Watchy playback interface.',
  });

  function nuvioVideoId(mediaType, tmdbId, season, episode) {
    const id = String(tmdbId == null ? '' : tmdbId).trim();
    if (!/^\d+$/.test(id)) return null;
    const type = mediaType === 'tv' || mediaType === 'series' ? 'tv' : mediaType === 'movie' ? 'movie' : null;
    if (!type) return null;
    if (type === 'movie') return `tmdb:${id}`;
    const s = Number(season);
    const e = Number(episode);
    if (!Number.isInteger(s) || !Number.isInteger(e) || s < 1 || e < 1) return null;
    return `tmdb:${id}:${s}:${e}`;
  }

  function parseNuvioVideoId(videoId) {
    if (typeof videoId !== 'string') return null;
    const m = videoId.trim().match(/^tmdb:(\d+)(?::(\d+):(\d+))?$/);
    if (!m) return null;
    if (m[2] == null) return { mediaType: 'movie', tmdbId: m[1] };
    return {
      mediaType: 'series',
      tmdbId: m[1],
      season: Number(m[2]),
      episode: Number(m[3]),
    };
  }

  function isAllowedUrl(value) {
    if (typeof value !== 'string' || value.length > 2048) return false;
    try {
      const u = new URL(value);
      return u.protocol === 'https:' || u.protocol === 'http:';
    } catch (_) {
      return false;
    }
  }

  function isPrivateHostname(hostname) {
    const h = String(hostname || '').toLowerCase();
    if (h === 'localhost' || h.endsWith('.localhost')) return true;
    if (h === '0.0.0.0' || h === '::1' || h === '[::1]') return true;
    if (/^127\./.test(h)) return true;
    if (/^10\./.test(h)) return true;
    if (/^192\.168\./.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
    if (h.endsWith('.local') || h.endsWith('.internal')) return true;
    return false;
  }

  function canonicalUrl(value) {
    if (!isAllowedUrl(value)) return '';
    try {
      const u = new URL(value);
      if (isPrivateHostname(u.hostname)) return '';
      u.hash = '';
      ['token', 'auth', 'signature', 'sig', 'expires', 'exp', 'key'].forEach((k) => u.searchParams.delete(k));
      return u.toString();
    } catch (_) {
      return '';
    }
  }

  function redact(value) {
    if (value == null) return '';
    return String(value).replace(TOKEN_RE, '$1=redacted');
  }

  function publicError(err) {
    const raw = err && (err.message || err);
    const text = redact(typeof raw === 'string' ? raw : 'Source unavailable');
    if (/token|authorization|cookie|api[_-]?key/i.test(text)) return 'Source unavailable';
    return text.slice(0, 180) || 'Source unavailable';
  }

  function classifyPlayback(url, stream) {
    if (stream && stream.infoHash) return 'unsupported';
    if (stream && stream.ytId) return 'external';
    if (stream && stream.externalUrl && !stream.url) return 'external';
    if (!url) return 'unsupported';
    const path = url.split('?')[0].toLowerCase();
    if (/\.m3u8$/i.test(path) || path.includes('.m3u8')) return 'hls';
    if (/\.mpd$/i.test(path)) return 'dash';
    if (/\.(mp4|webm|mkv|mov)$/i.test(path)) return 'direct';
    if (/\/embed\b|\/player\b|\/directstream\.php/i.test(path)) return 'embed';
    if (stream && stream.behaviorHints && stream.behaviorHints.notWebReady) return 'unsupported';
    return 'embed';
  }

  function playerPathForPlaybackType(playbackType) {
    if (playbackType === 'embed') return 'iframe';
    if (playbackType === 'external') return 'external';
    if (playbackType === 'hls' || playbackType === 'dash' || playbackType === 'direct') {
      return 'unsupported';
    }
    return 'none';
  }

  function headersAreBrowserSafe(headers) {
    if (headers == null) return true;
    if (typeof headers !== 'object' || Array.isArray(headers)) return false;
    const keys = Object.keys(headers);
    if (!keys.length) return true;
    return false;
  }

  function normalizeAddonStream(raw, context) {
    if (!raw || typeof raw !== 'object') return { ok: false, reason: 'malformed' };
    const providerId = String(context && context.providerId || INTEGRATION.id);
    const providerName = String(context && context.providerName || raw.name || INTEGRATION.providerName);
    const mediaType = context && context.mediaType === 'series' ? 'series' : 'movie';

    if (raw.infoHash || raw.sources) {
      return { ok: false, reason: 'unsupported-playback' };
    }
    if (!headersAreBrowserSafe(raw.headers)) {
      return { ok: false, reason: 'headers-required' };
    }

    const url = raw.url || raw.externalUrl || '';
    if (!isAllowedUrl(url)) return { ok: false, reason: 'invalid-url' };
    let parsed;
    try { parsed = new URL(url); } catch (_) { return { ok: false, reason: 'invalid-url' }; }
    if (isPrivateHostname(parsed.hostname)) return { ok: false, reason: 'blocked-host' };

    const playbackType = classifyPlayback(raw.url || '', raw);
    const playerPath = playerPathForPlaybackType(playbackType);
    const quality = typeof raw.quality === 'string' ? raw.quality.slice(0, 24) : undefined;
    const language = typeof raw.language === 'string' ? raw.language.slice(0, 16) : undefined;

    return {
      ok: true,
      source: {
        id: `${providerId}:${canonicalUrl(url) || parsed.origin + parsed.pathname}`,
        providerId,
        providerName,
        mediaType,
        url,
        playbackType,
        playerPath,
        quality,
        language,
        isAvailable: playerPath === 'iframe' || playerPath === 'external',
      },
    };
  }

  function normalizeAddonResponse(payload, context) {
    if (payload == null) return { sources: [], errors: ['empty'] };
    if (typeof payload !== 'object') return { sources: [], errors: ['malformed'] };
    const list = Array.isArray(payload) ? payload : payload.streams;
    if (!Array.isArray(list)) return { sources: [], errors: ['malformed'] };
    const sources = [];
    const errors = [];
    list.forEach((item, i) => {
      const result = normalizeAddonStream(item, context);
      if (result.ok) sources.push(result.source);
      else errors.push({ index: i, reason: result.reason });
    });
    return { sources, errors };
  }

  function dedupeSources(sources) {
    const seen = new Set();
    const out = [];
    (sources || []).forEach((src) => {
      if (!src || !src.url) return;
      const key = canonicalUrl(src.url) || src.url;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(src);
    });
    return out;
  }

  function rankSources(sources, prefs) {
    const selectedId = prefs && prefs.selectedId;
    const userOrder = Array.isArray(prefs && prefs.userPriority) ? prefs.userPriority : [];
    const list = (sources || []).slice();
    list.sort((a, b) => {
      if (selectedId) {
        if (a.id === selectedId && b.id !== selectedId) return -1;
        if (b.id === selectedId && a.id !== selectedId) return 1;
      }
      const ai = userOrder.indexOf(a.providerId);
      const bi = userOrder.indexOf(b.providerId);
      const ap = ai === -1 ? 999 : ai;
      const bp = bi === -1 ? 999 : bi;
      if (ap !== bp) return ap - bp;
      const aOk = a.isAvailable ? 0 : 1;
      const bOk = b.isAvailable ? 0 : 1;
      return aOk - bOk;
    });
    return list;
  }

  function withTimeout(promise, ms, label) {
    const timeoutMs = Number(ms) > 0 ? Number(ms) : 4000;
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label || 'provider'} timed out`)), timeoutMs);
    });
    return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
  }

  async function gatherProviderResults(providers, input, options) {
    const timeoutMs = options && options.timeoutMs != null ? options.timeoutMs : 4000;
    const tasks = (providers || []).map((provider) => {
      const name = provider && provider.id ? provider.id : 'provider';
      const run = typeof provider.resolve === 'function'
        ? Promise.resolve().then(() => provider.resolve(input))
        : Promise.resolve([]);
      return withTimeout(run, timeoutMs, name)
        .then((value) => ({ id: name, ok: true, value: Array.isArray(value) ? value : [] }))
        .catch((err) => ({ id: name, ok: false, error: publicError(err), value: [] }));
    });
    const settled = await Promise.all(tasks);
    const sources = [];
    const failures = [];
    settled.forEach((row) => {
      if (row.ok) sources.push.apply(sources, row.value);
      else failures.push({ providerId: row.id, error: row.error });
    });
    return {
      sources: dedupeSources(sources),
      failures,
    };
  }

  function describeIntegration() {
    return INTEGRATION;
  }

  return {
    INTEGRATION,
    describeIntegration,
    nuvioVideoId,
    parseNuvioVideoId,
    isAllowedUrl,
    isPrivateHostname,
    canonicalUrl,
    redact,
    publicError,
    classifyPlayback,
    playerPathForPlaybackType,
    normalizeAddonStream,
    normalizeAddonResponse,
    dedupeSources,
    rankSources,
    withTimeout,
    gatherProviderResults,
  };
});

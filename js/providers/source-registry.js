/* ═══════════════════════════════════════════════
   Watchy. — source registry metadata
   Playable entries stay in js/app.js SERVERS.
   This file only describes them; it does not add hosts.
   ═══════════════════════════════════════════════ */
(function (root, factory) {
  let nuvio = root.WatchyNuvio;
  if (!nuvio && typeof require === 'function') {
    try { nuvio = require('./nuvio-compat.js'); } catch (_) {}
  }
  const api = factory(nuvio);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.WatchySourceRegistry = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Nuvio) {
  'use strict';

  const DIRECT_PLAYERS = Object.freeze([
    { id: 'vidking', label: 'Vidking', tag: '⭐ Best', defaultPriority: 0 },
    { id: 'vidsrc_xyz', label: 'VidSrc XYZ', tag: 'Reliable', defaultPriority: 1 },
    { id: 'vidsrc_sbs', label: 'VidSrc SBS', tag: 'New', defaultPriority: 2 },
    { id: 'vidsrc_to', label: 'VidSrc', tag: 'Popular', defaultPriority: 3 },
    { id: 'superembed', label: 'SuperEmbed', tag: 'HD', defaultPriority: 4 },
    { id: 'autoembed', label: 'AutoEmbed', tag: '', defaultPriority: 5 },
    { id: 'embedsu', label: 'Embed.su', tag: '', defaultPriority: 6 },
    { id: 'vidsrc2', label: 'VidSrc 2', tag: '', defaultPriority: 7 },
    { id: 'videasy', label: 'Videasy', tag: '', defaultPriority: 8 },
    { id: 'embed2', label: '2Embed', tag: '', defaultPriority: 9 },
    { id: 'vidnest', label: 'VidNest', tag: '', defaultPriority: 10 },
    { id: 'vidlink', label: 'VidLink', tag: '', defaultPriority: 11 },
    { id: 'moviesapi', label: 'MoviesAPI', tag: '', defaultPriority: 12 },
    { id: 'smashystream', label: 'SmashyStream', tag: '', defaultPriority: 13 },
    { id: 'vidjoy', label: 'VidJoy', tag: '', defaultPriority: 14 },
    { id: '111movies', label: '111Movies', tag: '', defaultPriority: 15 },
    { id: 'vidrock', label: 'VidRock', tag: '', defaultPriority: 16 },
    { id: 'hexa', label: 'Hexa', tag: '', defaultPriority: 17 },
    { id: 'vidora', label: 'Vidora', tag: '', defaultPriority: 18 },
    { id: 'vidvault', label: 'VidVault', tag: '', defaultPriority: 19 },
    { id: 'vidapi', label: 'VidAPI', tag: '', defaultPriority: 20 },
  ].map((row) => Object.freeze(Object.assign({
    category: 'direct',
    categoryLabel: 'Direct Players',
    playbackType: 'embed',
    playerPath: 'iframe',
    enabled: true,
    mediaTypes: Object.freeze(['movie', 'tv']),
  }, row))));

  function annotateServer(server, index) {
    const meta = DIRECT_PLAYERS.find((p) => p.id === server.id) || {
      category: 'direct',
      categoryLabel: 'Direct Players',
      playbackType: 'embed',
      playerPath: 'iframe',
      enabled: true,
      defaultPriority: index,
      mediaTypes: ['movie', 'tv'],
    };
    return {
      id: server.id,
      label: server.label,
      tag: server.tag || '',
      category: meta.category,
      categoryLabel: meta.categoryLabel,
      playbackType: meta.playbackType,
      playerPath: meta.playerPath,
      enabled: meta.enabled !== false,
      defaultPriority: meta.defaultPriority,
      mediaTypes: meta.mediaTypes,
    };
  }

  function registerServers(servers) {
    return (servers || []).map(annotateServer);
  }

  function defaultPriorityIds() {
    return DIRECT_PLAYERS.map((p) => p.id);
  }

  function playableForUi(servers) {
    return registerServers(servers).filter((s) => s.enabled);
  }

  function addonIntegrations() {
    const nuvio = Nuvio && Nuvio.describeIntegration ? Nuvio.describeIntegration() : null;
    return nuvio ? [nuvio] : [];
  }

  function resolveEmbedSources(servers, media) {
    const type = media && (media.mediaType === 'tv' || media.mediaType === 'series') ? 'tv' : 'movie';
    const id = media && media.tmdbId;
    const season = media && media.season;
    const episode = media && media.episode;
    const out = [];
    (servers || []).forEach((srv, index) => {
      const meta = annotateServer(srv, index);
      if (!meta.enabled) return;
      if (!meta.mediaTypes.includes(type === 'tv' ? 'tv' : 'movie')) return;
      const fn = type === 'movie' ? srv.movie : srv.tv;
      if (typeof fn !== 'function') return;
      const url = type === 'movie' ? fn(id) : fn(id, season, episode);
      out.push({
        id: meta.id,
        providerId: meta.id,
        providerName: meta.label,
        mediaType: type === 'tv' ? 'series' : 'movie',
        url,
        playbackType: 'embed',
        playerPath: 'iframe',
        isAvailable: true,
        category: meta.category,
      });
    });
    return out;
  }

  return {
    DIRECT_PLAYERS,
    annotateServer,
    registerServers,
    defaultPriorityIds,
    playableForUi,
    addonIntegrations,
    resolveEmbedSources,
  };
});

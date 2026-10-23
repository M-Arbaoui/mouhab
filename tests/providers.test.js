'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const Nuvio = require(path.join(root, 'js/providers/nuvio-compat.js'));
const Registry = require(path.join(root, 'js/providers/source-registry.js'));

function loadAppServers() {
  const src = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const start = src.indexOf('const SERVERS=[');
  assert.ok(start >= 0, 'SERVERS registry missing from app.js');
  const ids = [];
  const slice = src.slice(start, src.indexOf('];', start) + 2);
  const re = /id:'([^']+)'/g;
  let m;
  while ((m = re.exec(slice))) ids.push(m[1]);
  return ids;
}

const mockServers = Registry.DIRECT_PLAYERS.map((p) => ({
  id: p.id,
  label: p.label,
  tag: p.tag,
  movie: (id) => `https://example.test/${p.id}/movie/${id}`,
  tv: (id, s, e) => `https://example.test/${p.id}/tv/${id}/${s}/${e}`,
}));

test('existing providers still register in documented order', () => {
  const appIds = loadAppServers();
  const registryIds = Registry.defaultPriorityIds();
  assert.deepEqual(appIds, registryIds);
  const registered = Registry.registerServers(mockServers);
  assert.equal(registered.length, registryIds.length);
  registered.forEach((row, i) => {
    assert.equal(row.id, registryIds[i]);
    assert.equal(row.defaultPriority, i);
    assert.equal(row.enabled, true);
    assert.equal(row.playbackType, 'embed');
    assert.equal(row.playerPath, 'iframe');
  });
});

test('existing provider priorities remain intact', () => {
  assert.equal(Registry.DIRECT_PLAYERS[0].id, 'vidking');
  assert.equal(Registry.DIRECT_PLAYERS[1].id, 'vidsrc_xyz');
  const ranked = Nuvio.rankSources(
    Registry.resolveEmbedSources(mockServers, { mediaType: 'movie', tmdbId: '550' }),
    { userPriority: Registry.defaultPriorityIds() }
  );
  assert.equal(ranked[0].providerId, 'vidking');
  assert.equal(ranked[1].providerId, 'vidsrc_xyz');
});

test('adapter maps movie and episode identifiers', () => {
  assert.equal(Nuvio.nuvioVideoId('movie', 550), 'tmdb:550');
  assert.equal(Nuvio.nuvioVideoId('tv', '1396', 1, 1), 'tmdb:1396:1:1');
  assert.equal(Nuvio.nuvioVideoId('series', '1396', 2, 5), 'tmdb:1396:2:5');
  assert.equal(Nuvio.nuvioVideoId('movie', 'abc'), null);
  assert.equal(Nuvio.nuvioVideoId('tv', '1396', 0, 1), null);
  assert.deepEqual(Nuvio.parseNuvioVideoId('tmdb:550'), { mediaType: 'movie', tmdbId: '550' });
  assert.deepEqual(Nuvio.parseNuvioVideoId('tmdb:1396:1:1'), {
    mediaType: 'series', tmdbId: '1396', season: 1, episode: 1,
  });
});

test('valid supported addon-shaped response normalizes without claiming iframe playback for HLS', () => {
  const result = Nuvio.normalizeAddonResponse({
    streams: [{
      name: 'Example',
      title: 'Demo',
      url: 'https://cdn.example/video/index.m3u8',
      quality: '1080p',
      language: 'en',
    }],
  }, { providerId: 'example', providerName: 'Example', mediaType: 'movie' });
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].playbackType, 'hls');
  assert.equal(result.sources[0].playerPath, 'unsupported');
  assert.equal(result.sources[0].isAvailable, false);
});

test('embed-shaped URL maps to the iframe player path', () => {
  const result = Nuvio.normalizeAddonStream({
    url: 'https://player.example/embed/movie/550',
  }, { providerId: 'example', mediaType: 'movie' });
  assert.equal(result.ok, true);
  assert.equal(result.source.playbackType, 'embed');
  assert.equal(result.source.playerPath, 'iframe');
});

test('invalid or unexpected responses fail gracefully', () => {
  assert.deepEqual(Nuvio.normalizeAddonResponse(null).sources, []);
  assert.deepEqual(Nuvio.normalizeAddonResponse('nope').sources, []);
  assert.deepEqual(Nuvio.normalizeAddonResponse({}).sources, []);
  assert.equal(Nuvio.normalizeAddonStream({ url: 'javascript:alert(1)' }).ok, false);
  assert.equal(Nuvio.normalizeAddonStream({ url: 'https://127.0.0.1/stream' }).ok, false);
  assert.equal(Nuvio.normalizeAddonStream({ infoHash: 'abc' }).ok, false);
  assert.equal(Nuvio.normalizeAddonStream({
    url: 'https://cdn.example/file.mp4',
    headers: { Authorization: 'Bearer secret' },
  }).ok, false);
});

test('provider timeouts do not block the entire source list', async () => {
  const slow = { id: 'slow', resolve: () => new Promise((r) => setTimeout(() => r([{ url: 'late' }]), 80)) };
  const fast = { id: 'fast', resolve: () => [{ id: 'fast', providerId: 'fast', url: 'https://a.example/embed/1', playbackType: 'embed', isAvailable: true }] };
  const out = await Nuvio.gatherProviderResults([slow, fast], {}, { timeoutMs: 20 });
  assert.equal(out.sources.length, 1);
  assert.equal(out.sources[0].providerId, 'fast');
  assert.equal(out.failures.length, 1);
  assert.equal(out.failures[0].providerId, 'slow');
});

test('one unavailable provider does not break others', async () => {
  const bad = { id: 'bad', resolve: () => { throw new Error('boom token=supersecret'); } };
  const good = { id: 'good', resolve: () => [{ id: 'good', providerId: 'good', url: 'https://a.example/embed/1' }] };
  const out = await Nuvio.gatherProviderResults([bad, good], {});
  assert.equal(out.sources.length, 1);
  assert.equal(out.failures[0].error.includes('supersecret'), false);
});

test('duplicate sources are collapsed by canonical URL', () => {
  const dup = Nuvio.dedupeSources([
    { url: 'https://cdn.example/play?token=aaa' },
    { url: 'https://cdn.example/play?token=bbb' },
    { url: 'https://other.example/play' },
  ]);
  assert.equal(dup.length, 2);
});

test('manual selection is preserved at the front of ranking', () => {
  const sources = [
    { id: 'b', providerId: 'b', isAvailable: true },
    { id: 'a', providerId: 'a', isAvailable: true },
  ];
  const ranked = Nuvio.rankSources(sources, { userPriority: ['a', 'b'], selectedId: 'b' });
  assert.equal(ranked[0].id, 'b');
});

test('empty result set is a valid outcome', async () => {
  const out = await Nuvio.gatherProviderResults([
    { id: 'empty', resolve: () => [] },
  ], {});
  assert.deepEqual(out.sources, []);
  assert.deepEqual(out.failures, []);
});

test('client-visible errors do not include tokens', () => {
  const msg = Nuvio.publicError(new Error('failed token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc'));
  assert.equal(msg.includes('eyJ'), false);
  assert.equal(Nuvio.redact('url?token=secret&x=1').includes('secret'), false);
});

test('Nuvio is documented as an addon integration and is not playable', () => {
  const nuvio = Nuvio.describeIntegration();
  assert.equal(nuvio.enabled, false);
  assert.equal(nuvio.streamResolution, false);
  assert.equal(nuvio.category, 'addon');
  const playable = Registry.playableForUi(mockServers);
  assert.equal(playable.some((p) => p.id === 'nuvio_compat'), false);
  const addons = Registry.addonIntegrations();
  assert.equal(addons[0].id, 'nuvio_compat');
});

test('Watchy embed resolver still returns every existing source for movies and episodes', () => {
  const movie = Registry.resolveEmbedSources(mockServers, { mediaType: 'movie', tmdbId: '550' });
  const episode = Registry.resolveEmbedSources(mockServers, { mediaType: 'tv', tmdbId: '1396', season: 1, episode: 2 });
  assert.equal(movie.length, mockServers.length);
  assert.equal(episode.length, mockServers.length);
  assert.ok(movie[0].url.includes('/movie/550'));
  assert.ok(episode[0].url.includes('/tv/1396/1/2'));
  assert.equal(Nuvio.playerPathForPlaybackType('embed'), 'iframe');
  assert.equal(Nuvio.playerPathForPlaybackType('hls'), 'unsupported');
});

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function pngSize(relativePath) {
  const data = fs.readFileSync(path.join(root, relativePath));
  assert.equal(data.toString('hex', 0, 8), '89504e470d0a1a0a');
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

test('manifest is linked and its icon dimensions match the actual PNG files', () => {
  const html = read('index.html');
  assert.match(html, /<link\s+rel="manifest"\s+href="\.\/manifest\.json"/i);

  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  for (const icon of manifest.icons) {
    assert.deepEqual(pngSize(icon.src), {
      width: Number(icon.sizes.split('x')[0]),
      height: Number(icon.sizes.split('x')[1]),
    });
  }
});

test('root service worker precaches the assets actually loaded by the production page', () => {
  const html = read('index.html');
  const app = read('js/app.js');
  const worker = read('sw.js');

  assert.match(app, /serviceWorker\.register\('\.\/sw\.js'\)/);
  assert.match(html, /href="css\/style\.min\.css"/);
  assert.match(html, /href="css\/platform-redesign\.css"/);
  assert.match(html, /src="js\/catalog-glow\.js"/);
  assert.match(html, /src="js\/app\.min\.js"/);
  assert.doesNotMatch(html, /maximum-scale\s*=/i);

  for (const asset of [
    'index.html', 'css/style.min.css', 'css/platform-redesign.css', 'js/app.min.js', 'js/catalog-glow.js',
    'manifest.json', 'og-image.png', 'icon-192.png', 'icon-512.png',
  ]) {
    assert.ok(worker.includes(`'./${asset}'`), `service worker should precache ${asset}`);
    assert.ok(fs.existsSync(path.join(root, asset)), `${asset} should exist`);
  }
});

test('service worker uses separate caches and never handles known streaming embeds', () => {
  const worker = read('sw.js');
  assert.match(worker, /watchy-shell-v7/);
  assert.match(worker, /watchy-api-v6/);
  assert.match(worker, /watchy-img-v6/);
  assert.match(worker, /api\.themoviedb\.org/);
  assert.match(worker, /image\.tmdb\.org/);
  assert.match(worker, /EMBED_HOSTS/);
  assert.match(worker, /return;\s*if \(url\.protocol/);
  assert.match(worker, /self\.clients\.claim\(\)/);
});

test('Anime is a first-class catalogue page and replaces Discover', () => {
  const html = read('index.html');
  const app = read('js/app.js');
  const manifest = JSON.parse(read('manifest.json'));

  assert.doesNotMatch(html, /data-page="discover"|id="page-discover"/);
  assert.match(html, /data-page="anime"/);
  assert.match(html, /id="page-anime"/);
  assert.match(html, /id="anime-grid"/);
  assert.match(app, /anime:\s*\{type:'both'/);
  assert.match(app, /animeTV/);
  assert.ok(manifest.shortcuts.some((shortcut) => shortcut.url === './#/anime'));
  assert.ok(!manifest.shortcuts.some((shortcut) => shortcut.url === './#/discover'));
});

test('Vercel analytics loads only on the canonical production host', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /<script[^>]+src="https:\/\/cdn\.vercel-insights\.com\/v1\/script\.js"/i);
  assert.match(html, /location\.hostname === 'mouhab\.vercel\.app'[\s\S]*analytics\.src = 'https:\/\/cdn\.vercel-insights\.com\/v1\/script\.js'/);
});

test('ambient color extraction always resolves with a safe fallback', () => {
  const app = read('js/app.js');
  const start = app.indexOf('function extractAmbientColor(');
  const end = app.indexOf('async function renderHero(', start);
  assert.ok(start >= 0 && end > start);
  const code = app.slice(start, end);
  assert.match(code, /img\.onerror=\(\)=>resolve\('201,169,110'\)/);
  assert.match(code, /catch\(_\)\s*\{resolve\('201,169,110'\);\}/);
});

test('TMDB requests disable adult results and app script is the deployed script', () => {
  const html = read('index.html');
  const app = read('js/app.js');
  const minified = read('js/app.min.js');
  assert.match(html, /src="js\/app\.min\.js"/);
  assert.match(app, /url\.searchParams\.set\('include_adult','false'\)/);
  assert.match(minified, /include_adult/);
  assert.match(minified, /serviceWorker\.register\("\.\/sw\.js"\)/);
});

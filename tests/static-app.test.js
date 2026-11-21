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

test('manifest resources exist and declared image dimensions match', () => {
  const html = read('index.html');
  const manifestHref = html.match(/<link\s+rel="manifest"\s+href="([^"]+)"/i)?.[1];
  assert.equal(manifestHref, './manifest.json');

  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  const shortcutUrls = (manifest.shortcuts || []).map((s) => s.url);
  assert.deepEqual(shortcutUrls, ['./#/search', './#/anime', './#/mylist']);
  assert.ok(!shortcutUrls.includes('./#/discover'));
  for (const icon of manifest.icons) {
    assert.deepEqual(pngSize(icon.src), {
      width: Number(icon.sizes.split('x')[0]),
      height: Number(icon.sizes.split('x')[1]),
    });
  }
  for (const screenshot of manifest.screenshots || []) {
    assert.deepEqual(pngSize(screenshot.src), {
      width: Number(screenshot.sizes.split('x')[0]),
      height: Number(screenshot.sizes.split('x')[1]),
    });
  }
});

test('root service worker controls the app and precaches the loaded local assets', () => {
  const html = read('index.html');
  const app = read('js/app.js');
  const worker = read('sw.js');
  assert.match(app, /serviceWorker\.register\('\.\/sw\.js'\)/);
  assert.doesNotMatch(html, /maximum-scale\s*=/i);
  assert.ok(fs.existsSync(path.join(root, 'sw.js')));
  assert.ok(!fs.existsSync(path.join(root, 'js/sw.js')));
  assert.match(html, /href="css\/style\.css"/);
  assert.match(html, /src="js\/app\.js"/);
  assert.doesNotMatch(html, /style\.min\.css|app\.min\.js/);
  for (const asset of ['css/style.css', 'js/app.js', 'manifest.json']) {
    assert.ok(worker.includes(`'./${asset}'`), `service worker should precache ${asset}`);
    assert.ok(fs.existsSync(path.join(root, asset)), `${asset} should exist`);
  }
});

test('active visual layer is the dark classic stylesheet and covers core screens', () => {
  const html = read('index.html');
  const css = read('css/style.css');
  const app = read('js/app.js');
  assert.match(html, /href="css\/style\.css"/);
  assert.doesNotMatch(html, /href="css\/(?:navigation|redesign|streaming|fieldnotes|wordmark)\.css"/);
  for (const selector of ['#hero', '.section-title', '.card-img-w', '.tp-title', '.player-topbar', '.aux-header']) {
    assert.ok(css.includes(selector), `style.css should style ${selector}`);
  }
  assert.match(css, /--bg:\s*#09090B/i);
  assert.match(css, /--gold:\s*#C9A96E/i);
  assert.match(css, /@media\(max-width:800px\)/);
  assert.match(css, /@media\(max-width:600px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(app, /setAttribute\('aria-current','page'\)/);
});

test('Anime replaces Discover in navigation and has a dedicated catalogue route', () => {
  const html = read('index.html');
  const app = read('js/app.js');
  assert.doesNotMatch(html, /data-page="discover"|id="page-discover"/);
  assert.equal((html.match(/data-page="anime"/g) || []).length, 2);
  assert.match(html, /id="page-anime"/);
  assert.match(html, /id="anime-grid"/);
  assert.match(app, /CATALOG\[p\]/);
  assert.match(app, /animeTV:\(\)=>Promise\.all\(/);
  assert.match(app, /RESTORABLE_PAGES=\['home','movies','series','anime','mylist'\]/);
  assert.match(app, /startPage==='anime'\)navTo\('anime'\)/);
  assert.match(app, /section==='search'/);
});

test('Vercel analytics is limited to its production host', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /<script[^>]+src="https:\/\/cdn\.vercel-insights\.com\/v1\/script\.js"/i);
  assert.match(html, /location\.hostname === 'watchy-dev\.vercel\.app'[\s\S]*analytics\.src = 'https:\/\/cdn\.vercel-insights\.com\/v1\/script\.js'/);
});

test('palette extraction failures fall back without blocking hero background rendering', () => {
  const app = read('js/app.js');
  const extractStart = app.indexOf('function extractPalette(');
  const renderStart = app.indexOf('async function renderHero(', extractStart);
  assert.ok(extractStart >= 0 && renderStart > extractStart);
  const extractEnd = app.indexOf('\nfunction applyPalette(', extractStart);
  const extractCode = app.slice(extractStart, extractEnd);
  const renderEnd = app.indexOf('\nfunction setupHero(', renderStart);
  const renderCode = app.slice(renderStart, renderEnd);
  assert.match(extractCode, /img\.onerror=\(\)=>resolve\(PALETTE_DEFAULT\)/);
  assert.match(extractCode, /catch\(_\)\{resolve\(PALETTE_DEFAULT\);\}/);
  assert.match(renderCode, /showing\.style\.backgroundImage=bg\?/);
  assert.match(renderCode, /extractPalette\(imgBLq\(item\.backdrop_path\)\)/);
});

test('search and episode text is escaped and stale requests are ignored', () => {
  const app = read('js/app.js');
  assert.match(app, /const escapeHTML=value=>String\(value\?\?''\)\.replace/);
  assert.match(app, /hist\.map\(h=>`<button class="search-hist-pill" data-q="\$\{escapeHTML\(h\)\}"/);
  assert.match(app, /ov\.textContent=ep\.overview\.length>120\?ep\.overview\.slice\(0,120\)/);
  assert.match(app, /request!==_searchRequest\|\|document\.getElementById\('search-overlay-input'\)\?\.value!==q/);
  assert.doesNotMatch(app, /_discoverRequest|initDiscover\(/);
});

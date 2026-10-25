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
  assert.match(html, /href="css\/style\.min\.css"/);
  assert.match(html, /href="css\/wordmark\.css"/);
  assert.match(html, /href="css\/fieldnotes\.css"/);
  assert.match(html, /src="js\/app\.js"/);
  for (const asset of ['css/style.min.css', 'css/wordmark.css', 'css/fieldnotes.css', 'js/app.js', 'manifest.json']) {
    assert.ok(worker.includes(`'./${asset}'`), `service worker should precache ${asset}`);
    assert.ok(fs.existsSync(path.join(root, asset)), `${asset} should exist`);
  }
});

test('Cloudglass redesign is the sole active visual layer and styles all core screens', () => {
  const html = read('index.html');
  const css = read('css/fieldnotes.css');
  const app = read('js/app.js');
  assert.match(html, /href="css\/fieldnotes\.css"/);
  assert.doesNotMatch(html, /href="css\/(?:navigation|redesign|streaming)\.css"/);
  for (const selector of ['#hero', '.section-title', '.card-img-w', '.tp-title', '.discover-card', '.player-topbar', '.aux-header']) {
    assert.ok(css.includes(selector), `Field Notes design should style ${selector}`);
  }
  assert.match(css, /--bg:\s*#edf1f8/i);
  assert.match(css, /--gold:\s*#8d83e9/i);
  assert.match(css, /background:\s*rgba\(240,\s*244,\s*251,\s*\.72\)/);
  assert.match(css, /\.nav-logo:hover::after[\s\S]*opacity:\s*1/);
  assert.match(css, /@keyframes cloudPageIn/);
  assert.match(css, /\.cl-content::before[\s\S]*cloudSpin/);
  assert.match(css, /@media \(max-width: 800px\)/);
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(app, /setAttribute\('aria-current','page'\)/);
});

test('Anime replaces Discover in navigation and has a dedicated catalogue route', () => {
  const html = read('index.html');
  const app = read('js/app.js');
  assert.doesNotMatch(html, /data-page="discover"|id="page-discover"/);
  assert.equal((html.match(/data-page="anime"/g) || []).length, 2);
  assert.match(html, /id="page-anime"/);
  assert.match(html, /id="anime-grid"/);
  assert.match(app, /if\(p==='anime'&&!S\.animeLoaded\)/);
  assert.match(app, /const items=await A\.animeTV\(\)/);
  assert.match(app, /MAIN_PAGES=\['home','movies','series','anime','mylist'\]/);
  assert.match(app, /startPage==='anime'\)navTo\('anime'\)/);
});

test('Vercel analytics is limited to its production host', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /<script[^>]+src="https:\/\/cdn\.vercel-insights\.com\/v1\/script\.js"/i);
  assert.match(html, /location\.hostname === 'watchy-dev\.vercel\.app'[\s\S]*analytics\.src = 'https:\/\/cdn\.vercel-insights\.com\/v1\/script\.js'/);
});

test('ambient color extraction failures fall back without blocking hero background rendering', () => {
  const app = read('js/app.js');
  const extractStart = app.indexOf('function extractAmbientColor(');
  const renderStart = app.indexOf('async function renderHero(', extractStart);
  assert.ok(extractStart >= 0 && renderStart > extractStart);
  const ambientCode = app.slice(extractStart, renderStart);
  const renderEnd = app.indexOf('\nfunction setupHero(', renderStart);
  const renderCode = app.slice(renderStart, renderEnd);
  assert.match(ambientCode, /img\.onerror=\(\)=>resolve\('201,169,110'\)/);
  assert.match(ambientCode, /catch\(_\)\s*\{\s*resolve\('201,169,110'\);\s*\}/);
  assert.match(renderCode, /showing\.style\.backgroundImage=bg\?/);
  assert.match(renderCode, /extractAmbientColor\(bg\)\.catch\(\(\)=> '201,169,110'\)/);
});

test('search and episode text is escaped and stale requests are ignored', () => {
  const app = read('js/app.js');
  assert.match(app, /const escapeHTML=value=>String\(value\?\?''\)\.replace/);
  assert.match(app, /hist\.map\(h=>`<button class="search-hist-pill" data-q="\$\{escapeHTML\(h\)\}"/);
  assert.match(app, /<div class="ep-overview">\$\{escapeHTML\(ep\.overview\.slice\(0,120\)\)\}/);
  assert.match(app, /request!==_searchRequest\|\|document\.getElementById\('search-overlay-input'\)\?\.value!==q/);
  assert.doesNotMatch(app, /_discoverRequest|initDiscover\(/);
});

# Watchy

Watchy is a static HTML, CSS, and JavaScript application. It has no package manager dependencies, bundler, or production build step.

## Local development

From the repository root on Windows, run:

```powershell
python -m http.server 8000
```

Open <http://localhost:8000/>. Do not open `index.html` as a `file://` URL: browser origin restrictions prevent the PWA manifest, service worker, and some cross-origin operations from working correctly.

## Production deployment

Deploy the repository root as the static site directory to any HTTPS-capable static host (for example, Vercel static hosting or GitHub Pages).

- Build command: none
- Output directory: repository root (`.`)
- Ensure all root assets and the `css/` and `js/` directories are published without changing their relative paths.

The manifest and root-scoped service worker require HTTP/HTTPS. The service worker is available at `/sw.js` and caches the app shell for offline use.

## Checks

Run the built-in Node.js tests with:

```powershell
node --test tests/*.test.js
```

Check JavaScript syntax with `node --check js/app.js` and `node --check sw.js`.

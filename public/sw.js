const CACHE_NAME = 'gotham-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

const OFFLINE_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gotham Financial - Offline</title>
  <style>
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: #060810; color: #e8edf2;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; margin: 0; text-align: center; padding: 24px;
    }
    .offline-wrap { max-width: 400px; }
    h1 {
      font-size: 28px; font-weight: 800; margin-bottom: 12px;
      background: linear-gradient(135deg, #00c853, #ffd600);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    p { color: #6b7a8d; font-size: 15px; line-height: 1.6; margin-bottom: 24px; }
    button {
      padding: 12px 28px; border-radius: 8px;
      background: linear-gradient(135deg, #00c853, #007a3d);
      border: none; color: #fff; font-weight: 700; font-size: 14px;
      cursor: pointer; font-family: inherit;
    }
    button:hover { box-shadow: 0 4px 15px rgba(0,200,83,0.3); }
    .icon { font-size: 48px; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="offline-wrap">
    <div class="icon">&#128268;</div>
    <h1>You're Offline</h1>
    <p>Gotham Financial requires an internet connection for live market data and trading. Please check your connection and try again.</p>
    <button onclick="window.location.reload()">Retry Connection</button>
  </div>
</body>
</html>`;

// Install: cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('SW: Some assets failed to cache during install:', err);
        // Cache what we can, don't fail install for CDN resources
        return cache.addAll(['/', '/index.html', '/app.js', '/manifest.json']);
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API/navigation, cache-first for static assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Network-first for API calls and navigation requests
  if (event.request.mode === 'navigate' || url.pathname.startsWith('/api')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache successful navigation responses
          if (response.ok && event.request.mode === 'navigate') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Try cache, then offline page
          return caches.match(event.request).then(cached => {
            if (cached) return cached;
            return new Response(OFFLINE_PAGE, {
              headers: { 'Content-Type': 'text/html' }
            });
          });
        })
    );
    return;
  }

  // Cache-first for static assets (JS, CSS, fonts, images)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful responses for static assets
        if (response.ok && (event.request.url.match(/\.(js|css|woff2?|ttf|eot|png|jpg|svg|ico)(\?|$)/) ||
            event.request.url.includes('fonts.googleapis.com') ||
            event.request.url.includes('cdnjs.cloudflare.com') ||
            event.request.url.includes('cdn.jsdelivr.net') ||
            event.request.url.includes('unpkg.com'))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Return nothing for failed static asset fetches
        return new Response('', { status: 408, statusText: 'Offline' });
      });
    })
  );
});

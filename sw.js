const CACHE_NAME = 'kreta-guide-v3';
const ASSETS = [
  'index.html',
  'manifest.json',
  'app_icon.png',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Arimo:wght@400;500;700&family=Playfair+Display:ital,wght=0,600;0,700;1,400&display=swap'
];

// Install Event - Pre-cache App Shell and CDNs
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[Service Worker] Caching static assets & CDN wrappers');
      // Using map to individually add to avoid failing completely if one CDN url changes
      return Promise.allSettled(
        ASSETS.map(url => {
          return cache.add(url).catch(err => {
            console.warn(`[Service Worker] Failed to cache: ${url}`, err);
          });
        })
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clear old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Serve from Cache, fallback to Network
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Let real-time APIs and map tiles pass through directly to the network
  if (
    url.includes('api.open-meteo.com') ||
    url.includes('generativelanguage.googleapis.com') ||
    url.includes('router.project-osrm.org') ||
    url.includes('basemaps.cartocdn.com')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(event.request).then(networkResponse => {
        // Cache newly fetched web fonts dynamically
        if (
          networkResponse && 
          networkResponse.status === 200 && 
          (url.includes('fonts.gstatic.com') || url.includes('cdnjs.cloudflare.com') || url.includes('unpkg.com'))
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fallback for navigation requests when completely offline
        if (event.request.mode === 'navigate') {
          return caches.match('index.html');
        }
      });
    })
  );
});

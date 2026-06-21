const CACHE_NAME = 'ta-bill-cache-2026-06-21T10-19-09-058Z';

const STATIC_ASSETS = [
    './',
    './index.html',
    './app.js',
    './pdf_func.js',
    './libs/tailwind.js',
    './libs/jspdf.umd.min.js',
    './libs/jspdf.plugin.autotable.min.js',
    './ta_abbrevs.json',
    './legs.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {
            console.log('[Service Worker] Pre-caching static assets with cache busting');
            const cachePromises = STATIC_ASSETS.map(async url => {
                try {
                    const response = await fetch(url + '?v=' + Date.now());
                    if (!response.ok) {
                        throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
                    }
                    await cache.put(url, response);
                } catch (error) {
                    console.error(`[Service Worker] Failed to cache: ${url}`, error);
                }
            });
            await Promise.all(cachePromises);
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Only intercept requests to our same origin
    if (url.origin !== self.location.origin) return;

    // Handle routes directory dynamically: Network first, fallback to Cache
    if (url.pathname.includes('/routes/') && url.pathname.endsWith('.json')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(cache => {
                return fetch(event.request).then(response => {
                    if (response.ok) {
                        cache.put(event.request, response.clone());
                    }
                    return response;
                }).catch(() => {
                    return cache.match(event.request);
                });
            })
        );
        return;
    }

    // Default strategy for other local files: Cache First, fallback to network
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request);
        })
    );
});

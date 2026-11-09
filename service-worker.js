const SHELL_CACHE = 'taskflow-shell-v2';
const CDN_CACHE = 'taskflow-cdn-v1';
const APP_SHELL = ['./', './index.html', './taskflow-core.js', './i18n.js', './app.js'];
const CDN_RESOURCES = [
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const shellCache = await caches.open(SHELL_CACHE);
        await shellCache.addAll(APP_SHELL);
        const cdnCache = await caches.open(CDN_CACHE);
        await Promise.all(CDN_RESOURCES.map(async resource => {
            try {
                const request = new Request(resource, { mode: 'no-cors' });
                const response = await fetch(request);
                if (response.ok || response.type === 'opaque') await cdnCache.put(request, response);
            } catch (error) {
                return;
            }
        }));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames
            .filter(name => name.startsWith('taskflow-') && ![SHELL_CACHE, CDN_CACHE].includes(name))
            .map(name => caches.delete(name)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const requestUrl = new URL(request.url);
    event.respondWith((async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
            const response = await fetch(request);
            if (response.ok || response.type === 'opaque') {
                const cacheName = requestUrl.origin === self.location.origin ? SHELL_CACHE : CDN_CACHE;
                const cache = await caches.open(cacheName);
                cache.put(request, response.clone()).catch(() => {});
            }
            return response;
        } catch (error) {
            if (request.mode === 'navigate') {
                const appShell = await caches.match('./index.html');
                if (appShell) return appShell;
            }
            return Response.error();
        }
    })());
});

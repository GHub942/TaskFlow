const SHELL_CACHE = 'taskflow-shell-v3';
const APP_SHELL = [
    './',
    './index.html',
    './taskflow-core.js',
    './i18n.js',
    './app.js',
    './vendor/tailwindcss.js',
    './vendor/fontawesome/all.min.css',
    './vendor/fontawesome/webfonts/fa-brands-400.ttf',
    './vendor/fontawesome/webfonts/fa-brands-400.woff2',
    './vendor/fontawesome/webfonts/fa-regular-400.ttf',
    './vendor/fontawesome/webfonts/fa-regular-400.woff2',
    './vendor/fontawesome/webfonts/fa-solid-900.ttf',
    './vendor/fontawesome/webfonts/fa-solid-900.woff2',
    './vendor/fontawesome/webfonts/fa-v4compatibility.ttf',
    './vendor/fontawesome/webfonts/fa-v4compatibility.woff2',
    './vendor/fonts/inter.css',
    './vendor/fonts/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa0ZL7SUc.woff2',
    './vendor/fonts/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2',
    './vendor/fonts/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1pL7SUc.woff2',
    './vendor/fonts/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa25L7SUc.woff2',
    './vendor/fonts/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa2JL7SUc.woff2',
    './vendor/fonts/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa2ZL7SUc.woff2',
    './vendor/fonts/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa2pL7SUc.woff2'
];

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const shellCache = await caches.open(SHELL_CACHE);
        await shellCache.addAll(APP_SHELL);
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames
            .filter(name => name.startsWith('taskflow-') && name !== SHELL_CACHE)
            .map(name => caches.delete(name)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;
    event.respondWith((async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
            const response = await fetch(request);
            if (response.ok || response.type === 'opaque') {
                const cache = await caches.open(SHELL_CACHE);
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

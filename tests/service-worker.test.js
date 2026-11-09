const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createWorker() {
    const handlers = {};
    const cacheStore = new Map();
    const origin = 'https://taskflow.test';
    const cacheKey = value => new URL(typeof value === 'string' ? value : value.url, `${origin}/`).href;
    const caches = {
        async open(name) {
            if (!cacheStore.has(name)) cacheStore.set(name, new Map());
            const entries = cacheStore.get(name);
            return {
                async addAll(paths) {
                    paths.forEach(item => entries.set(cacheKey(item), { url: cacheKey(item), type: 'basic', ok: true }));
                },
                async put(request, response) {
                    entries.set(cacheKey(request), response);
                },
                async match(request) {
                    return entries.get(cacheKey(request));
                }
            };
        },
        async match(request) {
            for (const entries of cacheStore.values()) {
                const response = entries.get(cacheKey(request));
                if (response) return response;
            }
            return undefined;
        },
        async keys() {
            return [...cacheStore.keys()];
        },
        async delete(name) {
            return cacheStore.delete(name);
        }
    };
    let offline = false;
    const sandbox = {
        URL,
        Request: class {
            constructor(url, options = {}) {
                this.url = String(url);
                this.mode = options.mode || 'cors';
                this.method = options.method || 'GET';
            }
        },
        Response: { error: () => ({ type: 'error' }) },
        caches,
        fetch: async request => {
            if (offline) throw new Error('offline');
            return { url: String(request.url || request), type: 'opaque', ok: false, clone() { return this; } };
        },
        self: {
            location: { origin, href: `${origin}/` },
            clients: { claim: async () => {} },
            skipWaiting: async () => {},
            addEventListener(name, handler) { handlers[name] = handler; }
        }
    };
    const source = fs.readFileSync(path.join(__dirname, '..', 'service-worker.js'), 'utf8');
    vm.runInNewContext(source, sandbox, { filename: 'service-worker.js' });
    return {
        handlers,
        cacheStore,
        setOffline(value) { offline = value; },
        async dispatch(name, event) {
            let pending;
            handlers[name]({
                ...event,
                waitUntil(promise) { pending = promise; },
                respondWith(promise) { pending = promise; }
            });
            return pending;
        }
    };
}

test('installs an app shell including self-hosted vendor assets', async () => {
    const worker = createWorker();
    await worker.dispatch('install', {});
    const shell = worker.cacheStore.get('taskflow-shell-v3');
    assert.ok(shell.has('https://taskflow.test/index.html'));
    assert.ok(shell.has('https://taskflow.test/taskflow-core.js'));
    assert.ok(shell.has('https://taskflow.test/i18n.js'));
    assert.ok(shell.has('https://taskflow.test/app.js'));
    assert.ok(shell.has('https://taskflow.test/vendor/tailwindcss.js'));
    assert.ok(shell.has('https://taskflow.test/vendor/fontawesome/all.min.css'));
    assert.ok(shell.has('https://taskflow.test/vendor/fonts/inter.css'));
});

test('serves the cached app shell for offline navigation', async () => {
    const worker = createWorker();
    await worker.dispatch('install', {});
    worker.setOffline(true);
    const response = await worker.dispatch('fetch', {
        request: { url: 'https://taskflow.test/index.html', mode: 'navigate', method: 'GET' }
    });
    assert.equal(response.url, 'https://taskflow.test/index.html');
});

// Service worker for "Sit Up, Please". Caches the application shell so the
// interface can open without a network connection after a first visit, and
// opportunistically caches the on-device face model files fetched from their
// content delivery networks so a later offline visit can still load them.
//
// Bump CACHE_VERSION whenever the caching strategy below changes, so that
// returning browsers discard the previous version's caches on activation.
const CACHE_VERSION = 'v1';
const SHELL_CACHE = `sit-up-please-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `sit-up-please-runtime-${CACHE_VERSION}`;

const APP_SHELL_PATHS = [
	'./',
	'./manifest.webmanifest',
	'./icons/icon-192.png',
	'./icons/icon-512.png',
	'./icons/apple-touch-icon.png',
	'./icons/favicon.svg',
	'./favicon.ico',
];

// The on-device face model and its WebAssembly runtime are served from these
// content delivery networks rather than bundled with the application, so
// they are only cacheable once a first visit has fetched them successfully.
const CACHEABLE_CROSS_ORIGIN_HOSTS = ['cdn.jsdelivr.net', 'storage.googleapis.com'];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(SHELL_CACHE)
			.then((cache) => cache.addAll(APP_SHELL_PATHS))
			.then(() => self.skipWaiting()),
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys()
			.then((cacheNames) => Promise.all(
				cacheNames
					.filter((cacheName) => cacheName !== SHELL_CACHE && cacheName !== RUNTIME_CACHE)
					.map((cacheName) => caches.delete(cacheName)),
			))
			.then(() => self.clients.claim()),
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	const isSameOrigin = url.origin === self.location.origin;
	const isCacheableCrossOrigin = CACHEABLE_CROSS_ORIGIN_HOSTS.includes(url.hostname);
	if (isSameOrigin === false && isCacheableCrossOrigin === false) return;

	if (request.mode === 'navigate') {
		event.respondWith(_networkFirst(request));
		return;
	}

	event.respondWith(_staleWhileRevalidate(request));
});

/**
 * Serves the page shell from the network so a returning person always sees
 * the latest deployed version while online, falling back to the cached shell
 * when the network is unavailable.
 */
async function _networkFirst(request) {
	const cache = await caches.open(SHELL_CACHE);
	try {
		const response = await fetch(request);
		await cache.put('./', response.clone());
		return response;
	} catch {
		const cached = await cache.match('./');
		if (cached !== undefined) return cached;
		throw new Error('Offline, and no cached application shell is available.');
	}
}

/**
 * Serves an asset from the runtime cache immediately when one is already
 * stored, while always refreshing that cache entry from the network in the
 * background so the next visit gets the latest copy.
 */
async function _staleWhileRevalidate(request) {
	const cache = await caches.open(RUNTIME_CACHE);
	const cached = await cache.match(request);
	const networkFetch = fetch(request)
		.then((response) => {
			void cache.put(request, response.clone());
			return response;
		})
		.catch(() => undefined);

	if (cached !== undefined) return cached;
	const networkResponse = await networkFetch;
	return networkResponse ?? Response.error();
}

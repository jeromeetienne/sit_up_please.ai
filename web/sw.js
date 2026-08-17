// Service worker template for "Sit Up, Please".
//
// This file is not served as it stands. The build reads it, fills in the four
// placeholder values below, and emits the result as `sw.js` at the root of the
// built site — see build/service_worker_plugin.ts. It sits outside `public/`
// for exactly that reason: everything in `public/` is copied untouched.
//
// The install step stores every file a start needs, including the Face
// Landmarker model and the MediaPipe WebAssembly runtime, both of which the
// built site serves from its own origin. One online visit is therefore enough
// to make every later visit work with no network connection at all, whether or
// not the camera was ever started on that first visit.

/** Identifies this build. The cache names carry it, so a new build starts with fresh caches. */
const BUILD_IDENTIFIER = '__BUILD_IDENTIFIER__';

/** Every file a start needs, apart from the WebAssembly runtime, written in by the build. */
const PRECACHE_PATHS = '__PRECACHE_PATHS__';

/** The WebAssembly runtime for a browser that supports the single-instruction operations. */
const SINGLE_INSTRUCTION_PATHS = '__SINGLE_INSTRUCTION_PATHS__';

/** The WebAssembly runtime for a browser without the single-instruction operations. */
const NO_SINGLE_INSTRUCTION_PATHS = '__NO_SINGLE_INSTRUCTION_PATHS__';

const PRECACHE = `sit-up-please-precache-${BUILD_IDENTIFIER}`;
const RUNTIME_CACHE = `sit-up-please-runtime-${BUILD_IDENTIFIER}`;

/** The address a navigation asks for, and the address the stored document answers. */
const DOCUMENT_PATH = './';

/**
 * How a stored file is looked up. Both settings are needed, and a start fails without either one.
 *
 * `ignoreSearch` is needed because the stylesheet asks for the icon font with a cache-busting query
 * string that is not part of the file name the build emitted.
 *
 * `ignoreVary` is needed because a `Vary` header on the stored response otherwise takes part in the
 * lookup, and the lookup then misses whenever the header it names differs between the request the
 * install step made and the request the browser makes. A static file from this site never differs by
 * request header, but the servers answer with one all the same: the Vite preview server sends
 * `Vary: Origin`, and GitHub Pages sends `Vary: Accept-Encoding`. Without this setting the lookup
 * misses every file the install step stored, the fallback below reaches for a network that is not
 * there, and the person is left with an unstyled page and dead buttons.
 */
const MATCH_OPTIONS = { ignoreSearch: true, ignoreVary: true };

// A WebAssembly module that uses one single-instruction-multiple-data operation and nothing else.
// A browser that can instantiate it will ask for the SINGLE_INSTRUCTION_PATHS runtime. These are the
// same bytes `FilesetResolver.forVisionTasks` tests with, so both reach the same answer.
const SINGLE_INSTRUCTION_TEST_MODULE = new Uint8Array([
	0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
]);

self.addEventListener('install', (event) => {
	event.waitUntil(_install());
});

self.addEventListener('activate', (event) => {
	event.waitUntil(_activate());
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	// Every file the application needs now comes from its own origin, so anything else is left to
	// the browser untouched.
	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

	if (request.mode === 'navigate') {
		event.respondWith(_document(request));
		return;
	}

	event.respondWith(_precacheFirst(request));
});

/**
 * Stores every file a start needs, then takes over from any previous service worker.
 *
 * `cache.addAll` either stores the whole list or stores none of it. That is what is wanted here: a
 * half-filled cache would leave the application unable to start offline while looking as though it
 * could. A failed install leaves the previous version, and its caches, in place, and the browser
 * tries the install again on the next visit.
 */
async function _install() {
	const cache = await caches.open(PRECACHE);
	const hasSingleInstructions = await _hasSingleInstructionSupport();
	const webAssemblyPaths = hasSingleInstructions ? SINGLE_INSTRUCTION_PATHS : NO_SINGLE_INSTRUCTION_PATHS;
	await cache.addAll([...PRECACHE_PATHS, ...webAssemblyPaths]);
	await self.skipWaiting();
}

/**
 * Deletes the caches of every other build, then starts serving the pages that are already open.
 *
 * The deletion happens here rather than during install, so that a device that can already start
 * offline keeps that ability until the replacement build is completely stored.
 */
async function _activate() {
	const cacheNames = await caches.keys();
	await Promise.all(
		cacheNames
			.filter((cacheName) => cacheName !== PRECACHE && cacheName !== RUNTIME_CACHE)
			.map((cacheName) => caches.delete(cacheName)),
	);
	await self.clients.claim();
}

/**
 * Answers a navigation with the stored document, which is the copy that names the very files this
 * build stored alongside it. Going to the network first would store a newer document naming files
 * that are not held anywhere, which is what used to leave an offline start broken after a
 * deployment. A newer build arrives instead through this service worker being replaced.
 */
async function _document(request) {
	const cache = await caches.open(PRECACHE);
	const cached = await cache.match(DOCUMENT_PATH, MATCH_OPTIONS);
	if (cached !== undefined) return cached;

	try {
		return await fetch(request);
	} catch {
		return Response.error();
	}
}

/**
 * Answers with the stored copy when this build precached the file, and falls back to the network for
 * anything else, keeping a copy of that for the next time.
 */
async function _precacheFirst(request) {
	const precache = await caches.open(PRECACHE);
	const precached = await precache.match(request, MATCH_OPTIONS);
	if (precached !== undefined) return precached;

	return _staleWhileRevalidate(request);
}

/**
 * Serves a file that was not precached from the runtime cache when one is already stored, while
 * always refreshing that entry from the network in the background.
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

/** Whether this browser supports the single-instruction-multiple-data operations. */
async function _hasSingleInstructionSupport() {
	try {
		await WebAssembly.instantiate(SINGLE_INSTRUCTION_TEST_MODULE);
		return true;
	} catch {
		return false;
	}
}

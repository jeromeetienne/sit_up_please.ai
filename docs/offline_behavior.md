# Offline behavior and the Face Landmarker model download

This document describes how the progressive web application's offline support connects to the on-device face model download, confirms the offline story against the current code, and records a gap the previous documentation did not cover.

Source: [issue #11](https://github.com/jeromeetienne/sit_up_please.ai/issues/11).

## How the model is loaded

The application does not bundle the MediaPipe face model or its WebAssembly runtime. Both are fetched at runtime from third-party content delivery networks in [web/js/posture/posture_tracker.ts](../web/js/posture/posture_tracker.ts):

- WebAssembly runtime: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm`
- Face Landmarker model file: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task`

Both are fetched inside `PostureTracker.start()` when the camera starts, via `FilesetResolver.forVisionTasks(...)` and `FaceLandmarker.createFromOptions(...)`. The npm package `@mediapipe/tasks-vision` only ships the JavaScript wrapper; the WebAssembly binary and the model weights are never part of the npm package or the build output.

One exception: in the Chrome extension build, the WebAssembly runtime is served from a locally bundled extension path instead of the content delivery network (`chrome.runtime.getURL('wasm')`). The model file itself is always fetched remotely, in both the website and the extension.

This self-hosting is already fully wired up for the extension: the npm package `@mediapipe/tasks-vision` ships the same WebAssembly runtime files locally at `node_modules/@mediapipe/tasks-vision/wasm/`, and [contribs/chrome_ext/vite.config.ts](../contribs/chrome_ext/vite.config.ts) has a `copyMediaPipeWasm()` build plugin that copies that directory into the extension's own build output. The main web application's `vite.config.ts` has no equivalent step, which is why the website falls back to the jsdelivr content delivery network for the WebAssembly runtime while the extension never needs the network for it at all.

## How the service worker connects to that download

[web/public/sw.js](../web/public/sw.js) caches two separate things:

1. **The application shell** — the built HTML, manifest, icons, and favicon, installed into the cache as soon as the service worker installs, then served network-first with a cache fallback for navigations.
2. **Cross-origin responses from an explicit host allow-list** — `cdn.jsdelivr.net` and `storage.googleapis.com`, which are exactly the two hosts the model-loading code above fetches from. Any GET request to those hosts is served stale-while-revalidate: return the cached copy immediately if one exists, and always refresh the cache from the network in the background.

The connection between the progressive web application and the model download is this allow-list: the service worker does not special-case the model file, it opportunistically caches any successful response from those two hosts, which happens to include the WebAssembly runtime files and the `face_landmarker.task` model file once `PostureTracker.start()` fetches them. The same stale-while-revalidate branch also handles the application's own built JavaScript and CSS bundle, since those are same-origin GET requests that are not navigations either — the install-time precache only covers the navigation document, the manifest, and the icons, not the JavaScript and CSS bundle. So a fully offline start needs one complete online visit to have populated the runtime cache with the application's own script and style files too, not only the model and WebAssembly runtime.

Both content delivery network hosts return `access-control-allow-origin: *`, so these are ordinary readable ("cors", not "opaque") responses that the service worker can fully cache and replay — there is no cross-origin resource sharing limitation on caching the model or the WebAssembly runtime. Separately, the two hosts set their own short `Cache-Control` freshness windows for the browser's ordinary HTTP cache (`storage.googleapis.com`: one hour; `cdn.jsdelivr.net`: seven days), but the service worker's own `cache.put()` keeps an independent copy in the Cache Storage API with no expiry of its own, so offline availability does not depend on those upstream freshness windows.

The service worker registers only in the production build, not in `npm run dev` ([web/js/pwa/offline_support.ts](../web/js/pwa/offline_support.ts)), and registration failures are swallowed silently, leaving the application working online without offline capability.

## When the application can and cannot start offline

**Can start offline:**

After one visit that is online for its entire duration and successfully starts the camera (so `PostureTracker.start()` runs to completion), all of the shell, the WebAssembly runtime, and the model file are cached. Every later visit, online or fully offline, loads the interface from cache and re-creates the Face Landmarker detector from the cached WebAssembly and model responses. Face landmark detection itself then runs entirely on-device, so posture tracking keeps working with no network connection at all.

**Cannot start offline:**

- A device that has never opened the application online cannot start it offline at all — this is already called out in the project's `README.md`.
- Clearing site data or uninstalling removes both caches, requiring the whole fetch-and-cache cycle again.

**Gap not previously documented:** a first visit where the camera or model fetch does not finish successfully — permission denied, permission prompt dismissed, or the model fetch itself failing — leaves the shell cached but the runtime cache empty for the WebAssembly runtime and model entries. `PostureTracker.start()` swallows a failed Face Landmarker creation silently: the camera preview still shows, but no posture readings are produced, with nothing telling the person why. On a later fully offline visit from that same device, the interface loads from cache but posture detection still cannot initialize, because the model was never actually cached. The previous README wording ("the model file ... still needs a network connection the first time it is fetched") reads as though any online visit satisfies that requirement, but it only does so if the fetch actually completes.

## Secondary risk: unpinned model and runtime versions

The WebAssembly runtime URL pins to the npm dist-tag `@latest` rather than to the same version installed locally, and the model URL pins to a `latest` path segment rather than a fixed model version. Because the runtime cache is refreshed stale-while-revalidate on every online visit, a device that has been working offline for a while could silently pick up a newer WebAssembly build or model version the next time it happens to be online, with no version pinning to guarantee it still matches the bundled JavaScript wrapper. This is not a known break today, just an exposure that the offline caching inherits from the upstream URLs.

## Suggested follow-ups

- Document the "first visit didn't finish loading the model" case as a distinct offline failure mode, separate from "never opened online at all".
- Consider surfacing a visible state, not just a silent no-op, when the Face Landmarker fails to initialize, both online and offline, so a person understands why posture tracking is not running.
- Consider adding the same `copyMediaPipeWasm()`-style build step already used by [contribs/chrome_ext/vite.config.ts](../contribs/chrome_ext/vite.config.ts) to the main web application's `vite.config.ts`, so the website self-hosts the WebAssembly runtime the same way the Chrome extension already does. That would remove the jsdelivr content delivery network dependency, and the unpinned `@latest` version risk that comes with it, entirely, leaving only the `face_landmarker.task` model file itself as a required external fetch, since that file is a standalone model asset that is not distributed through the npm package.
- If the model URL's `latest` path segment cannot be pinned to a fixed model version, consider vendoring a known-good copy of `face_landmarker.task` the same way, or at minimum recording the version currently in use so a future upstream change can be diagnosed against a known baseline.

Related: [issue #2](https://github.com/jeromeetienne/sit_up_please.ai/issues/2).

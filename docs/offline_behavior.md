# Offline behavior and the Face Landmarker model download

This document describes how the progressive web application starts with no network connection, and how the Face Landmarker model download fits into that.

Sources: [issue #11](https://github.com/jeromeetienne/sit_up_please.ai/issues/11) recorded the earlier behaviour, and [issue #21](https://github.com/jeromeetienne/sit_up_please.ai/issues/21) holds the measurements and the plan that produced the behaviour described here.

## What a start needs, and where each part comes from

Every file the application needs is served by the application's own address. Nothing is fetched from a third-party host at any point.

- The interface: the document, one JavaScript bundle, one stylesheet bundle, the icon fonts, the icons and the manifest, all written by the build.
- The Face Landmarker model file, `face_landmarker.task`, 3,758,596 bytes. It is kept in [web/public/models](../web/public/models), because it is a standalone model asset that no npm package distributes. Its SHA-256 sum is `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`, and it came from `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`.
- The MediaPipe WebAssembly runtime, which reads the model. [build/media_pipe_web_assembly_plugin.ts](../build/media_pipe_web_assembly_plugin.ts) copies it out of the installed `@mediapipe/tasks-vision` package into the `wasm` folder of the built site, and serves the same files from the development server. Copying rather than fetching keeps the runtime at the version `package-lock.json` pins, next to the JavaScript wrapper from the same package.

`FilesetResolver.forVisionTasks` instantiates a small WebAssembly module at run time to find out whether the browser supports the single-instruction-multiple-data operations, then asks for one of two runtime variants. Both variants are shipped, because either one can be the one a browser asks for.

## How the service worker stores all of it

[web/sw.js](../web/sw.js) is a template. [build/service_worker_plugin.ts](../build/service_worker_plugin.ts) fills in its four placeholder values and emits the result as `sw.js` at the root of the built site. The list of files cannot be written by hand, for two reasons: the JavaScript bundle and the stylesheet bundle carry a content hash in their names that is only known once the build has run, and a first visit registers the service worker after the browser has already asked for those two files, so a service worker that only watches later requests never sees them.

The install step stores the whole list at once, and runs the same single-instruction test the resolver runs so that only the runtime variant this browser will ask for is stored. `cache.addAll` either stores everything or stores nothing, which is what is wanted: a half-filled store would leave the application unable to start offline while looking as though it could. A failed install leaves the previous version and its stored files in place, and the browser tries again on the next visit.

Two settings on every lookup are both load-bearing, and a start fails without either one:

- `ignoreSearch`, because the stylesheet asks for the icon font with a cache-busting query string that is not part of the file name the build emitted.
- `ignoreVary`, because a `Vary` header on the stored response otherwise takes part in the lookup. A static file from this site never differs by request header, but the servers answer with one anyway: the Vite preview server sends `Vary: Origin` and GitHub Pages sends `Vary: Accept-Encoding`. Without this setting every lookup misses, the fallback reaches for a network that is not there, and the person is left with an unstyled page and dead buttons.

A navigation is answered from the stored document rather than from the network. The stored document is the copy that names the very files stored beside it. Going to the network first would store a newer document naming content-hashed files that are held nowhere, which is what used to leave an offline start broken after a deployment.

## Keeping one deployment together

The cache names carry a build identifier, which is a hash over the contents of every stored file and over the installed MediaPipe package version. Taking the hash over file contents rather than file names is deliberate: a deployment that only edits the document leaves every content-hashed file name unchanged, so an identifier taken from names alone would not change, the browser would see no new service worker, and every device would keep serving the previous document for good.

A new deployment therefore produces a service worker the browser sees as new. It installs and stores the new build completely, and only then activates and deletes the caches of the previous build. A device that could already start offline keeps that ability throughout.

## When the application can and cannot start offline

**Can start offline:** after one visit online that stayed open long enough for the roughly 16 megabyte download to finish. The camera never has to have been started. Every later visit, online or fully offline, opens the interface, starts the camera, calibrates and produces posture readings.

**Cannot start offline:**

- A device that has never opened the application online.
- A device whose first visit was closed before the download finished. The install stores everything or nothing, so nothing is stored and the next visit tries again.
- A device whose site data has been cleared, or where the application has been uninstalled.

## What was measured

Measured against the production build, served with `vite preview --base /sit_up_please.ai/` and then with that server stopped, so the application's own address refused every connection:

- One visit online, with the camera never touched, stored 14 files totalling 16,121,296 bytes, including `models/face_landmarker.task` at 3,758,596 bytes and the single-instruction runtime pair. The no-single-instruction variant was correctly left alone.
- With the server stopped, the interface opened fully styled, with 3,359 stylesheet rules parsed, and the icon font was served in spite of its query string.
- With the server stopped, `wasm/vision_wasm_internal.wasm` was served as `application/wasm` and compiled, reporting 146 exports.
- `FaceLandmarker.createFromOptions` built a working detector from these same-origin paths in 650 milliseconds.

## Notes

The service worker registers only in the production build, not in `npm run dev` ([web/js/pwa/offline_support.ts](../web/js/pwa/offline_support.ts)), and a failed registration is passed over in silence, leaving the application working online without the ability to start offline.

`PostureTracker` reports a model that will not load as a state the interface reads, rather than passing it over in silence. The screen then says the posture model could not be loaded, instead of showing a camera picture that never produces a reading.

Related: [issue #2](https://github.com/jeromeetienne/sit_up_please.ai/issues/2).

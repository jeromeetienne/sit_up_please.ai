# Directory Context: `/build`

## Purpose
Holds the Vite build plugins that make the site able to start with no network connection: one copies the MediaPipe WebAssembly runtime out of `node_modules` and into the built site, and one generates the service worker that stores every file a start needs.

## Key Exports & Entry Points
- `media_pipe_web_assembly_plugin.ts`: `MediaPipeWebAssemblyPlugin.create()` for `vite.config.ts`, plus the runtime file names and the installed package version, which the service worker plugin reads.
- `service_worker_plugin.ts`: `ServiceWorkerPlugin.create()` for `vite.config.ts`. It fills in the template at [../web/sw.js](../web/sw.js) and emits the result as `sw.js`.
- `offline_build.test.ts`: builds the site into a temporary folder and checks that an offline start is still possible. Command to run this folder: `npm test`.

## Rules
- Nothing here imports from `web/`. These files run in Node.js during the build; everything under `web/` runs in the browser.
- The service worker template stays outside `web/public/`, because every file in `web/public/` is copied to the built site untouched and the template is not valid until its placeholders are filled in.
- `MediaPipeWebAssemblyPlugin.create()` comes before `ServiceWorkerPlugin.create()` in the `plugins` array, and the service worker plugin keeps `enforce: 'post'`, so that the built `index.html` is already part of the bundle when the precache list is written.
- Both WebAssembly runtime variants are shipped, and the service worker precaches only the one the browser asks for.
- The build identifier covers the contents of every precached file, not only their names.

## Background
- The reasons behind each rule above, and the measurements they came from, are in [issue #21](https://github.com/jeromeetienne/sit_up_please.ai/issues/21) and [docs/offline_behavior.md](../docs/offline_behavior.md).
- The build identifier has to cover file contents because a deployment that only edits `index.html` leaves every content-hashed file name unchanged. An identifier taken from names alone would not change, the browser would see no new service worker, and every device would keep serving the previous document from its cache for good.

# Sit Up, Please Chrome extension

This directory contains a Chromium Manifest Version 3 extension. Clicking the
extension button opens the posture monitor in its own compact Chrome window,
separate from ordinary browser tabs.

## Build and load locally

From the repository root:

```sh
npm run build:chrome-extension
```

In Chrome, open `chrome://extensions`, enable **Developer mode**, select
**Load unpacked**, then choose `contribs/chrome_ext/dist`.

Click the Sit Up, Please extension button to open the monitor. Allow camera
access when Chrome asks. Keep the dedicated monitor window open while working
in other browser tabs.

The extension uses the same on-device MediaPipe Face Landmarker model as the
website. The required WebAssembly runtime files are bundled into the
extension, while the official face model file is fetched from Google when the
monitor starts. Camera frames and facial landmarks stay in the browser.

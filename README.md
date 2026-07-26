# Sit Up, Please

Sit Up, Please is a browser-based posture monitor. It uses a webcam and the on-device [MediaPipe Face Landmarker model](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker) to help a person notice sustained movement away from a calibrated reference posture.

Camera frames and pose landmarks are processed in the browser. The application does not upload webcam frames.

## Current status

The initial implementation provides:

- a browser interface for starting the webcam;
- on-device facial landmark detection with an optional full-face mesh overlay;
- an eight-second calibration that stores a reference posture in the browser;
- posture analysis at 30 frames per second;
- an immediate in-page reminder when posture moves away from the calibrated reference; and
- recalibration and pause-monitoring controls.

Browser notifications are optional. If the browser does not support them or the person does not grant permission, the in-page reminder still works.

The application is also a progressive web application: it can be installed and launched like a native application, and it caches its own interface so it can start without a network connection after a first visit. See [Progressive web application support](#progressive-web-application-support) below.

## Requirements

- Node.js 20 or later
- A modern browser with webcam access and WebGL support

## Run locally

```sh
npm install
npm run dev
```

Open the local HTTP address printed by Vite, select **Start camera**, and allow camera access when the browser asks. Sit comfortably upright, then select **Calibrate posture** and hold the position for three seconds.

## Validate the project

```sh
npm run build
```

The build performs strict TypeScript checking and creates a production bundle in `dist/`.

## Progressive web application support

The application ships a web app manifest and a service worker, so it can be installed like a native application and can start without a network connection after a first visit.

**Installing the application**

- Chrome and Edge on desktop and Android show an install button in the application's own footer once the browser decides the page is installable, and also offer installation from the browser's own address-bar or menu install control.
- Safari on iOS and iPadOS does not support the automatic install button. Install manually from the Share menu with **Add to Home Screen**.
- Safari on macOS does not support the automatic install button either. Install manually from the File menu with **Add to Dock**.
- Firefox does not currently offer installation for this kind of application, on either desktop or Android.

Once installed, the application opens in its own window without browser address or tab bars.

**Offline startup**

After a first successful visit online, a service worker keeps a cached copy of the application's interface, so opening the installed application again without a network connection still shows the interface. The webcam and the on-device Face Landmarker model are unaffected by installation: the webcam still asks for the browser's own camera permission, and the Face Landmarker model file, which is fetched from Google's and jsDelivr's content delivery networks rather than bundled with the application, still needs a network connection the first time it is fetched. Once that first fetch has succeeded, the service worker keeps a cached copy of it too, so later offline visits can still load it.

**Limitations**

- The install button only appears in browsers that fire the underlying `beforeinstallprompt` event. Where it does not appear, use that browser's own manual installation step listed above.
- Offline startup depends on a first visit having completed online. A device that has never opened the application with a network connection cannot start it offline.
- Uninstalling the application, or clearing the browser's site data for it, removes the cached interface and the cached Face Landmarker model, so the next startup needs a network connection again.

## Privacy and limitations

The application is intended to run entirely on the device. It is a reminder for movement away from a calibrated camera position, not a medical posture assessment. Face Landmarker does not measure shoulder position, torso position, or spinal curvature. Tracking quality depends on camera position, lighting, and whether the face is visible.

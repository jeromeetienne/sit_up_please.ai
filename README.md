# Sit Up, Please

Sit Up, Please is a browser-based posture monitor. It uses a webcam and the on-device [MediaPipe Face Landmarker model](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker) to help a person notice sustained movement away from a calibrated reference posture.

Camera frames and pose landmarks are processed in the browser. The application does not upload webcam frames.

## Current status

The initial implementation provides:

- a browser interface for starting the webcam;
- on-device facial landmark detection with an optional full-face mesh overlay;
- an eight-second calibration that stores a reference posture in the browser;
- posture analysis at 30 frames per second;
- an immediate in-page reminder when posture moves away from the calibrated reference;
- recalibration and pause-monitoring controls;
- a pomodoro timer on the same page, with its own notification and its own tone; and
- a settings panel for the pomodoro parameters.

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

## Interface

The interface is plain [Bootstrap](https://getbootstrap.com/) 5. The navigation bar, the cards, the buttons, the alert that carries the posture verdict, the stacked progress bar that carries the session history and the settings modal are all Bootstrap components with their own appearance, and the layout is the Bootstrap grid.

The whole stylesheet is `web/css/style.scss`: it imports Bootstrap and adds three rules, which are the ones Bootstrap has no class for. There are no design tokens, no palette and no typeface of this project's own, so the page can be changed by swapping Bootstrap classes in `web/index.html` rather than by writing style rules.

Colour that carries meaning uses the Bootstrap contextual colours: `success` while the calibrated posture is held, `danger` while it is lost, `secondary` while it is unknown.

## Pomodoro timer

The pomodoro timer runs on the same page as the posture monitor. It counts a work period, then a short break, and a long break instead of the short one once the set number of work periods is finished. The timer keeps counting whether or not posture monitoring is reading the camera.

Switch **Run the pomodoro timer** on in the settings panel to start the cycle, and off to stop it. When a period has finished and automatic start is switched off, a **Start next period** button appears beside the countdown. The period name, the time left and one status line appear above the session figures.

**Notification when a period finishes**

- The page shows the name of the next period and its countdown.
- A desktop notification names the period that has just finished and says what comes next, with its length. It carries a notification tag of its own, so a finished period and a posture reminder never replace one another on the screen.
- A tone plays: a falling two-note tone at the end of a work period, and a rising one at the end of a break. Neither tone repeats or grows stronger, because a period ending is one event rather than a condition that continues. A posture alert already sounding is closed first, without the reward chime.

Desktop notifications for the pomodoro timer follow the same **Show a desktop notification for a sustained slouch** setting in the settings panel as the posture reminder.

**Parameters**

Select **Settings** in the navigation bar to edit them. They are stored in this browser and are read again on the next visit.

| Parameter | Default |
| --- | --- |
| Work period length | 25 minutes |
| Short break length | 5 minutes |
| Long break length | 15 minutes |
| Work periods before a long break | 4 |
| Start the next period automatically | off |
| Pause posture monitoring during a break | on |

A period already counting down keeps the length it started with, so a change never moves the finishing line of the period the person is in the middle of. A new length applies from the next period.

While **Pause posture monitoring during a break** is on, the page reads **On a break.** for the length of every break, no posture reading is taken, and no slip is counted. A break means leaving the chair, so a slouch reminder and a lost face would both fire for no reason.

## Light theme and dark theme

The page follows the light theme or the dark theme of the operating system on its own. Select **Theme** in the navigation bar to force one of the two instead: one press moves from the operating system setting to the light theme, the next to the dark theme, and the next back to the operating system setting.

A forced theme is stored in this browser and is remembered for six hours. Once those six hours have passed the forced theme is forgotten and the page follows the operating system again, whether the page was closed in the meantime or has stayed open the whole time.

Both themes are Bootstrap's own. The theme in force is written to the root element as the Bootstrap `data-bs-theme` attribute, and Bootstrap knows only the light theme and the dark theme, so the operating system setting is read from `prefers-color-scheme` and written as one of the two. A change to the operating system setting while the page is open is followed straight away.

## Progressive web application support

The application ships a web app manifest and a service worker, so it can be installed like a native application and can start without a network connection after a first visit.

**Installing the application**

- Chrome and Edge on desktop and Android show an install button in the application's own navigation bar once the browser decides the page is installable, and also offer installation from the browser's own address-bar or menu install control.
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

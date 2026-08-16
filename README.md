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
- recalibration and pause-monitoring controls in the posture column;
- a pomodoro timer on the same page, with its own notification and its own tone;
- a Pomodoro settings panel for the pomodoro parameters, and a Situp settings panel for the camera; and
- a Notification settings panel that sets up every event on its own: whether it shows a desktop notification, whether it plays a sound, which sound, and how loud.

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

The interface is plain [Bootstrap](https://getbootstrap.com/) 5. The navigation bar, the cards, the buttons, the alert that carries the posture verdict, the stacked progress bar that carries the session history, the Situp settings modal, the Pomodoro settings modal and the Notification settings modal are all Bootstrap components with their own appearance, and the layout is the Bootstrap grid.

The whole stylesheet is `web/css/style.scss`: it imports Bootstrap and adds three rules, which are the ones Bootstrap has no class for. There are no design tokens, no palette and no typeface of this project's own, so the page can be changed by swapping Bootstrap classes in `web/index.html` rather than by writing style rules.

Colour that carries meaning uses the Bootstrap contextual colours: `success` while the calibrated posture is held, `danger` while it is lost, `secondary` while it is unknown.

The controls that act on a session sit in the posture column, under the verdict, as two Bootstrap button groups: **Recalibrate** and the start-and-pause button for posture monitoring, then the **Pomodoro** button for the timer. The navigation bar keeps only what acts on the application as a whole: the install button, the repository link, the theme button and the three buttons that open the Situp settings panel, the Pomodoro settings panel and the Notification settings panel.

## Pomodoro timer

The pomodoro timer runs on the same page as the posture monitor. It counts a work period, then a short break, and a long break instead of the short one once the set number of work periods is finished. The timer keeps counting whether or not posture monitoring is reading the camera.

The **Pomodoro** button in the posture column, beside the posture monitoring controls, runs the timer. One button covers the three things the timer can be asked to do, because a press means whichever of them the cycle is standing in front of:

- while the timer is off it reads **Pomodoro** and starts the cycle;
- while a period counts down it reads the time left and stops the timer; and
- while a finished period waits to be started by hand it reads **Start next period** and starts that period.

The switch **Run the pomodoro timer** in the Pomodoro settings panel does the same as the first two of those. The period name, the time left and one status line also appear above the session figures, with their own **Start next period** button beside the countdown.

**Notification when a period finishes**

- The page shows the name of the next period and its countdown.
- A desktop notification names the period that has just finished and says what comes next, with its length. It carries a notification tag of its own, so a finished period and a posture reminder never replace one another on the screen.
- A sound plays: a falling two-note sound at the end of a work period, and a rising one at the end of a break. Neither sound repeats or grows stronger, because a period ending is one event rather than a condition that continues. A posture alert already sounding is closed first, without the reward chime.

Whether a finished work period and a finished break show a desktop notification, whether they play a sound, which sound and how loud, are all set in the Notification settings panel described under [Notifications](#notifications) below. The desktop notification and the sound both also need the **Allow notifications and sounds** setting at the top of that same Notification settings panel to be on, because that setting holds the browser notification permission for the whole application.

**Parameters**

Select **Pomodoro settings** in the navigation bar to edit them. Every parameter carries a short description under its name in the panel. They are stored in this browser and are read again on the next visit.

| Parameter | Default |
| --- | --- |
| Work period length | 25 minutes |
| Short break length | 5 minutes |
| Long break length | 15 minutes |
| Work periods before a long break | 4 |
| Start the next period automatically | off |
| Pause posture monitoring during a break | on |

A period already counting down keeps the length it started with, so a change never moves the finishing line of the period the person is in the middle of. A new length applies from the next period.

**Restore defaults**

Select **Restore defaults** in the Pomodoro settings panel to put every setting of the panel back to its default: the timer is switched off, and the parameters return to the defaults in the table above in the fields of the panel. As with any other edit, the parameters are only stored once **Save** is selected, so **Cancel** still leaves the stored parameters as they were.

Each of the three panels restores its own defaults. **Restore defaults** in the Situp settings panel draws the facial landmarks over the picture again, and **Restore defaults** in the Notification settings panel is described under [Notifications](#notifications) below.

While **Pause posture monitoring during a break** is on, the page reads **On a break.** for the length of every break, no posture reading is taken, and no slip is counted. A break means leaving the chair, so a slouch reminder and a lost face would both fire for no reason.

## Notifications

Select **Notification settings** in the navigation bar to open the Notification settings panel. It sets up each of the four events of the application on its own, so a person who wants a sound for a finished work period and nothing at all for a corrected posture can say exactly that. The setup is stored in this browser and is read again on the next visit.

Each event carries:

- a switch for a desktop notification;
- a switch for a sound;
- a list of the sounds the application can play;
- a slider for the volume of that sound, from 0 to 100 per cent; and
- a play button, which plays the chosen sound at the chosen volume so it can be heard while it is being chosen. The play button plays the sound whether or not the event is set to make one, because a person pressing it is tuning the sound rather than waiting for the event.

| Event | Desktop notification | Sound | Volume |
| --- | --- | --- | --- |
| A sustained slouch | on | Urgent triple | 70% |
| A corrected posture | never | Rising three-note chime | 40% |
| A finished work period | on | Falling two-note | 60% |
| A finished break | on | Rising two-note | 60% |

A corrected posture never shows a desktop notification: it only takes the notification of the slouch off the screen, so a notification of its own would announce the end of something the person has already put right.

The sounds are **Rising two-note**, **Falling two-note**, **Rising three-note chime**, **Falling three-note chime**, **Urgent triple**, **Single beep** and **Low double knock**. They are all played by the browser itself rather than read from a sound file, so nothing has to be downloaded and the panel works offline.

A sustained slouch plays its sound again and again for as long as the slouch continues, growing louder the longer it lasts, whichever sound and volume it is set to. The chosen sound and volume decide what is played; they do not change how often it repeats.

The **Allow notifications and sounds** switch at the top of the panel stands above every event below it: while it is off, no event notifies at all. It is the switch that holds the browser notification permission, and it takes effect as soon as it is pressed rather than on save.

Select **Restore defaults** in the Notification settings panel to put every event back to the table above, and the **Allow notifications and sounds** switch back to where a fresh page load would put it — on when this browser has already granted notification permission, off otherwise, and never asking for permission. The events are only stored once **Save** is selected, so **Cancel** still leaves the stored setup as it was.

## Situp settings

Select **Situp settings** in the navigation bar to open the Situp settings panel. It carries the camera settings, which is at present the single switch **Draw the facial landmarks over the picture**. The switch takes effect as soon as it is pressed, so the panel has no save button and closing it changes nothing further. Select **Restore defaults** to draw the facial landmarks over the picture again.

The pomodoro parameters and the notification setup each have a panel of their own, described under [Pomodoro timer](#pomodoro-timer) and [Notifications](#notifications) above.

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

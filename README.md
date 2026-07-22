# Sit Up, Please

Sit Up, Please is a browser-based posture monitor. It uses a webcam and the
on-device MediaPipe Face Landmarker model to help a person notice sustained
movement away from a calibrated reference posture.

Camera frames and pose landmarks are processed in the browser. The application
does not upload webcam frames.

## Current status

The initial implementation provides:

- a browser interface for starting the webcam;
- on-device facial landmark detection with an optional full-face mesh overlay;
- an eight-second calibration that stores a reference posture in the browser;
- posture analysis at 30 frames per second;
- an in-page reminder after 30 seconds away from the calibrated reference; and
- recalibration, pause, acknowledgement, and ten-minute snooze controls.

Browser notifications are optional. If the browser does not support them or the
person does not grant permission, the in-page reminder still works.

## Requirements

- Node.js 20 or later
- A modern browser with webcam access and WebGL support

## Run locally

```sh
npm install
npm run dev
```

Open the local HTTP address printed by Vite, select **Start camera**, and allow
camera access when the browser asks. Sit comfortably upright, then select
**Calibrate posture** and hold the position for three seconds.

## Validate the project

```sh
npm run build
```

The build performs strict TypeScript checking and creates a production bundle in
`dist/`.

## Privacy and limitations

The application is intended to run entirely on the device. It is a reminder for
movement away from a calibrated camera position, not a medical posture
assessment. Face Landmarker does not measure shoulder position, torso position,
or spinal curvature. Tracking quality depends on camera position, lighting, and
whether the face is visible.

## Project issue

Implementation work is tracked in [issue #5](https://github.com/jeromeetienne/sit_up_please.ai/issues/5).

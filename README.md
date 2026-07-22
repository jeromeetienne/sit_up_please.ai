# Sit Up, Please

Sit Up, Please is a browser-based posture monitor. It uses a webcam and an
on-device pose model to help a person notice when posture has drifted from a
calibrated reference position.

Camera frames and pose landmarks are processed in the browser. The application
does not upload webcam frames.

## Current status

The initial implementation provides:

- a browser interface for starting the webcam;
- on-device BlazePose landmark detection using the WebGL backend;
- a live view of detected upper-body landmarks, samples, and frame rate; and
- camera permission and pose-model error messages.

Calibration, posture scoring, sustained-slouch detection, and notifications are
still to be implemented.

## Requirements

- Node.js 20 or later
- A modern browser with webcam access and WebGL support

## Run locally

```sh
npm install
npm run dev
```

Open the local address printed by Vite, select **Start camera**, and allow
camera access when the browser asks. Position your face and shoulders in the
camera frame to see the landmark tracker.

## Validate the project

```sh
npm run build
```

The build performs strict TypeScript checking and creates a production bundle in
`dist/`.

## Privacy and limitations

The application is intended to run entirely on the device. It can infer posture
from visible upper-body landmarks, but it cannot directly measure spinal
curvature. Tracking quality depends on camera position, lighting, and whether
the head and shoulders are visible.

## Project issue

Implementation work is tracked in [issue #3](https://github.com/jeromeetienne/sit_up_please.ai/issues/3).

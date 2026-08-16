# Directory Context: `/web/js/pomodoro`

## Purpose
Counts the pomodoro cycle — a work period, then a short break, and a long break instead of the short one once the set number of work periods is finished — and produces the words and the values the monitor screen draws for it.

## Key Exports & Entry Points
- `pomodoro_timer.ts`: `PomodoroTimer`, the cycle itself. It owns its own one-second interval, so it keeps counting whether or not posture monitoring is reading the camera.
- `pomodoro_settings.ts`: `PomodoroSettings` and `POMODORO_DEFAULT_SETTINGS`, the seven values that shape a cycle, read from and written to local browser storage.
- `pomodoro_dialog.ts`: `PomodoroDialog`, the Pomodoro settings panel that edits the parameters, reports the saved values through its `onSaved` callback and a press of restore defaults through its `onRestoreDefaults` callback.
- `pomodoro_copy.ts`: `PomodoroCopy`, every sentence the pomodoro area and its desktop notification can show.
- `pomodoro_types.ts`: the shared data shapes, including `PomodoroViewModel`.

## Rules
- Only `pomodoro_dialog.ts` touches the page, and only the elements of the Pomodoro settings panel itself. Everything else on the monitor screen belongs to `MonitorView`, which reads `PomodoroViewModel` out of `MonitorViewModel` — including the switch that runs the timer, because its position is written from the running session.
- Nothing here creates a `Notification` or plays a sound: `NotificationAlerts` owns both, and the timer only reports that a period has finished.
- Nothing here reads the camera or the posture: `MonitorSession` decides what a running break means for posture monitoring, by asking `PomodoroTimer.holdsPostureMonitoring`.
- Every sentence shown to a person lives in `pomodoro_copy.ts` or in the Pomodoro settings panel markup in `../../index.html`, not in the timer. The words and the title of the pomodoro button of the navigation bar come from `PomodoroCopy` through `PomodoroViewModel`, so `MonitorView` decides only which icon to draw.
- The parameters and their defaults live in `pomodoro_settings.ts`; the Pomodoro settings panel restates neither a default value nor the storage key.

## Background
- The pomodoro notification carries its own notification tag in `notification_alerts.ts`, so a finished period and a posture reminder never replace one another on the screen.

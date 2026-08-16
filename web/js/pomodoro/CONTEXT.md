# Directory Context: `/web/js/pomodoro`

## Purpose
Counts the pomodoro cycle — a work period, then a short break, and a long break instead of the short one once the set number of work periods is finished — and produces the words and the values the monitor screen draws for it.

## Key Exports & Entry Points
- `pomodoro_timer.ts`: `PomodoroTimer`, the cycle itself. It owns its own one-second interval, so it keeps counting whether or not posture monitoring is reading the camera.
- `pomodoro_settings.ts`: `PomodoroSettings` and `POMODORO_DEFAULT_SETTINGS`, the seven values that shape a cycle, read from and written to local browser storage.
- `pomodoro_copy.ts`: `PomodoroCopy`, every sentence the pomodoro area and its desktop notification can show.
- `pomodoro_types.ts`: the shared data shapes, including `PomodoroViewModel`.

## Rules
- Nothing here touches the page: `MonitorView` is the one place that writes to the document, and it reads `PomodoroViewModel` out of `MonitorViewModel`.
- Nothing here creates a `Notification` or plays a sound: `NotificationAlerts` owns both, and the timer only reports that a period has finished.
- Nothing here reads the camera or the posture: `MonitorSession` decides what a running break means for posture monitoring, by asking `PomodoroTimer.holdsPostureMonitoring`.
- Every sentence shown to a person lives in `pomodoro_copy.ts`, not in the timer.

## Background
- The pomodoro notification carries its own notification tag in `notification_alerts.ts`, so a finished period and a posture reminder never replace one another on the screen.

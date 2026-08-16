# Directory Context: `/web/js/settings`

## Purpose
Holds the settings panel: the modal dialog that carries the camera settings.

## Key Exports & Entry Points
- `settings_dialog.ts`: `SettingsDialog`, which opens the panel and reports a press of restore defaults through its `onRestoreDefaults` callback.

## Rules
- This folder only writes to the elements of the settings dialog itself. Everything else on the monitor screen belongs to `MonitorView`, including the facial landmark switch inside this panel, because that switch acts as soon as it is pressed and its position is written from the running session.
- Every setting of this panel acts at once, so the panel has no save button and nothing here reads or writes local browser storage.
- The pomodoro parameters belong to the Pomodoro settings panel in `../pomodoro/pomodoro_dialog.ts` and the notification setup to the Notification settings panel in `../notifications/notification_dialog.ts`. Nothing here restates a value, a default or a storage key of either.
- Restore defaults covers the settings of this panel alone: `main.ts` puts the facial landmark drawing back through `onRestoreDefaults`. The other two panels each restore their own defaults.

## Background
- This panel held the pomodoro parameters and the notification permission before each of them was given a panel of its own.

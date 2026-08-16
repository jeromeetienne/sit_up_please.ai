# Directory Context: `/web/js/settings`

## Purpose
Holds the Situp settings panel: the modal dialog that carries the camera settings and the situp settings, which are the values that decide when a posture counts as a slouch and how the session is timed.

## Key Exports & Entry Points
- `settings_dialog.ts`: `SettingsDialog`, which opens the panel, reports the saved situp settings through its `onSaved` callback and a press of restore defaults through its `onRestoreDefaults` callback.
- `situp_settings.ts`: `SitupSettings.load()`, `SitupSettings.save()` and `SitupSettings.tolerancesOf()`, the defaults in `SITUP_DEFAULT_SETTINGS`, and the accepted range of every setting in `SITUP_SETTINGS_RANGES`.

## Rules
- The situp settings are the two tolerances, the slouch time before the alert, the calibration countdown and the reading rate. Their defaults, their storage key and their ranges live in `situp_settings.ts`, and nothing else restates any of them: `../monitor/monitor_session.ts` and `../posture/posture_tracker.ts` are handed the values by `../main.ts` instead of reading storage themselves.
- Nothing outside this folder learns how a situp setting is named or stored: the posture tracker is handed a `PostureTolerances` from `SitupSettings.tolerancesOf()`, so `../posture` never imports from here.
- `PostureReference.BAD_LEAN_THRESHOLD` is not a situp setting and this panel does not offer it. The reading is scaled by the very same value it is then compared against, so moving it would change nothing; the two tolerances are what decide how easily a posture counts as a slouch.
- The situp settings are stored on save, and the facial landmark switch acts as soon as it is pressed. That switch belongs to `MonitorView`, because its position is written from the running session, and this folder only writes to the elements of the Situp settings panel itself.
- The pomodoro parameters belong to the Pomodoro settings panel in `../pomodoro/pomodoro_dialog.ts` and the notification setup to the Notification settings panel in `../notifications/notification_dialog.ts`. Nothing here restates a value, a default or a storage key of either.
- Restore defaults covers the settings of the Situp settings panel alone: it puts the situp settings back in the fields of the panel, where save stores them, and `main.ts` puts the facial landmark drawing back at once through `onRestoreDefaults`. The other two panels each restore their own defaults.

## Background
- The Situp settings panel held the pomodoro parameters and the notification permission before each of them was given a panel of its own.
- The situp settings were fixed constants in `../monitor/monitor_session.ts` and `../posture/posture_reference.ts` before this panel could edit them, and their defaults are the values those constants carried.

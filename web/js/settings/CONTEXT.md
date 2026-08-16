# Directory Context: `/web/js/settings`

## Purpose
Holds the settings panel: the modal dialog that edits the pomodoro parameters and stores them.

## Key Exports & Entry Points
- `settings_dialog.ts`: `SettingsDialog`, which fills its fields from `PomodoroSettings.load()`, writes them back with `PomodoroSettings.save()`, reports the saved values through its `onSaved` callback, and reports a press of restore defaults through its `onRestoreDefaults` callback.

## Rules
- The shape of the settings and their defaults live in `../pomodoro/pomodoro_settings.ts`; nothing here restates a default value or a storage key.
- This folder only writes to the elements of the settings dialog itself. Everything else on the monitor screen belongs to `MonitorView`.
- Restore defaults covers every setting of the panel, not only the pomodoro parameters: this folder fills its own fields, and `main.ts` puts back the settings it owns through `onRestoreDefaults` — the facial landmark drawing, the desktop alerts and the running timer.
- A field left empty, or holding a value outside its range, falls back to the default for that parameter instead of stopping the save, so the panel can never store a length of zero.

## Background
- The panel edits values a running cycle already depends on, so `MonitorSession.applyPomodoroSettings` decides what a change means for the period counting down at that moment.

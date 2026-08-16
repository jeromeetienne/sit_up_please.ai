# Directory Context: `/web/js/notifications`

## Purpose
Holds everything that tells a person something has happened: the desktop notification, the sound catalogue, the notification setup of every event, and the Notification settings panel that edits that setup.

## Key Exports & Entry Points
- `notification_alerts.ts`: `NotificationAlerts`, which holds the browser notification permission, shows the desktop notifications and plays the sounds. `main.ts` builds one and hands it to `MonitorSession` through its callbacks.
- `notification_dialog.ts`: `NotificationDialog`, the Notification settings panel that sets up every event, reports the saved setup through its `onSaved` callback and a press of a play button through its `onPlaySample` callback.
- `notification_settings.ts`: `NotificationSettings.load()` and `NotificationSettings.save()`, the defaults, and the list of events.
- `notification_sounds.ts`: `NotificationSounds`, the catalogue of sounds an event can play.
- `notification_types.ts`: the shapes the four files above share.

## Rules
- The catalogue in `notification_sounds.ts` is the one place a sound is named and its notes are written. The Notification settings panel builds its sound lists from the catalogue, so a sound added there appears in the Notification settings panel without any change to `../../index.html`.
- The defaults and the storage key live in `notification_settings.ts`; nothing else restates a default value or reads that key.
- Every value read back from storage is checked against the catalogue and its range before it is used, so a setup stored by an older version of the application can never ask for a sound that no longer exists.
- The allow notifications and sounds switch at the top of the Notification settings panel stands above the setup of every event: it holds the browser permission, takes effect as soon as it is pressed rather than on save, and while it is off no event notifies at all.
- This folder only writes to the elements of the Notification settings panel itself. Everything else on the monitor screen belongs to `MonitorView`, including the button of the navigation bar that opens this panel.
- The play button plays the sound whether or not the event is set to make one, because a person pressing it is tuning the sound rather than waiting for the event, and it plays it at the master volume as well, so what is heard is what the event will sound like.
- The master volume multiplies the volume of every event, and is stored on save like any other field of the Notification settings panel; only `notification_alerts.ts` applies it, in one place, so no caller has to remember it.
- A sustained slouch and a corrected posture take, by default, the one sound built to be heard as clearly bad and the one built to be heard as clearly good: the first falls, is low and buzzes, the second rises, is high and is clear.
- A sustained slouch keeps its own repeat and escalation timing here; the chosen sound and volume decide what is played, not how often or how much louder.

## Background
- The escalation stages, their repeat intervals and their loudness come from the sustained slouch being a condition that continues, while a finished pomodoro period is one event and plays its sound once.

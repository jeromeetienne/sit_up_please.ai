///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Types — the events that raise a notification, and how each one notifies
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * One event of the application that can raise a notification. Every event is
 * set up on its own, so a person who wants a sound for a finished work period
 * and nothing at all for a corrected posture can say exactly that.
 */
export type NotificationEventKind =
	| 'posture-slouch'
	| 'posture-corrected'
	| 'work-period-finished'
	| 'break-finished';

/** One sound of the catalogue an event can be set to play. */
export type NotificationSoundName =
	| 'rising-two-note'
	| 'falling-two-note'
	| 'rising-three-note-chime'
	| 'falling-three-note-chime'
	| 'urgent-triple'
	| 'single-beep'
	| 'low-double-knock';

/** One sound's shape: the notes it plays, how loud, and how long each note lasts. */
export type ToneSequence = {
	/** The note frequencies played one after another, in hertz. */
	frequencies: number[];
	/** The loudness the sound reaches at full volume, between 0 and 1. */
	peakGain: number;
	/** How long each note of the sound lasts, in seconds. */
	noteDurationSec: number;
};

/** How one event notifies: with a desktop notification, with a sound, or with neither. */
export type NotificationEventSettings = {
	/** Whether this event shows a desktop notification. */
	showsDesktopNotification: boolean;
	/** Whether this event plays a sound. */
	playsSound: boolean;
	/** Which sound of the catalogue this event plays. */
	soundName: NotificationSoundName;
	/** How loud this event plays its sound, between 0 and 1. */
	volume: number;
};

/** The notification setup of every event, one entry per event. */
export type NotificationSettingsValues = Record<NotificationEventKind, NotificationEventSettings>;

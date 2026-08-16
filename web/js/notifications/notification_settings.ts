import type {
	NotificationEventKind,
	NotificationEventSettings,
	NotificationEventSettingsValues,
	NotificationSettingsValues,
} from './notification_types';
import { NotificationSounds } from './notification_sounds';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	NotificationSettings — reads and writes the notification setup of every event
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const SETTINGS_STORAGE_KEY = 'sit-up-please.notification-settings.v1';

/** Every event that can raise a notification, in the order the panel lists them. */
export const NOTIFICATION_EVENT_KINDS: NotificationEventKind[] = [
	'posture-slouch',
	'posture-corrected',
	'work-period-finished',
	'break-finished',
];

/**
 * The events that cannot show a desktop notification, whatever the stored
 * setting says. A corrected posture only takes the notification of the slouch
 * off the screen, so a desktop notification of its own would announce the end
 * of something the person has already put right.
 */
export const EVENTS_WITHOUT_DESKTOP_NOTIFICATION: NotificationEventKind[] = ['posture-corrected'];

/**
 * The setup used when the browser has nothing stored from an earlier visit:
 * every event notifies, the master volume is full, and each event carries a
 * sound of its own so the reason for a sound is never in doubt. A sustained
 * slouch and a corrected posture take the two sounds built to be told apart at
 * once, the first clearly bad and the second clearly good.
 */
export const NOTIFICATION_DEFAULT_SETTINGS: NotificationSettingsValues = {
	masterVolume: 1,
	events: {
		'posture-slouch': {
			showsDesktopNotification: true,
			playsSound: true,
			soundName: 'low-descending-buzz',
			volume: 0.7,
		},
		'posture-corrected': {
			showsDesktopNotification: false,
			playsSound: true,
			soundName: 'bright-rising-arpeggio',
			volume: 0.4,
		},
		'work-period-finished': {
			showsDesktopNotification: true,
			playsSound: true,
			soundName: 'falling-two-note',
			volume: 0.6,
		},
		'break-finished': {
			showsDesktopNotification: true,
			playsSound: true,
			soundName: 'rising-two-note',
			volume: 0.6,
		},
	},
};

/**
 * Reads and writes the notification setup in local browser storage. Every value
 * read back is checked against the catalogue and its range, so a setup stored by
 * an older version of the application can never ask for a sound that no longer
 * exists or a volume outside 0 to 1.
 */
export class NotificationSettings {
	/** Returns the stored setup, filling in every absent or unusable value from the defaults. */
	static load(): NotificationSettingsValues {
		try {
			const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
			if (stored === null) return NotificationSettings.copyOf(NOTIFICATION_DEFAULT_SETTINGS);
			const parsed = JSON.parse(stored) as unknown;
			return NotificationSettings._sanitised(parsed);
		} catch {
			return NotificationSettings.copyOf(NOTIFICATION_DEFAULT_SETTINGS);
		}
	}

	/**
	 * Stores the setup, and does nothing when browser storage is unavailable.
	 *
	 * @param settings - The notification setup of every event.
	 * @returns Nothing.
	 */
	static save(settings: NotificationSettingsValues): void {
		try {
			localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
		} catch {
			// An unavailable storage only costs the setup its history.
		}
	}

	/**
	 * Returns a copy of one setup, so a caller can edit its own copy without
	 * writing over the defaults or over the setup another part is still using.
	 *
	 * @param settings - The notification setup to copy.
	 * @returns A copy holding one new entry per event.
	 */
	static copyOf(settings: NotificationSettingsValues): NotificationSettingsValues {
		const events = {} as NotificationEventSettingsValues;
		for (const eventKind of NOTIFICATION_EVENT_KINDS) {
			events[eventKind] = { ...settings.events[eventKind] };
		}
		return {
			masterVolume: settings.masterVolume,
			events: events,
		};
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Returns one usable setup built from stored values and the defaults. A setup
	 * stored before the master volume existed holds one entry per event at its top
	 * level instead of an events entry, and is read just as well: its events are
	 * kept and the master volume takes its default.
	 */
	private static _sanitised(parsed: unknown): NotificationSettingsValues {
		if (parsed === null || typeof parsed !== 'object') return NotificationSettings.copyOf(NOTIFICATION_DEFAULT_SETTINGS);
		const values = parsed as Partial<NotificationSettingsValues>;
		const storedEvents = (values.events === null || typeof values.events !== 'object'
			? parsed
			: values.events) as Partial<Record<NotificationEventKind, unknown>>;

		const events = {} as NotificationEventSettingsValues;
		for (const eventKind of NOTIFICATION_EVENT_KINDS) {
			events[eventKind] = NotificationSettings._sanitisedEvent(
				storedEvents[eventKind],
				NOTIFICATION_DEFAULT_SETTINGS.events[eventKind],
			);
		}

		return {
			masterVolume: NotificationSettings._sanitisedVolume(
				values.masterVolume,
				NOTIFICATION_DEFAULT_SETTINGS.masterVolume,
			),
			events: events,
		};
	}

	/** Returns one volume held inside 0 to 1, or its default when the stored value is no usable number. */
	private static _sanitisedVolume(stored: unknown, fallback: number): number {
		if (typeof stored !== 'number' || Number.isFinite(stored) === false) return fallback;
		return Math.min(1, Math.max(0, stored));
	}

	/** Returns one usable event entry built from a stored value and its default. */
	private static _sanitisedEvent(stored: unknown, fallback: NotificationEventSettings): NotificationEventSettings {
		if (stored === null || typeof stored !== 'object') return { ...fallback };
		const values = stored as Partial<NotificationEventSettings>;

		const volume = NotificationSettings._sanitisedVolume(values.volume, fallback.volume);

		return {
			showsDesktopNotification: typeof values.showsDesktopNotification === 'boolean'
				? values.showsDesktopNotification
				: fallback.showsDesktopNotification,
			playsSound: typeof values.playsSound === 'boolean' ? values.playsSound : fallback.playsSound,
			soundName: NotificationSounds.isKnownName(values.soundName) ? values.soundName : fallback.soundName,
			volume: volume,
		};
	}
}

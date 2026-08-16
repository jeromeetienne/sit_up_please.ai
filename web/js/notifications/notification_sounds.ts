import type { NotificationSoundName, ToneSequence } from './notification_types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	NotificationSounds — the catalogue of sounds an event can be set to play
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** One entry of the catalogue: the words shown in the panel and the notes played. */
type CatalogueEntry = {
	/** The name of the sound as the settings panel writes it. */
	label: string;
	/** The notes the sound plays, at full volume. */
	tone: ToneSequence;
};

/**
 * Every sound of the catalogue. They all carry the same peak loudness, so the
 * volume of an event means the same thing whichever sound the event is set to,
 * and they differ only in their notes and their pace.
 */
const SOUND_CATALOGUE: Record<NotificationSoundName, CatalogueEntry> = {
	'rising-two-note': {
		label: 'Rising two-note',
		tone: {
			frequencies: [660, 880],
			peakGain: 0.25,
			noteDurationSec: 0.15,
		},
	},
	'falling-two-note': {
		label: 'Falling two-note',
		tone: {
			frequencies: [880, 660],
			peakGain: 0.25,
			noteDurationSec: 0.15,
		},
	},
	'rising-three-note-chime': {
		label: 'Rising three-note chime',
		tone: {
			frequencies: [523, 659, 784],
			peakGain: 0.25,
			noteDurationSec: 0.12,
		},
	},
	'falling-three-note-chime': {
		label: 'Falling three-note chime',
		tone: {
			frequencies: [784, 659, 523],
			peakGain: 0.25,
			noteDurationSec: 0.12,
		},
	},
	'urgent-triple': {
		label: 'Urgent triple',
		tone: {
			frequencies: [740, 1000, 1300],
			peakGain: 0.25,
			noteDurationSec: 0.09,
		},
	},
	'single-beep': {
		label: 'Single beep',
		tone: {
			frequencies: [880],
			peakGain: 0.25,
			noteDurationSec: 0.2,
		},
	},
	'low-double-knock': {
		label: 'Low double knock',
		tone: {
			frequencies: [196, 196],
			peakGain: 0.25,
			noteDurationSec: 0.11,
		},
	},
};

/**
 * The one place that knows which sounds exist, what each one is called on the
 * screen, and which notes it plays. The settings panel builds its sound lists
 * from this catalogue, so a sound added here appears in the panel on its own.
 */
export class NotificationSounds {
	/** Returns every sound name of the catalogue, in the order the panel lists them. */
	static allNames(): NotificationSoundName[] {
		return Object.keys(SOUND_CATALOGUE) as NotificationSoundName[];
	}

	/**
	 * Returns the name of one sound as the settings panel writes it.
	 *
	 * @param soundName - The sound of the catalogue to name.
	 * @returns The words the settings panel shows for that sound.
	 */
	static labelFor(soundName: NotificationSoundName): string {
		return SOUND_CATALOGUE[soundName].label;
	}

	/**
	 * Returns the notes one sound plays, at full volume.
	 *
	 * @param soundName - The sound of the catalogue to play.
	 * @returns The tone sequence of that sound.
	 */
	static toneFor(soundName: NotificationSoundName): ToneSequence {
		return SOUND_CATALOGUE[soundName].tone;
	}

	/**
	 * Returns whether a stored value names a sound this catalogue still holds,
	 * so a setting stored by an older version of the application cannot ask for
	 * a sound that no longer exists.
	 *
	 * @param value - The stored value to check.
	 * @returns Whether the value names a sound of the catalogue.
	 */
	static isKnownName(value: unknown): value is NotificationSoundName {
		return typeof value === 'string' && Object.prototype.hasOwnProperty.call(SOUND_CATALOGUE, value);
	}
}

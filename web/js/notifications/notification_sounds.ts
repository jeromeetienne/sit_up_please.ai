import type { NotificationSoundName, ToneSequence } from './notification_types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	NotificationSounds — the catalogue of sounds an event can be set to play
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** One entry of the catalogue: the words shown in the panel and the notes played. */
type CatalogueEntry = {
	/** The name of the sound as the Notification settings panel writes it. */
	label: string;
	/** The notes the sound plays, at full volume. */
	tone: ToneSequence;
};

/**
 * Every sound of the catalogue. They all sound about equally loud, so the volume
 * of an event means the same thing whichever sound the event is set to: a rough
 * wave carries more energy than a smooth one at the same peak, so its peak is
 * set lower to make up for it.
 *
 * The first two sounds are the pair a person hears most. They are built to be
 * told apart without looking at the screen and without learning them first: the
 * warning falls, is low, and buzzes, while the reward rises, is high, and is
 * clear. Falling and low and rough is heard as something going wrong in every
 * culture; rising and high and clean is heard as something going right.
 */
const SOUND_CATALOGUE: Record<NotificationSoundName, CatalogueEntry> = {
	'low-descending-buzz': {
		label: 'Low descending buzz (clearly bad)',
		tone: {
			frequencies: [311, 233, 156],
			waveform: 'sawtooth',
			peakGain: 0.14,
			noteDurationSec: 0.16,
		},
	},
	'bright-rising-arpeggio': {
		label: 'Bright rising arpeggio (clearly good)',
		tone: {
			frequencies: [523, 659, 784, 1047],
			waveform: 'triangle',
			peakGain: 0.2,
			noteDurationSec: 0.1,
		},
	},
	'rising-two-note': {
		label: 'Rising two-note',
		tone: {
			frequencies: [660, 880],
			waveform: 'sine',
			peakGain: 0.25,
			noteDurationSec: 0.15,
		},
	},
	'falling-two-note': {
		label: 'Falling two-note',
		tone: {
			frequencies: [880, 660],
			waveform: 'sine',
			peakGain: 0.25,
			noteDurationSec: 0.15,
		},
	},
	'rising-three-note-chime': {
		label: 'Rising three-note chime',
		tone: {
			frequencies: [523, 659, 784],
			waveform: 'sine',
			peakGain: 0.25,
			noteDurationSec: 0.12,
		},
	},
	'falling-three-note-chime': {
		label: 'Falling three-note chime',
		tone: {
			frequencies: [784, 659, 523],
			waveform: 'sine',
			peakGain: 0.25,
			noteDurationSec: 0.12,
		},
	},
	'urgent-triple': {
		label: 'Urgent triple',
		tone: {
			frequencies: [740, 1000, 1300],
			waveform: 'sine',
			peakGain: 0.25,
			noteDurationSec: 0.09,
		},
	},
	'single-beep': {
		label: 'Single beep',
		tone: {
			frequencies: [880],
			waveform: 'sine',
			peakGain: 0.25,
			noteDurationSec: 0.2,
		},
	},
	'low-double-knock': {
		label: 'Low double knock',
		tone: {
			frequencies: [196, 196],
			waveform: 'sine',
			peakGain: 0.25,
			noteDurationSec: 0.11,
		},
	},
};

/**
 * The one place that knows which sounds exist, what each one is called on the
 * screen, and which notes it plays. The Notification settings panel builds its
 * sound lists from this catalogue, so a sound added here appears in the panel on
 * its own.
 */
export class NotificationSounds {
	/** Returns every sound name of the catalogue, in the order the panel lists them. */
	static allNames(): NotificationSoundName[] {
		return Object.keys(SOUND_CATALOGUE) as NotificationSoundName[];
	}

	/**
	 * Returns the name of one sound as the Notification settings panel writes it.
	 *
	 * @param soundName - The sound of the catalogue to name.
	 * @returns The words the Notification settings panel shows for that sound.
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

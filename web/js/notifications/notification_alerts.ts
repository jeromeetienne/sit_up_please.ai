import type { NotificationEventKind, NotificationSettingsValues, NotificationSoundName, ToneSequence } from './notification_types';
import type { PomodoroAlertContent, PomodoroToneKind } from '../pomodoro/pomodoro_types';
import type { PostureAlertContent } from '../monitor/monitor_types';
import { NotificationSettings } from './notification_settings';
import { NotificationSounds } from './notification_sounds';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	NotificationAlerts — the optional desktop alert and its tone
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const NOTIFICATION_TAG = 'sit-up-please-posture-reminder';

/**
 * A tag of its own, so a finished pomodoro period never replaces a posture
 * reminder already on the screen, and never gets replaced by one either.
 */
const POMODORO_NOTIFICATION_TAG = 'sit-up-please-pomodoro-period';

/** Which notification event each pomodoro tone kind belongs to. */
const POMODORO_EVENT_KIND: Record<PomodoroToneKind, NotificationEventKind> = {
	'work-finished': 'work-period-finished',
	'break-finished': 'break-finished',
};

/**
 * How much louder each stage of a sustained bad posture plays than the sound
 * chosen for it, so the alert still grows stronger the longer the slouch
 * continues whichever sound and volume the person has chosen.
 */
const ALERT_STAGE_LOUDNESS = [0.6, 0.85, 1.1, 1.4];

/** The loudest any sound may play, whatever the volume and the stage ask for. */
const LOUDNESS_CEILING = 0.6;

/** How long one note takes to reach its peak, in seconds. Short enough to be crisp, long enough not to click. */
const NOTE_ATTACK_SEC = 0.012;

/** The share of one note's length its fall back to silence ends at, which leaves a small gap before the next note. */
const NOTE_DECAY_SHARE = 0.9;

/** The bad-posture seconds at which each later stage takes over from the last. */
const ALERT_STAGE_BOUNDARIES_SEC = [20, 60, 120];

/** How often the tone repeats while stage 0, 1 or 2 continues. */
const ALERT_REPEAT_INTERVAL_SEC = [15, 15, 12];

/** Stage 3 starts repeating this often, then closes in on the floor below the longer it continues. */
const ALERT_STAGE3_REPEAT_START_SEC = 20;
const ALERT_STAGE3_REPEAT_FLOOR_SEC = 10;
const ALERT_STAGE3_SHRINK_WINDOW_SEC = 60;

/**
 * Alerts a sustained bad posture as a desktop notification with a tone that
 * repeats and grows stronger for as long as the slouch continues, for the
 * times when the page is not the window in front of the person. A pleasant
 * chime plays once the posture is corrected. Off until the person turns it on.
 *
 * Every event is set up on its own in the notification panel: whether it shows
 * a desktop notification, whether it plays a sound, which sound, and how loud.
 * The single switch this class carries stands above that setup: it holds the
 * browser permission, and while it is off no event notifies at all.
 */
export class NotificationAlerts {
	private _isEnabled: boolean;
	private _settings: NotificationSettingsValues = NotificationSettings.load();
	private _notification: Notification | undefined;
	private _pomodoroNotification: Notification | undefined;
	private _audioContext: AudioContext | undefined;
	private _lastToneAtSec: number | undefined;

	/**
	 * Starts already on when the browser remembers a permission grant from an
	 * earlier visit, so a returning person keeps getting alerts without having
	 * to press the footer button again every time the page loads.
	 */
	constructor() {
		this._isEnabled = NotificationAlerts._defaultEnabled();
	}

	/** Whether this browser offers desktop notifications at all. */
	get isSupported(): boolean {
		return 'Notification' in window;
	}

	/** Whether notifications and sounds are currently allowed. */
	get isEnabled(): boolean {
		return this._isEnabled;
	}

	/** The notification setup of every event, as it stands right now. */
	get settings(): NotificationSettingsValues {
		return NotificationSettings.copyOf(this._settings);
	}

	/**
	 * Takes a new notification setup, from the notification panel.
	 *
	 * @param settings - The notification setup of every event.
	 * @returns Nothing.
	 */
	applySettings(settings: NotificationSettingsValues): void {
		this._settings = NotificationSettings.copyOf(settings);
	}

	/**
	 * Creates the audio context from a direct user action, so a later alert can
	 * play its tone without relying on autoplay access.
	 */
	prepareAudio(): void {
		if (this._audioContext !== undefined) return;
		this._audioContext = new AudioContext();
	}

	/**
	 * Plays one event's sound at one volume, so a person setting the panel up
	 * hears what the event will sound like before leaving the panel. It plays
	 * whether or not the event is set to make a sound, because the person is
	 * tuning the sound rather than waiting for the event.
	 *
	 * @param soundName - The sound of the catalogue to play.
	 * @param volume - How loud to play it, between 0 and 1.
	 * @returns Nothing.
	 */
	playSample(soundName: NotificationSoundName, volume: number): void {
		this.prepareAudio();
		this._playToneSequence(NotificationSounds.toneFor(soundName), volume);
	}

	/**
	 * Allows notifications and sounds, or forbids them, asking for the browser
	 * permission the first time. Returns whether they are allowed after the change.
	 */
	async setEnabled(isEnabled: boolean): Promise<boolean> {
		if (isEnabled === false || this.isSupported === false) {
			this._isEnabled = false;
			this.clear();
			return this._isEnabled;
		}

		const permission = Notification.permission === 'granted'
			? 'granted'
			: await Notification.requestPermission();
		this._isEnabled = permission === 'granted';
		return this._isEnabled;
	}

	/**
	 * Puts notifications and sounds back to the state a fresh page load would
	 * give them: allowed when the browser has already granted permission,
	 * forbidden otherwise. Never asks for permission, so pressing restore
	 * defaults raises no prompt. Returns whether they are allowed after the change.
	 */
	restoreDefault(): boolean {
		const isEnabled = NotificationAlerts._defaultEnabled();
		if (isEnabled === false) {
			this.clear();
		}
		this._isEnabled = isEnabled;
		return this._isEnabled;
	}

	/**
	 * Asks for notification permission the first time monitoring starts,
	 * instead of waiting for the person to find and press the separate footer
	 * button. Only ever prompts once: it does nothing once the browser has
	 * already decided (granted or denied), so it never re-prompts and never
	 * overrides a person who has since turned alerts back off.
	 */
	async requestOnFirstStart(): Promise<boolean> {
		if (this.isSupported === false || Notification.permission !== 'default') return this._isEnabled;
		const permission = await Notification.requestPermission();
		this._isEnabled = permission === 'granted';
		return this._isEnabled;
	}

	/** Shows one desktop alert for a sustained bad posture. */
	show(content: PostureAlertContent): void {
		if (this._canShowDesktopNotification('posture-slouch') === false) return;

		this._notification?.close();
		this._notification = new Notification(content.title, {
			body: content.body,
			tag: NOTIFICATION_TAG,
			requireInteraction: true,
		});
	}

	/**
	 * Announces a finished pomodoro period with its own desktop notification
	 * and its own tone.
	 *
	 * A posture alert already on the screen is closed first, and its tone
	 * stopped, without the reward chime: the slouch has not been corrected, it
	 * has only been overtaken by the end of the period, and two sounds at once
	 * would say nothing clearly.
	 */
	announcePomodoro(content: PomodoroAlertContent, toneKind: PomodoroToneKind): void {
		this._notification?.close();
		this._notification = undefined;
		this._lastToneAtSec = undefined;

		if (this._isEnabled === false) return;

		const eventKind = POMODORO_EVENT_KIND[toneKind];
		if (this._canShowDesktopNotification(eventKind)) {
			this._pomodoroNotification?.close();
			this._pomodoroNotification = new Notification(content.title, {
				body: content.body,
				tag: POMODORO_NOTIFICATION_TAG,
				requireInteraction: true,
			});
		}
		this._playEventSound(eventKind, 1);
	}

	/** Closes the visible pomodoro notification, when the timer is switched off. */
	clearPomodoro(): void {
		this._pomodoroNotification?.close();
		this._pomodoroNotification = undefined;
	}

	/**
	 * Plays the alert tone for as long as the bad posture continues, growing
	 * louder and more insistent the longer it is ignored. Meant to be called
	 * on every posture reading while the alert is active: it plays the first
	 * tone right away, then repeats on its own schedule rather than on every
	 * call.
	 */
	escalate(badRunSec: number): void {
		if (this._isEnabled === false) return;

		const stage = NotificationAlerts._stageFor(badRunSec);
		const repeatIntervalSec = NotificationAlerts._repeatIntervalFor(stage, badRunSec);
		if (this._lastToneAtSec !== undefined && badRunSec - this._lastToneAtSec < repeatIntervalSec) return;

		this._lastToneAtSec = badRunSec;
		this._playEventSound('posture-slouch', ALERT_STAGE_LOUDNESS[stage]);
	}

	/**
	 * Closes the visible desktop alert once the posture is corrected, and
	 * plays a pleasant chime in reward when an alert had actually been
	 * escalating.
	 */
	clear(): void {
		this._notification?.close();
		this._notification = undefined;

		const wasEscalating = this._lastToneAtSec !== undefined;
		this._lastToneAtSec = undefined;
		if (wasEscalating) {
			this._playEventSound('posture-corrected', 1);
		}
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/** Whether notifications and sounds start allowed: only when this browser already grants them. */
	private static _defaultEnabled(): boolean {
		return 'Notification' in window && Notification.permission === 'granted';
	}

	/** Returns which escalation stage a sustained bad posture has reached. */
	private static _stageFor(badRunSec: number): number {
		let stage = 0;
		for (const boundarySec of ALERT_STAGE_BOUNDARIES_SEC) {
			if (badRunSec < boundarySec) break;
			stage += 1;
		}
		return stage;
	}

	/**
	 * Returns how long to wait before the tone repeats again. Stage 3 closes
	 * in on its floor the longer the bad posture continues, instead of
	 * holding a fixed pace.
	 */
	private static _repeatIntervalFor(stage: number, badRunSec: number): number {
		if (stage < ALERT_REPEAT_INTERVAL_SEC.length) return ALERT_REPEAT_INTERVAL_SEC[stage];

		const secSinceStage3 = badRunSec - ALERT_STAGE_BOUNDARIES_SEC[ALERT_STAGE_BOUNDARIES_SEC.length - 1];
		const shrinkShare = Math.min(1, secSinceStage3 / ALERT_STAGE3_SHRINK_WINDOW_SEC);
		return ALERT_STAGE3_REPEAT_START_SEC - shrinkShare * (ALERT_STAGE3_REPEAT_START_SEC - ALERT_STAGE3_REPEAT_FLOOR_SEC);
	}

	/**
	 * Whether one event may show a desktop notification right now: the single
	 * permission switch is on, the browser offers notifications, it has granted
	 * permission, and the event is set up to show one.
	 */
	private _canShowDesktopNotification(eventKind: NotificationEventKind): boolean {
		if (this._isEnabled === false || this.isSupported === false) return false;
		if (Notification.permission !== 'granted') return false;
		return this._settings.events[eventKind].showsDesktopNotification;
	}

	/**
	 * Plays the sound one event is set up to play, at the loudness its stage asks
	 * for, turned down by the master volume.
	 */
	private _playEventSound(eventKind: NotificationEventKind, stageLoudness: number): void {
		const eventSettings = this._settings.events[eventKind];
		if (eventSettings.playsSound === false) return;
		this._playToneSequence(
			NotificationSounds.toneFor(eventSettings.soundName),
			eventSettings.volume * stageLoudness * this._settings.masterVolume,
		);
	}

	/**
	 * Plays a short tone made of one or more notes in a row, at one volume. Every
	 * note gets its own rise and fall, so a sound of several notes is heard as
	 * several notes instead of as one long swell, which is what makes one sound
	 * easy to tell from another.
	 */
	private _playToneSequence(tone: ToneSequence, volume: number): void {
		const audioContext = this._audioContext;
		if (audioContext === undefined) return;

		const peakGain = Math.min(LOUDNESS_CEILING, tone.peakGain * volume);
		if (peakGain <= 0.0001) return;

		void audioContext.resume().then(() => {
			const oscillator = audioContext.createOscillator();
			const gain = audioContext.createGain();
			const now = audioContext.currentTime;
			const totalDurationSec = tone.frequencies.length * tone.noteDurationSec;

			oscillator.type = tone.waveform;
			gain.gain.setValueAtTime(0.0001, now);
			tone.frequencies.forEach((frequency, index) => {
				const noteStartSec = now + index * tone.noteDurationSec;
				oscillator.frequency.setValueAtTime(frequency, noteStartSec);
				gain.gain.setValueAtTime(0.0001, noteStartSec);
				gain.gain.exponentialRampToValueAtTime(peakGain, noteStartSec + NOTE_ATTACK_SEC);
				gain.gain.exponentialRampToValueAtTime(0.0001, noteStartSec + tone.noteDurationSec * NOTE_DECAY_SHARE);
			});
			oscillator.connect(gain).connect(audioContext.destination);
			oscillator.start(now);
			oscillator.stop(now + totalDurationSec);
		}).catch(() => {
			// The visible reminder remains available when audio is blocked.
		});
	}
}

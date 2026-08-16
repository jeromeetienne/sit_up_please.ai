import type { PomodoroAlertContent, PomodoroToneKind } from '../pomodoro/pomodoro_types';
import type { PostureAlertContent } from '../monitor/monitor_types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	NotificationAlerts — the optional desktop alert and its two-note tone
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const NOTIFICATION_TAG = 'sit-up-please-posture-reminder';

/**
 * A tag of its own, so a finished pomodoro period never replaces a posture
 * reminder already on the screen, and never gets replaced by one either.
 */
const POMODORO_NOTIFICATION_TAG = 'sit-up-please-pomodoro-period';

/** One tone's shape: the notes it plays, how loud, and how long each note lasts. */
type ToneSequence = {
	frequencies: number[];
	peakGain: number;
	noteDurationSec: number;
};

/**
 * The tone that plays for each stage of a sustained bad posture, growing
 * louder, higher-pitched, and busier the longer the slouch continues.
 */
const ALERT_TONE_STAGES: ToneSequence[] = [
	{ frequencies: [660, 880], peakGain: 0.15, noteDurationSec: 0.15 },
	{ frequencies: [740, 1000], peakGain: 0.22, noteDurationSec: 0.13 },
	{ frequencies: [700, 950, 1200], peakGain: 0.28, noteDurationSec: 0.1 },
	{ frequencies: [740, 1000, 1300], peakGain: 0.35, noteDurationSec: 0.08 },
];

/** The pleasant chime that plays once a sustained bad posture is corrected. */
const REWARD_CHIME: ToneSequence = { frequencies: [523, 659, 784], peakGain: 0.1, noteDurationSec: 0.12 };

/**
 * The tone that plays when a pomodoro period finishes. Neither tone escalates:
 * a period ending is one event, not a condition that continues. The two tones
 * are also plainly different from the posture alert tone and from the reward
 * chime, so the reason for a sound is never in doubt.
 */
const POMODORO_TONES: Record<PomodoroToneKind, ToneSequence> = {
	'work-finished': { frequencies: [440, 330], peakGain: 0.18, noteDurationSec: 0.22 },
	'break-finished': { frequencies: [523, 784], peakGain: 0.18, noteDurationSec: 0.18 },
};

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
 */
export class NotificationAlerts {
	private _isEnabled: boolean;
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

	/** Whether desktop alerts are currently turned on. */
	get isEnabled(): boolean {
		return this._isEnabled;
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
	 * Turns desktop alerts on or off, asking for permission the first time.
	 * Returns whether alerts are on after the change.
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
	 * Puts desktop alerts back to the state a fresh page load would give them:
	 * on when the browser has already granted permission, off otherwise. Never
	 * asks for permission, so pressing restore defaults raises no prompt.
	 * Returns whether alerts are on after the change.
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
		if (this._isEnabled === false || this.isSupported === false) return;
		if (Notification.permission !== 'granted') return;

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

		if (this.isSupported && Notification.permission === 'granted') {
			this._pomodoroNotification?.close();
			this._pomodoroNotification = new Notification(content.title, {
				body: content.body,
				tag: POMODORO_NOTIFICATION_TAG,
				requireInteraction: true,
			});
		}
		this._playToneSequence(POMODORO_TONES[toneKind]);
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
		this._playToneSequence(ALERT_TONE_STAGES[stage]);
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
		if (wasEscalating) this._playToneSequence(REWARD_CHIME);
	}

	/** Whether desktop alerts start on: only when this browser already grants them. */
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

	/** Plays a short tone made of one or more notes in a row. */
	private _playToneSequence(tone: ToneSequence): void {
		const audioContext = this._audioContext;
		if (audioContext === undefined) return;

		void audioContext.resume().then(() => {
			const oscillator = audioContext.createOscillator();
			const gain = audioContext.createGain();
			const now = audioContext.currentTime;
			const totalDurationSec = tone.frequencies.length * tone.noteDurationSec;

			oscillator.type = 'sine';
			tone.frequencies.forEach((frequency, index) => {
				oscillator.frequency.setValueAtTime(frequency, now + index * tone.noteDurationSec);
			});
			gain.gain.setValueAtTime(0.0001, now);
			gain.gain.exponentialRampToValueAtTime(tone.peakGain, now + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.0001, now + totalDurationSec);
			oscillator.connect(gain).connect(audioContext.destination);
			oscillator.start(now);
			oscillator.stop(now + totalDurationSec);
		}).catch(() => {
			// The visible reminder remains available when audio is blocked.
		});
	}
}

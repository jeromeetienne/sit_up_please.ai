import type { PostureAlertContent } from './monitor_types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	NotificationAlerts — the optional desktop alert and its two-note tone
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const NOTIFICATION_TAG = 'sit-up-please-posture-reminder';

/**
 * Alerts a sustained bad posture as a desktop notification with a short tone,
 * for the times when the page is not the window in front of the person. It is
 * off until the person turns it on.
 */
export class NotificationAlerts {
	private _isEnabled: boolean;
	private _notification: Notification | undefined;
	private _audioContext: AudioContext | undefined;

	/**
	 * Starts already on when the browser remembers a permission grant from an
	 * earlier visit, so a returning person keeps getting alerts without having
	 * to press the footer button again every time the page loads.
	 */
	constructor() {
		this._isEnabled = this.isSupported && Notification.permission === 'granted';
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
		this._playTone();
	}

	/** Closes the visible desktop alert once the posture is corrected. */
	clear(): void {
		this._notification?.close();
		this._notification = undefined;
	}

	/** Plays a brief two-note tone alongside the desktop alert. */
	private _playTone(): void {
		const audioContext = this._audioContext;
		if (audioContext === undefined) return;

		void audioContext.resume().then(() => {
			const oscillator = audioContext.createOscillator();
			const gain = audioContext.createGain();
			const now = audioContext.currentTime;
			oscillator.type = 'sine';
			oscillator.frequency.setValueAtTime(660, now);
			oscillator.frequency.setValueAtTime(880, now + 0.12);
			gain.gain.setValueAtTime(0.0001, now);
			gain.gain.exponentialRampToValueAtTime(0.15, now + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
			oscillator.connect(gain).connect(audioContext.destination);
			oscillator.start(now);
			oscillator.stop(now + 0.3);
		}).catch(() => {
			// The visible reminder remains available when audio is blocked.
		});
	}
}

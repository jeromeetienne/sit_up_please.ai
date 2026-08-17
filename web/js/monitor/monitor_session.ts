import type { CameraState, ModelState, MonitorPhase, MonitorViewModel, PostureAlertContent, PostureDirection, PostureState, SessionBar, StateColour } from './monitor_types';
import type { PomodoroAlertContent, PomodoroToneKind } from '../pomodoro/pomodoro_types';
import type { PomodoroSettingsValues } from '../pomodoro/pomodoro_settings';
import type { SitupSettingsValues } from '../settings/situp_settings';
import { MonitorCopy } from './monitor_copy';
import { PomodoroCopy } from '../pomodoro/pomodoro_copy';
import { PomodoroSettings } from '../pomodoro/pomodoro_settings';
import { PomodoroTimer } from '../pomodoro/pomodoro_timer';
import { PostureReference } from '../posture/posture_reference';
import { PostureTracker } from '../posture/posture_tracker';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MonitorSession — the phase machine and the counters behind the one screen
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const CALIBRATION_STEP_MS = 900;
const RIBBON_BAR_SECONDS = 2;
const RIBBON_BAR_LIMIT = 72;

/** What the session tells the rest of the application when something changes. */
export type MonitorSessionCallbacks = {
	onUpdate: (viewModel: MonitorViewModel) => void;
	onAlertRaised: (content: PostureAlertContent) => void;
	onAlertTick: (badRunSec: number) => void;
	onAlertCleared: () => void;
	onPomodoroPeriodFinished: (content: PomodoroAlertContent, toneKind: PomodoroToneKind) => void;
	onPomodoroNotificationDismissed: () => void;
};

/**
 * Drives the single monitor screen: it moves between standing by, calibrating
 * and monitoring, reads the posture at the rate the Situp settings panel asks
 * for, keeps the session figures, and produces the values the interface draws.
 */
export class MonitorSession {
	private readonly _tracker: PostureTracker;
	private readonly _callbacks: MonitorSessionCallbacks;
	private readonly _pomodoroSettings = PomodoroSettings.load();
	private readonly _pomodoroTimer: PomodoroTimer;

	private _situpSettings: SitupSettingsValues;
	private _phase: MonitorPhase = 'idle';
	private _isPaused = false;
	private _posture: PostureState = 'good';
	private _lean = 0;
	private _direction: PostureDirection = 'forward';
	private _isReadingAvailable = false;
	private _calibrationCount: number;
	private _sessionSec = 0;
	private _goodSec = 0;
	private _goodRunSec = 0;
	private _badRunSec = 0;
	private _bestRunSec = 0;
	private _slipCount = 0;
	private _bars: SessionBar[] = [];
	private _isAlertActive = false;
	private _secondsSinceLastBar = 0;
	private _calibrationRun = 0;
	private _tickTimer: number | undefined;
	private _calibrationTimer: number | undefined;

	constructor(tracker: PostureTracker, callbacks: MonitorSessionCallbacks, situpSettings: SitupSettingsValues) {
		this._tracker = tracker;
		this._callbacks = callbacks;
		this._situpSettings = situpSettings;
		this._calibrationCount = situpSettings.calibrationCount;
		this._pomodoroTimer = new PomodoroTimer(this._pomodoroSettings, {
			onTick: () => this.publish(),
			onPeriodFinished: (finishedKind, nextKind, nextDurationSec) => {
				// The posture alert is dropped without the reward chime: the
				// end of the period, not a corrected posture, is what ends it.
				this._isAlertActive = false;
				const content = PomodoroCopy.finishedContent(
					finishedKind,
					nextKind,
					nextDurationSec,
					this._pomodoroSettings.startsNextPeriodAutomatically,
				);
				const toneKind: PomodoroToneKind = finishedKind === 'work' ? 'work-finished' : 'break-finished';
				this._callbacks.onPomodoroPeriodFinished(content, toneKind);
			},
		});
	}

	/**
	 * Takes the settings saved in the Situp settings panel. A new reading rate
	 * restarts the reading timer at once when the session is already running, so
	 * the new rate takes effect without calibrating again. The tolerances are the
	 * business of the posture tracker, which `main.ts` hands them to.
	 *
	 * @param settings - The situp settings as they were saved.
	 * @returns Nothing.
	 */
	applySitupSettings(settings: SitupSettingsValues): void {
		const wasReadingRateChanged = settings.readsPerSecond !== this._situpSettings.readsPerSecond;
		this._situpSettings = settings;
		if (wasReadingRateChanged && this._phase === 'running') {
			window.clearInterval(this._tickTimer);
			this._tickTimer = window.setInterval(() => this._tick(), this._tickIntervalMs);
		}
		this.publish();
	}

	/**
	 * Takes the settings saved in the Pomodoro settings panel. The same settings object
	 * is shared with the pomodoro timer, so both read the new values at once.
	 */
	applyPomodoroSettings(settings: PomodoroSettingsValues): void {
		this._pomodoroTimer.applySettings(settings);
		this.publish();
	}

	/** Starts the pomodoro cycle, starts the next period, or switches the timer off. */
	togglePomodoro(): void {
		this._pomodoroTimer.toggle();
		this._callbacks.onPomodoroNotificationDismissed();
		this.publish();
	}

	/** Switches the pomodoro timer off, whatever period it was counting down. */
	switchPomodoroOff(): void {
		this._pomodoroTimer.stop();
		this._callbacks.onPomodoroNotificationDismissed();
		this.publish();
	}

	/** Draws the screen for the first time, before anything has been watched. */
	publish(): void {
		this._callbacks.onUpdate(this._viewModel());
	}

	/**
	 * Opens the camera, then counts down through the number of counts the Situp
	 * settings panel asks for, while the person settles into the posture that
	 * becomes the reference.
	 *
	 * The countdown only starts once the camera and the face model are ready, so
	 * that the first calibration of a visit is measured rather than missed while
	 * the model is still being fetched.
	 */
	beginCalibration(): void {
		window.clearInterval(this._calibrationTimer);
		this._calibrationRun += 1;
		const calibrationRun = this._calibrationRun;
		this._phase = 'calibrating';
		this._isPaused = false;
		this._calibrationCount = this._situpSettings.calibrationCount;
		this._clearAlert();
		this.publish();

		void this._tracker.start().then(() => {
			if (calibrationRun !== this._calibrationRun) return;
			this._tracker.beginCalibration();
			this.publish();
			this._calibrationTimer = window.setInterval(() => {
				this._calibrationCount -= 1;
				if (this._calibrationCount > 0) {
					this.publish();
					return;
				}
				window.clearInterval(this._calibrationTimer);
				this._startMonitoring();
			}, CALIBRATION_STEP_MS);
		});
	}

	/** Starts, pauses or resumes monitoring, depending on the current phase. */
	toggleMonitoring(): void {
		if (this._phase === 'idle') {
			this.beginCalibration();
			return;
		}
		if (this._isPaused) {
			this._isPaused = false;
			this.publish();
			return;
		}
		this._isPaused = true;
		this._clearAlert();
		this.publish();
	}

	/** Stops every timer, including the pomodoro timer, and closes the camera stream. */
	stop(): void {
		window.clearInterval(this._tickTimer);
		window.clearInterval(this._calibrationTimer);
		this._pomodoroTimer.stop();
		this._tracker.stop();
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	The monitoring loop
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/** How long one reading tick waits, in milliseconds, at the rate the Situp settings panel asks for. */
	private get _tickIntervalMs(): number {
		return 1_000 / this._situpSettings.readsPerSecond;
	}

	/** How much time one reading tick stands for, in seconds. */
	private get _tickSeconds(): number {
		return 1 / this._situpSettings.readsPerSecond;
	}

	/** Stores the new reference posture and resets every session figure. */
	private _startMonitoring(): void {
		this._tracker.finishCalibration();
		this._phase = 'running';
		this._isPaused = false;
		this._posture = 'good';
		this._sessionSec = 0;
		this._goodSec = 0;
		this._goodRunSec = 0;
		this._badRunSec = 0;
		this._bestRunSec = 0;
		this._slipCount = 0;
		this._bars = [];
		this._secondsSinceLastBar = 0;
		this._clearAlert();

		window.clearInterval(this._tickTimer);
		this._tickTimer = window.setInterval(() => this._tick(), this._tickIntervalMs);
		this.publish();
	}

	/**
	 * Takes one posture reading and advances the session figures.
	 *
	 * Time only counts while a reading is actually available: with the camera
	 * closed, refused, or the face out of the frame, the figures hold still and
	 * the screen says so rather than reporting an upright posture nobody saw.
	 */
	private _tick(): void {
		if (this._isPaused) return;
		if (this._pomodoroTimer.holdsPostureMonitoring) {
			this._clearAlert();
			return;
		}

		const reading = this._tracker.read();
		this._lean = reading.lean;
		this._direction = reading.direction;
		this._isReadingAvailable = reading.isFaceVisible;
		if (reading.isFaceVisible === false) {
			this._clearAlert();
			this.publish();
			return;
		}

		const isBad = reading.lean > PostureReference.BAD_LEAN_THRESHOLD;
		this._sessionSec += this._tickSeconds;
		if (isBad) {
			if (this._posture === 'good') this._slipCount += 1;
			this._badRunSec += this._tickSeconds;
			this._goodRunSec = 0;
		} else {
			this._goodSec += this._tickSeconds;
			this._goodRunSec += this._tickSeconds;
			this._badRunSec = 0;
			this._bestRunSec = Math.max(this._bestRunSec, this._goodRunSec);
		}
		this._posture = isBad ? 'bad' : 'good';

		this._updateAlert(isBad);
		this._appendRibbonBar(isBad);
		this.publish();
	}

	/**
	 * Raises the desktop alert after a sustained slouch and clears it on
	 * correction. While the alert stays active, every tick also lets the
	 * tone repeat and grow stronger for as long as the slouch continues.
	 */
	private _updateAlert(isBad: boolean): void {
		if (isBad === false) {
			this._clearAlert();
			return;
		}
		if (this._badRunSec < this._situpSettings.alertDelaySec) return;

		if (this._isAlertActive === false) {
			this._isAlertActive = true;
			this._callbacks.onAlertRaised(MonitorCopy.alertContent(this._direction));
		}
		this._callbacks.onAlertTick(this._badRunSec);
	}

	/** Closes the desktop alert once the posture is corrected. */
	private _clearAlert(): void {
		if (this._isAlertActive === false) return;
		this._isAlertActive = false;
		this._callbacks.onAlertCleared();
	}

	/** Adds one ribbon segment for every two seconds of the session. */
	private _appendRibbonBar(isBad: boolean): void {
		this._secondsSinceLastBar += this._tickSeconds;
		if (this._secondsSinceLastBar < RIBBON_BAR_SECONDS) return;

		this._secondsSinceLastBar = 0;
		this._bars = this._bars.concat([{ isBad }]).slice(-RIBBON_BAR_LIMIT);
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	The values the interface draws
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/** Builds one complete description of what the screen should show. */
	private _viewModel(): MonitorViewModel {
		const isIdle = this._phase === 'idle';
		const isCalibrating = this._phase === 'calibrating';
		const isLive = this._phase === 'running';
		const cameraState = this._tracker.cameraState;
		const modelState = this._tracker.modelState;
		const isOnBreak = this._pomodoroTimer.holdsPostureMonitoring;
		const isReading = this._isPaused === false && isOnBreak === false;
		const isBad = isLive && isReading && this._posture === 'bad';
		const isBlind = isLive && isReading && this._isReadingAvailable === false;

		const isPreparing = isCalibrating && this._tracker.isReady === false;

		let verdict = 'Ready.';
		let guidance = 'Start the camera and I will hold you to the posture you calibrate. One line, one colour, no dashboard.';
		let verdictMeta = 'Nothing has been watched yet.';
		let stateColour: StateColour = 'unknown';
		if (isCalibrating) {
			verdict = 'Hold it…';
			guidance = 'Sit the way you want to be reminded of. This becomes the reference.';
			verdictMeta = isPreparing
				? 'Starting the camera and the on-device model.'
				: 'Calibrating from your own posture, not an average.';
			stateColour = 'good';
		} else if (isLive && this._isPaused) {
			verdict = 'Paused.';
			guidance = 'The camera is still yours. Nothing is being read.';
			verdictMeta = 'Resume whenever you like.';
		} else if (isLive && isOnBreak) {
			verdict = 'On a break.';
			guidance = 'Stand up, look away from the screen and move about. Nothing is being read while the break lasts.';
			verdictMeta = 'Posture monitoring starts again when the break ends.';
		} else if (isLive && cameraState === 'denied') {
			verdict = 'No camera.';
			guidance = 'The browser did not grant camera access, so there is nothing to read. Allow the camera and calibrate again.';
			verdictMeta = 'Reading is on hold.';
		} else if (isLive && modelState === 'failed') {
			verdict = 'No posture model.';
			guidance = 'The on-device posture model could not be loaded, so the camera picture cannot be read. Reload the page to try again.';
			verdictMeta = 'Reading is on hold.';
		} else if (isBlind) {
			verdict = 'Looking for you.';
			guidance = 'Move back into the camera frame. Nothing is counted while you are out of view.';
			verdictMeta = 'Reading is on hold.';
		} else if (isBad) {
			verdict = MonitorCopy.badVerdict(this._direction);
			guidance = MonitorCopy.badLine(this._direction, this._slipCount);
			verdictMeta = `Out of position for ${MonitorCopy.formatDuration(Math.max(this._badRunSec, this._tickSeconds))}.`;
			stateColour = 'bad';
		} else if (isLive) {
			verdict = 'Upright.';
			guidance = MonitorCopy.goodLine(this._sessionSec);
			verdictMeta = `Held for ${MonitorCopy.formatDuration(this._goodRunSec)}.`;
			stateColour = 'good';
		}

		const postureFigure = MonitorSession._postureFigure(isBad, this._direction, this._lean);
		const uprightShare = this._sessionSec > 0 ? Math.round((this._goodSec / this._sessionSec) * 100) : 100;

		return {
			pomodoro: this._pomodoroTimer.viewModel(),
			isIdle,
			isCalibrating,
			isLive,
			calibrationKicker: isPreparing ? 'Starting the camera' : 'Hold your best posture',
			calibrationCount: this._calibrationCount,
			stateColour,
			verdict,
			guidance,
			verdictMeta,
			spinePath: postureFigure.spinePath,
			headX: postureFigure.headX,
			headY: postureFigure.headY,
			kickerLabel: MonitorSession._kickerLabel(isIdle, this._isPaused, isOnBreak),
			feedLabel: MonitorSession._feedLabel(isIdle, cameraState, modelState),
			cameraNote: MonitorSession._cameraNote(cameraState, modelState),
			rateNote: MonitorSession._rateNote(
				isLive && isReading,
				isBlind,
				cameraState,
				modelState,
				this._situpSettings.readsPerSecond,
			),
			uprightText: `${uprightShare}%`,
			slipsText: String(this._slipCount),
			bestRunText: MonitorCopy.formatDuration(this._bestRunSec),
			sessionElapsedText: MonitorCopy.formatDuration(this._sessionSec),
			bars: this._bars,
			monitoringToggleLabel: MonitorSession._toggleLabel(isIdle, this._isPaused),
		};
	}

	/** Returns the small label above the verdict. */
	private static _kickerLabel(isIdle: boolean, isPaused: boolean, isOnBreak: boolean): string {
		if (isIdle) return 'Standing by';
		if (isPaused) return 'Paused';
		if (isOnBreak) return 'On a break';
		return 'Live monitor';
	}

	/** Returns the label of the badge in the corner of the camera picture. */
	private static _feedLabel(isIdle: boolean, cameraState: CameraState, modelState: ModelState): string {
		if (isIdle) return 'Off';
		if (cameraState === 'denied') return 'No camera';
		if (modelState === 'failed') return 'No model';
		return 'Live';
	}

	/** Returns the note printed beside the camera picture. */
	private static _cameraNote(cameraState: CameraState, modelState: ModelState): string {
		if (cameraState === 'denied') return 'Camera blocked — showing the tracking layer only';
		if (modelState === 'failed') return 'Posture model unavailable — camera picture only';
		return 'Front camera · mirrored';
	}

	/** Returns the reading-rate note printed under the camera picture. */
	private static _rateNote(
		isReading: boolean,
		isBlind: boolean,
		cameraState: CameraState,
		modelState: ModelState,
		readsPerSecond: number,
	): string {
		if (isReading === false) return 'Idle';
		if (cameraState === 'denied') return 'Camera blocked';
		if (modelState === 'failed') return 'No posture model';
		if (isBlind) return 'No face in frame';
		return `${readsPerSecond} ${readsPerSecond === 1 ? 'read' : 'reads'} / second`;
	}

	/** Returns the label of the monitoring button in the footer. */
	private static _toggleLabel(isIdle: boolean, isPaused: boolean): string {
		if (isIdle) return 'Start';
		if (isPaused) return 'Resume';
		return 'Pause';
	}

	/**
	 * Returns the spine curve and head position for the small figure next to
	 * the verdict. Upright stays centred and straight. A sustained bad posture
	 * moves the head toward the same word as the verdict text: down for
	 * leaning forward, up for leaning back, and sideways for leaning left or
	 * right, so the figure never points a different way than the words next
	 * to it.
	 */
	private static _postureFigure(isBad: boolean, direction: PostureDirection, lean: number): { spinePath: string; headX: number; headY: number } {
		if (isBad === false) return { spinePath: 'M23 62 C 23 48, 23 38, 23 28', headX: 23, headY: 18 };

		const offset = Math.min(1, Math.max(0, lean)) * 10;
		let headX = 23;
		let headY = 18;
		if (direction === 'forward') {
			headX = 23 + offset * 0.6;
			headY = 18 + offset * 0.9;
		} else if (direction === 'backward') {
			headX = 23 - offset * 0.6;
			headY = 18 - offset * 0.7;
		} else if (direction === 'left') {
			headX = 23 - offset;
			headY = 18 + offset * 0.15;
		} else {
			headX = 23 + offset;
			headY = 18 + offset * 0.15;
		}

		const spineTopY = headY + 10;
		const spineTopX = 23 + (headX - 23) * 0.75;
		const spineMidX = 23 + (headX - 23) * 0.4;
		return {
			spinePath: `M23 62 C 23 48, ${spineMidX.toFixed(1)} 40, ${spineTopX.toFixed(1)} ${spineTopY.toFixed(1)}`,
			headX,
			headY,
		};
	}
}

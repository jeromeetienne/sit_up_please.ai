import type { CameraState, MonitorPhase, MonitorViewModel, PostureAlertContent, PostureDirection, PostureState, SessionBar, StateColour } from './monitor_types';
import { MonitorCopy } from './monitor_copy';
import { PostureReference } from '../posture/posture_reference';
import { PostureTracker } from '../posture/posture_tracker';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MonitorSession — the phase machine and the counters behind the one screen
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const TICK_INTERVAL_MS = 500;
const TICK_SECONDS = TICK_INTERVAL_MS / 1_000;
const CALIBRATION_STEP_MS = 900;
const CALIBRATION_START_COUNT = 3;
const ALERT_DELAY_SEC = 5;
const RIBBON_BAR_SECONDS = 2;
const RIBBON_BAR_LIMIT = 72;
const RIBBON_BAR_MIN_HEIGHT_PX = 14;
const RIBBON_BAR_RANGE_PX = 36;

/** What the session tells the rest of the application when something changes. */
export type MonitorSessionCallbacks = {
	onUpdate: (viewModel: MonitorViewModel) => void;
	onAlertRaised: (content: PostureAlertContent) => void;
	onAlertTick: (badRunSec: number) => void;
	onAlertCleared: () => void;
};

/**
 * Drives the single monitor screen: it moves between standing by, calibrating
 * and monitoring, reads the posture twice a second, keeps the session figures,
 * and produces the values the interface draws.
 */
export class MonitorSession {
	private readonly _tracker: PostureTracker;
	private readonly _callbacks: MonitorSessionCallbacks;

	private _phase: MonitorPhase = 'idle';
	private _isPaused = false;
	private _posture: PostureState = 'good';
	private _lean = 0;
	private _direction: PostureDirection = 'forward';
	private _isReadingAvailable = false;
	private _calibrationCount = CALIBRATION_START_COUNT;
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

	constructor(tracker: PostureTracker, callbacks: MonitorSessionCallbacks) {
		this._tracker = tracker;
		this._callbacks = callbacks;
	}

	/** Draws the screen for the first time, before anything has been watched. */
	publish(): void {
		this._callbacks.onUpdate(this._viewModel());
	}

	/**
	 * Opens the camera, then counts down from three while the person settles
	 * into the posture that becomes the reference.
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
		this._calibrationCount = CALIBRATION_START_COUNT;
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

	/** Stops both timers and closes the camera stream. */
	stop(): void {
		window.clearInterval(this._tickTimer);
		window.clearInterval(this._calibrationTimer);
		this._tracker.stop();
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	The monitoring loop
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

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
		this._tickTimer = window.setInterval(() => this._tick(), TICK_INTERVAL_MS);
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
		this._sessionSec += TICK_SECONDS;
		if (isBad) {
			if (this._posture === 'good') this._slipCount += 1;
			this._badRunSec += TICK_SECONDS;
			this._goodRunSec = 0;
		} else {
			this._goodSec += TICK_SECONDS;
			this._goodRunSec += TICK_SECONDS;
			this._badRunSec = 0;
			this._bestRunSec = Math.max(this._bestRunSec, this._goodRunSec);
		}
		this._posture = isBad ? 'bad' : 'good';

		this._updateAlert(isBad);
		this._appendRibbonBar(isBad, reading.lean);
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
		if (this._badRunSec < ALERT_DELAY_SEC) return;

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

	/** Adds one ribbon bar for every two seconds of the session. */
	private _appendRibbonBar(isBad: boolean, lean: number): void {
		this._secondsSinceLastBar += TICK_SECONDS;
		if (this._secondsSinceLastBar < RIBBON_BAR_SECONDS) return;

		this._secondsSinceLastBar = 0;
		const uprightShare = 1 - Math.min(Math.max(lean, 0), 1);
		const heightPx = Math.round(RIBBON_BAR_MIN_HEIGHT_PX + uprightShare * RIBBON_BAR_RANGE_PX);
		this._bars = this._bars.concat([{ isBad, heightPx }]).slice(-RIBBON_BAR_LIMIT);
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
		const isBad = isLive && this._isPaused === false && this._posture === 'bad';
		const isBlind = isLive && this._isPaused === false && this._isReadingAvailable === false;

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
		} else if (isLive && cameraState === 'denied') {
			verdict = 'No camera.';
			guidance = 'The browser did not grant camera access, so there is nothing to read. Allow the camera and calibrate again.';
			verdictMeta = 'Reading is on hold.';
		} else if (isBlind) {
			verdict = 'Looking for you.';
			guidance = 'Move back into the camera frame. Nothing is counted while you are out of view.';
			verdictMeta = 'Reading is on hold.';
		} else if (isBad) {
			verdict = MonitorCopy.badVerdict(this._direction);
			guidance = MonitorCopy.badLine(this._direction, this._slipCount);
			verdictMeta = `Out of position for ${MonitorCopy.formatDuration(Math.max(this._badRunSec, TICK_SECONDS))}.`;
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
			kickerLabel: MonitorSession._kickerLabel(isIdle, this._isPaused),
			feedLabel: MonitorSession._feedLabel(isIdle, cameraState),
			cameraNote: cameraState === 'denied'
				? 'Camera blocked — showing the tracking layer only'
				: 'Front camera · mirrored',
			rateNote: MonitorSession._rateNote(isLive && this._isPaused === false, isBlind, cameraState),
			uprightText: `${uprightShare}%`,
			slipsText: String(this._slipCount),
			bestRunText: MonitorCopy.formatDuration(this._bestRunSec),
			sessionElapsedText: MonitorCopy.formatDuration(this._sessionSec),
			bars: this._bars,
			monitoringToggleLabel: MonitorSession._toggleLabel(isIdle, this._isPaused),
		};
	}

	/** Returns the small label above the verdict. */
	private static _kickerLabel(isIdle: boolean, isPaused: boolean): string {
		if (isIdle) return 'Standing by';
		if (isPaused) return 'Paused';
		return 'Live monitor';
	}

	/** Returns the label of the badge in the corner of the camera picture. */
	private static _feedLabel(isIdle: boolean, cameraState: CameraState): string {
		if (isIdle) return 'Off';
		if (cameraState === 'denied') return 'No camera';
		return 'Live';
	}

	/** Returns the reading-rate note printed under the camera picture. */
	private static _rateNote(isReading: boolean, isBlind: boolean, cameraState: CameraState): string {
		if (isReading === false) return 'Idle';
		if (cameraState === 'denied') return 'Camera blocked';
		if (isBlind) return 'No face in frame';
		return '2 reads / second';
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

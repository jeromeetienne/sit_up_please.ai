import type { PomodoroViewModel } from '../pomodoro/pomodoro_types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Types — the shared data shapes of the posture monitor
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** A normalized facial point returned by Face Landmarker. */
export type FacialLandmark = { x: number; y: number };

/** A pair of facial point indices used to draw an overlay line. */
export type LandmarkConnection = { start: number; end: number };

/** Camera-relative values captured during calibration and live monitoring. */
export type PostureMeasurement = {
	faceScale: number;
	faceX: number;
	faceY: number;
	headTilt: number;
};

/** The averaged posture measurement saved in browser storage. */
export type PostureBaseline = PostureMeasurement;

/**
 * How far a live measurement may stand away from the calibrated reference posture
 * before it counts as a slouch. Both values come from the Situp settings panel.
 */
export type PostureTolerances = {
	/**
	 * How much larger or smaller the face may look than at the calibrated
	 * reference, as a share of the calibrated face size. This is what a movement
	 * forward or back changes.
	 */
	forwardAndBack: number;
	/**
	 * How far the face may move sideways from the calibrated reference, as a
	 * share of the width of the camera picture.
	 */
	sideways: number;
};

/** Whether the camera stream is closed, running, or refused by the browser. */
export type CameraState = 'off' | 'on' | 'denied';

/**
 * Whether the on-device Face Landmarker model is loaded and ready to read frames, still loading, or
 * could not be loaded at all. A model that could not be loaded is reported rather than passed over in
 * silence: without it the camera picture still appears, but no posture reading is ever produced.
 */
export type ModelState = 'off' | 'loading' | 'ready' | 'failed';

/** Which way the person has moved away from the calibrated reference posture. */
export type PostureDirection = 'forward' | 'backward' | 'left' | 'right';

/** One posture reading taken from the camera. */
export type PostureReading = {
	/**
	 * How far the person has moved away from the calibrated reference posture,
	 * from -0.25 (further back than the reference) to 1 (far out of position).
	 */
	lean: number;
	/** The direction that most explains the current `lean` reading. */
	direction: PostureDirection;
	isFaceVisible: boolean;
	cameraState: CameraState;
};

/** The phase of the single monitor screen. */
export type MonitorPhase = 'idle' | 'calibrating' | 'running';

/** How the last posture reading came out. */
export type PostureState = 'good' | 'bad';

/** Which colour the whole page is currently carrying. */
export type StateColour = 'unknown' | 'good' | 'bad';

/** One segment of the session ribbon, covering two seconds of the session. */
export type SessionBar = { isBad: boolean };

/** The title and body of the desktop notification fired for a sustained bad posture. */
export type PostureAlertContent = { title: string; body: string };

/** Everything the interface needs in order to draw the page once. */
export type MonitorViewModel = {
	/** Everything the interface needs in order to draw the pomodoro area once. */
	pomodoro: PomodoroViewModel;
	isIdle: boolean;
	isCalibrating: boolean;
	isLive: boolean;
	calibrationKicker: string;
	calibrationCount: number;
	stateColour: StateColour;
	verdict: string;
	guidance: string;
	verdictMeta: string;
	spinePath: string;
	headX: number;
	headY: number;
	kickerLabel: string;
	feedLabel: string;
	cameraNote: string;
	rateNote: string;
	uprightText: string;
	slipsText: string;
	bestRunText: string;
	sessionElapsedText: string;
	bars: SessionBar[];
	monitoringToggleLabel: string;
};

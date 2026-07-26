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

/** Whether the camera stream is closed, running, or refused by the browser. */
export type CameraState = 'off' | 'on' | 'denied';

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

/** One bar of the session ribbon, covering two seconds of the session. */
export type SessionBar = { isBad: boolean; heightPx: number };

/** The title and body of the desktop notification fired for a sustained bad posture. */
export type PostureAlertContent = { title: string; body: string };

/** Everything the interface needs in order to draw the page once. */
export type MonitorViewModel = {
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

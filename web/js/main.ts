import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '../css/style.css';

/**
 * Browser-only posture reminder driven by MediaPipe facial landmarks.
 *
 * The application stores a local reference posture and compares subsequent
 * face size and horizontal position with that reference. No camera frame or
 * facial landmark is sent to an application server.
 */
const ANALYSIS_INTERVAL_MS = 1_000 / 30;
const CALIBRATION_DURATION_MS = 3_000;
const REMINDER_COOLDOWN_MS = 10 * 60_000;
const BASELINE_STORAGE_KEY = 'sit-up-please.posture-baseline.v1';

const video = document.querySelector<HTMLVideoElement>('#camera');
const overlay = document.querySelector<HTMLCanvasElement>('#overlay');
const startButton = document.querySelector<HTMLButtonElement>('#start-camera');
const calibrateButton = document.querySelector<HTMLButtonElement>('#calibrate');
const pauseButton = document.querySelector<HTMLButtonElement>('#pause-monitoring');
const status = document.querySelector<HTMLElement>('#status');
const title = document.querySelector<HTMLElement>('#monitor-title');
const placeholder = document.querySelector<HTMLElement>('#camera-placeholder');
const trackingValue = document.querySelector<HTMLElement>('#tracking-value');
const referenceValue = document.querySelector<HTMLElement>('#reference-value');
const fpsValue = document.querySelector<HTMLElement>('#fps-value');
const calibrationProgress = document.querySelector<HTMLElement>('#calibration-progress');
const debugCheckbox = document.querySelector<HTMLInputElement>('#show-debug');
const notificationCheckbox = document.querySelector<HTMLInputElement>('#enable-notifications');

if (!video || !overlay || !startButton || !calibrateButton || !pauseButton || !status || !title || !placeholder || !trackingValue || !referenceValue || !fpsValue || !calibrationProgress || !debugCheckbox || !notificationCheckbox) {
	throw new Error('The posture monitor could not find its required interface elements.');
}

const camera = video;
const landmarkCanvas = overlay;
const cameraButton = startButton;
const calibrationButton = calibrateButton;
const monitoringPauseButton = pauseButton;
const statusMessage = status;
const monitorTitle = title;
const cameraPlaceholder = placeholder;
const trackingDisplay = trackingValue;
const referenceDisplay = referenceValue;
const analysisRateDisplay = fpsValue;
const calibrationDisplay = calibrationProgress;
const debugToggle = debugCheckbox;
const notificationToggle = notificationCheckbox;
const canvasContext = landmarkCanvas.getContext('2d');

/** A normalized facial point returned by Face Landmarker. */
type FacialLandmark = { x: number; y: number };
/** A pair of facial point indices used to draw an overlay line. */
type LandmarkConnection = { start: number; end: number };
/** Camera-relative values captured during calibration and live monitoring. */
type PostureMeasurement = { faceScale: number; faceX: number; faceY: number; headTilt: number };
/** The averaged posture measurement saved in browser storage. */
type PostureBaseline = PostureMeasurement;
/** The current user-facing monitoring state. */
type MonitoringMode = 'ready' | 'calibrating' | 'monitoring' | 'paused';
/** The strongest direction in which live posture differs from calibration. */
type PostureDirection = 'forward' | 'backward' | 'left' | 'right';

let faceLandmarker: FaceLandmarker | undefined;
let baseline = loadBaseline();
let mode: MonitoringMode = 'ready';
let calibrationStartedAt = 0;
let calibrationMeasurements: PostureMeasurement[] = [];
let latestMeasurement: PostureMeasurement | undefined;
let lastAnalysisAt = 0;
let analysisCount = 0;
let badPostureSince = 0;
let reminderCooldownUntil = 0;
let activeDirection: PostureDirection | undefined;
/** The visible desktop notification for the current posture change, if any. */
let activeNotification: Notification | undefined;
/** Audio context prepared from the Start camera user action for alert tones. */
let notificationAudio: AudioContext | undefined;

/**
 * Reads and validates the saved baseline from local browser storage.
 *
 * Older or malformed data is ignored so that a new calibration can replace it.
 */
function loadBaseline(): PostureBaseline | undefined {
	try {
		const storedBaseline = localStorage.getItem(BASELINE_STORAGE_KEY);
		if (!storedBaseline) return undefined;
		const parsedBaseline = JSON.parse(storedBaseline) as Partial<PostureBaseline>;
		if (!Number.isFinite(parsedBaseline.faceScale) || !Number.isFinite(parsedBaseline.faceX) || !Number.isFinite(parsedBaseline.faceY) || !Number.isFinite(parsedBaseline.headTilt)) {
			return undefined;
		}
		return parsedBaseline as PostureBaseline;
	} catch {
		return undefined;
	}
}

/** Updates the live explanatory text announced to assistive technology. */
function setStatus(message: string): void {
	statusMessage.textContent = message;
}

/** Updates the prominent posture state heading. */
function setTitle(message: string): void {
	monitorTitle.textContent = message;
}

/** Matches the drawing canvas pixels to the active camera frame dimensions. */
function resizeOverlay(): void {
	landmarkCanvas.width = camera.videoWidth;
	landmarkCanvas.height = camera.videoHeight;
}

/**
 * Converts a normalized model x-coordinate into the mirrored camera preview's
 * canvas x-coordinate.
 */
function mirroredX(x: number): number {
	return landmarkCanvas.width - (x * landmarkCanvas.width);
}

/** Converts a normalized model y-coordinate into a canvas y-coordinate. */
function canvasY(y: number): number {
	return y * landmarkCanvas.height;
}

/**
 * Draws a group of indexed landmark connections using one canvas path.
 * Missing landmarks are skipped so partial tracking does not break the overlay.
 */
function drawConnections(
	landmarks: FacialLandmark[],
	connections: LandmarkConnection[],
	color: string,
	lineWidth: number,
): void {
	if (!canvasContext) return;

	canvasContext.beginPath();
	for (const { start, end } of connections) {
		const from = landmarks[start];
		const to = landmarks[end];
		if (!from || !to) continue;
		canvasContext.moveTo(mirroredX(from.x), canvasY(from.y));
		canvasContext.lineTo(mirroredX(to.x), canvasY(to.y));
	}
	canvasContext.strokeStyle = color;
	canvasContext.lineWidth = lineWidth;
	canvasContext.stroke();
}

/**
 * Clears and redraws the optional facial mesh overlay for the most recent
 * analysis result.
 */
function drawFace(landmarks: FacialLandmark[] | undefined): void {
	if (!canvasContext) return;

	canvasContext.clearRect(0, 0, landmarkCanvas.width, landmarkCanvas.height);
	if (!debugToggle.checked || !landmarks) return;

	drawConnections(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, 'rgb(255 255 255 / 58%)', 1);
	drawConnections(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, '#ffffff', 1.5);
	drawConnections(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, '#ffffff', 1.5);
	drawConnections(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, '#ff6262', 2);
	drawConnections(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, '#ff6262', 2);
	drawConnections(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, '#6de378', 2);
	drawConnections(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, '#6de378', 2);
}

/**
 * Derives camera-relative facial measurements used to compare the live posture
 * with the saved calibration. Returns undefined when required landmarks are absent.
 */
function measurePosture(landmarks: FacialLandmark[]): PostureMeasurement | undefined {
	const leftCheek = landmarks[234];
	const rightCheek = landmarks[454];
	const leftEye = landmarks[33];
	const rightEye = landmarks[263];
	const nose = landmarks[1];
	if (!leftCheek || !rightCheek || !leftEye || !rightEye || !nose) return undefined;

	const faceScale = Math.hypot(rightCheek.x - leftCheek.x, rightCheek.y - leftCheek.y);
	if (faceScale <= 0) return undefined;

	return {
		faceScale,
		faceX: nose.x,
		faceY: nose.y,
		headTilt: Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x),
	};
}

/** Averages accepted calibration samples into one saved baseline. */
function meanMeasurement(measurements: PostureMeasurement[]): PostureBaseline {
	const total = measurements.reduce(
		(sum, measurement) => ({
			faceScale: sum.faceScale + measurement.faceScale,
			faceX: sum.faceX + measurement.faceX,
			faceY: sum.faceY + measurement.faceY,
			headTilt: sum.headTilt + measurement.headTilt,
		}),
		{ faceScale: 0, faceX: 0, faceY: 0, headTilt: 0 },
	);
	return {
		faceScale: total.faceScale / measurements.length,
		faceX: total.faceX / measurements.length,
		faceY: total.faceY / measurements.length,
		headTilt: total.headTilt / measurements.length,
	};
}

/**
 * Rejects calibration samples that differ too much from the first sample.
 * This prevents saving a reference posture while the person is moving.
 */
function measurementIsStable(measurement: PostureMeasurement): boolean {
	const firstMeasurement = calibrationMeasurements[0];
	if (!firstMeasurement) return true;
	const scaleChange = Math.abs(measurement.faceScale / firstMeasurement.faceScale - 1);
	const verticalChange = Math.abs(measurement.faceY - firstMeasurement.faceY);
	return scaleChange < 0.06 && verticalChange < 0.03;
}

/**
 * Returns the strongest posture shift from the calibrated reference, or
 * undefined when the live posture remains within the accepted range.
 */
function findPostureDirection(measurement: PostureMeasurement, reference: PostureBaseline): PostureDirection | undefined {
	const scaleChange = measurement.faceScale / reference.faceScale - 1;
	const horizontalShift = measurement.faceX - reference.faceX;
	const scaleSeverity = Math.abs(scaleChange) / 0.14;
	const horizontalSeverity = Math.abs(horizontalShift) / 0.07;
	if (scaleSeverity <= 1 && horizontalSeverity <= 1) return undefined;

	if (scaleSeverity >= horizontalSeverity) {
		return scaleChange > 0 ? 'forward' : 'backward';
	}

	// The camera preview is mirrored, so an increasing source x-coordinate is
	// movement toward the person's left in the preview.
	return horizontalShift > 0 ? 'left' : 'right';
}

/** Returns the short, visible heading for a detected posture direction. */
function directionLabel(direction: PostureDirection): string {
	return `Lean ${direction}`;
}

/** Returns the shared explanatory text used below a directional heading. */
function directionDescription(_direction: PostureDirection): string {
	return 'Your posture is away from the calibrated position.';
}

/** Shows or hides the short calibration progress message. */
function showCalibrationProgress(message: string | undefined): void {
	calibrationDisplay.hidden = !message;
	calibrationDisplay.textContent = message ?? '';
}

/** Reports whether a valid calibration is saved in the current browser. */
function updateReferenceDisplay(): void {
	referenceDisplay.textContent = baseline ? 'Saved on this device' : 'Not calibrated';
}

/**
 * Saves the accepted samples locally and enters active monitoring mode.
 */
function finishCalibration(): void {
	baseline = meanMeasurement(calibrationMeasurements);
	localStorage.setItem(BASELINE_STORAGE_KEY, JSON.stringify(baseline));
	mode = 'monitoring';
	calibrationMeasurements = [];
	calibrationStartedAt = 0;
	calibrationButton.disabled = false;
	calibrationButton.textContent = 'Recalibrate';
	monitoringPauseButton.disabled = false;
	updateReferenceDisplay();
	showCalibrationProgress(undefined);
	setTitle('Posture looks good');
  setStatus('Monitoring gently. A reminder appears immediately when your posture moves away from calibration.');
}

/**
 * Starts a new three-second calibration after confirming that a face is
 * currently being tracked.
 */
function beginCalibration(): void {
	if (!latestMeasurement) {
		setStatus('Move your face into the camera frame before calibrating.');
		return;
	}
	mode = 'calibrating';
	calibrationStartedAt = performance.now();
	calibrationMeasurements = [];
	badPostureSince = 0;
	clearNotification();
	calibrationButton.disabled = true;
	monitoringPauseButton.disabled = true;
	setTitle('Hold your good posture');
	setStatus('Sit comfortably upright and keep still for three seconds.');
	showCalibrationProgress('Preparing calibration…');
}

/** Toggles active monitoring without stopping the camera or landmark overlay. */
function pauseMonitoring(): void {
	if (mode === 'paused') {
		mode = 'monitoring';
		monitoringPauseButton.textContent = 'Pause monitoring';
		setTitle('Posture looks good');
		setStatus('Monitoring gently.');
	} else {
		mode = 'paused';
		badPostureSince = 0;
		clearNotification();
		monitoringPauseButton.textContent = 'Resume monitoring';
		setTitle('Monitoring paused');
		setStatus('Posture reminders are paused.');
	}
}

/**
 * Creates the browser audio context from a direct user action. This lets a
 * later posture notification play a tone without relying on autoplay access.
 */
function prepareNotificationAudio(): void {
	if (!notificationAudio) {
		notificationAudio = new AudioContext();
	}
}

/** Plays a brief two-note tone alongside a desktop posture notification. */
function playNotificationSound(): void {
	if (!notificationAudio) return;

	void notificationAudio.resume().then(() => {
		const oscillator = notificationAudio?.createOscillator();
		const gain = notificationAudio?.createGain();
		if (!oscillator || !gain || !notificationAudio) return;

		const now = notificationAudio.currentTime;
		oscillator.type = 'sine';
		oscillator.frequency.setValueAtTime(660, now);
		oscillator.frequency.setValueAtTime(880, now + 0.12);
		gain.gain.setValueAtTime(0.0001, now);
		gain.gain.exponentialRampToValueAtTime(0.15, now + 0.02);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
		oscillator.connect(gain).connect(notificationAudio.destination);
		oscillator.start(now);
		oscillator.stop(now + 0.3);
	}).catch(() => {
		// The visual browser notification remains available if audio is blocked.
	});
}

/**
 * Sends the optional desktop notification for the current posture warning.
 * The visible status message remains available if notifications are unsupported.
 */
function notifyUser(direction: PostureDirection): void {
	if (notificationToggle.checked && 'Notification' in window && Notification.permission === 'granted') {
		activeNotification?.close();
		activeNotification = new Notification(directionLabel(direction), {
			body: directionDescription(direction),
			tag: 'sit-up-please-posture-reminder',
			requireInteraction: true,
		});
		playNotificationSound();
	}
}

/** Closes the active desktop notification once the posture is corrected. */
function clearNotification(): void {
	activeNotification?.close();
	activeNotification = undefined;
}

/**
 * Advances monitoring state from one live measurement.
 *
 * A notification is immediate, while the cooldown prevents repeated desktop
 * alerts for the same period of incorrect posture.
 */
function updateMonitoring(measurement: PostureMeasurement, now: number): void {
	if (!baseline || mode === 'ready' || mode === 'calibrating' || mode === 'paused') return;

	const direction = findPostureDirection(measurement, baseline);
	if (!direction) {
		const wasDrifting = badPostureSince > 0;
		badPostureSince = 0;
		reminderCooldownUntil = 0;
		activeDirection = undefined;
		clearNotification();
		if (wasDrifting) {
			setTitle('Posture looks good');
			setStatus('Your posture is back near the calibrated reference. Monitoring gently.');
		}
		return;
	}

	if (badPostureSince === 0) {
		badPostureSince = now;
		activeDirection = direction;
		setTitle(directionLabel(direction));
		if (now >= reminderCooldownUntil) {
			notifyUser(direction);
			reminderCooldownUntil = now + REMINDER_COOLDOWN_MS;
		}
		setStatus(`${directionDescription(direction)} A desktop notification is sent when notifications are enabled.`);
		return;
	}

	if (activeDirection !== direction) {
    activeDirection = direction;
    setTitle(directionLabel(direction));
    setStatus(`${directionDescription(direction)} A desktop notification is sent when notifications are enabled.`);
	}

}

/**
 * Collects stable samples during calibration and completes calibration when
 * the required duration and sample count have been reached.
 */
function updateCalibration(measurement: PostureMeasurement, now: number): void {
	if (mode !== 'calibrating') return;
	if (!measurementIsStable(measurement)) {
		calibrationStartedAt = now;
		calibrationMeasurements = [measurement];
		showCalibrationProgress('Movement detected. Hold your comfortable upright posture for 3 seconds.');
		return;
	}

	calibrationMeasurements.push(measurement);
	const elapsedSeconds = Math.min(3, Math.floor((now - calibrationStartedAt) / 1_000));
	showCalibrationProgress(`Hold still: ${elapsedSeconds} of 3 seconds`);
	if (now - calibrationStartedAt >= CALIBRATION_DURATION_MS && calibrationMeasurements.length >= 6) {
		finishCalibration();
	}
}

/**
 * Handles missing tracking, converts valid landmarks into a posture
 * measurement, and sends that measurement to calibration and monitoring.
 */
function processLandmarks(landmarks: FacialLandmark[] | undefined, now: number): void {
	trackingDisplay.textContent = landmarks ? `${landmarks.length} facial landmarks` : 'no face';
	if (!landmarks) {
		if (mode === 'calibrating') {
			calibrationStartedAt = now;
			calibrationMeasurements = [];
			showCalibrationProgress('Face lost. Move back into view and hold still.');
		} else if (mode !== 'paused') {
			setTitle('Move back into view');
			setStatus('Keep your face in the camera frame to continue monitoring.');
		}
		return;
	}

	const measurement = measurePosture(landmarks);
	latestMeasurement = measurement;
	if (!measurement) return;
	updateCalibration(measurement, now);
	updateMonitoring(measurement, now);
}

/**
 * Runs Face Landmarker at the configured rate, then updates the overlay,
 * calibration state, and posture reminder state from the latest camera frame.
 */
async function trackFace(): Promise<void> {
	if (!faceLandmarker || camera.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
		requestAnimationFrame(() => void trackFace());
		return;
	}

	const now = performance.now();
	if (now - lastAnalysisAt < ANALYSIS_INTERVAL_MS) {
		requestAnimationFrame(() => void trackFace());
		return;
	}

	const result = faceLandmarker.detectForVideo(camera, now);
	const landmarks = result.faceLandmarks[0] as FacialLandmark[] | undefined;
	drawFace(landmarks);
	processLandmarks(landmarks, now);
	analysisCount += 1;
	lastAnalysisAt = now;
	analysisRateDisplay.textContent = `${analysisCount > 1 ? (1_000 / ANALYSIS_INTERVAL_MS).toFixed(1) : '—'} / sec`;
	requestAnimationFrame(() => void trackFace());
}

/** Enables the notification control only in browsers that expose the API. */
function configureNotifications(): void {
	if (!('Notification' in window)) return;
	notificationToggle.disabled = false;
	notificationToggle.checked = Notification.permission === 'granted';
}

/**
 * Requests notification permission only after the person enables the control.
 * A denial leaves the normal in-page reminder active.
 */
async function setBrowserNotifications(): Promise<void> {
	if (!notificationToggle.checked || !('Notification' in window)) return;
	const permission = await Notification.requestPermission();
	notificationToggle.checked = permission === 'granted';
	if (permission !== 'granted') {
		setStatus('Browser notifications were not enabled. In-page reminders will still work.');
	}
}

/**
 * Requests webcam access, loads Face Landmarker, restores any saved baseline,
 * and begins the recurring analysis loop.
 */
async function startCamera(): Promise<void> {
	cameraButton.disabled = true;
	prepareNotificationAudio();
	setStatus('Requesting camera access…');

	try {
		const stream = await navigator.mediaDevices.getUserMedia({
			audio: false,
			video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
		});
		camera.srcObject = stream;
		await camera.play();
		resizeOverlay();
		cameraPlaceholder.hidden = true;
		setStatus('Loading the on-device face model…');
		const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
		faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
			baseOptions: {
				delegate: 'GPU',
				modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
			},
			numFaces: 1,
			runningMode: 'VIDEO',
		});
		configureNotifications();
		calibrationButton.disabled = false;
		cameraButton.textContent = 'Camera running';
		updateReferenceDisplay();
		if (baseline) {
			calibrationButton.textContent = 'Recalibrate';
			monitoringPauseButton.disabled = false;
			mode = 'monitoring';
			setTitle('Posture looks good');
			setStatus('Saved reference posture loaded. Recalibrate after changing your camera or chair.');
		} else {
			setTitle('Ready to calibrate');
			setStatus('Sit comfortably upright, then choose Calibrate posture.');
		}
		void trackFace();
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		setStatus(`Camera or face model could not start: ${message}`);
		cameraButton.disabled = false;
	}
}

cameraButton.addEventListener('click', () => void startCamera());
calibrationButton.addEventListener('click', beginCalibration);
monitoringPauseButton.addEventListener('click', pauseMonitoring);
notificationToggle.addEventListener('change', () => void setBrowserNotifications());
debugToggle.addEventListener('change', () => {
	if (!debugToggle.checked && canvasContext) {
		canvasContext.clearRect(0, 0, landmarkCanvas.width, landmarkCanvas.height);
	}
});

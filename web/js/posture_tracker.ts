import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { CameraState, FacialLandmark, LandmarkConnection, PostureBaseline, PostureDirection, PostureMeasurement, PostureReading } from './monitor_types';
import { PostureReference } from './posture_reference';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PostureTracker — turns camera frames into one posture reading
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const MEDIA_PIPE_WASM_CDN_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const FACE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task';
const ANALYSIS_INTERVAL_MS = 1_000 / 15;
const LEAN_SMOOTHING = 0.35;
const FACE_LOST_TIMEOUT_MS = 1_200;
const MINIMUM_CALIBRATION_SAMPLES = 4;

/**
 * Owns the camera stream and the on-device Face Landmarker model, and reduces
 * every analysed frame to a single smoothed number saying how far the person
 * has moved away from the calibrated reference posture.
 *
 * No camera frame and no facial landmark leaves the browser.
 */
export class PostureTracker {
	private readonly _video: HTMLVideoElement;
	private readonly _canvas: HTMLCanvasElement;
	private readonly _canvasContext: CanvasRenderingContext2D | null;

	private _drawsLandmarks: boolean;
	private _faceLandmarker: FaceLandmarker | undefined;
	private _stream: MediaStream | undefined;
	private _cameraState: CameraState = 'off';
	private _reference: PostureBaseline | undefined = PostureReference.load();
	private _lean = 0;
	private _direction: PostureDirection = 'forward';
	private _lastFaceAt = 0;
	private _isLoopRunning = false;
	private _isCollectingCalibration = false;
	private _calibrationSamples: PostureMeasurement[] = [];

	constructor(video: HTMLVideoElement, canvas: HTMLCanvasElement, drawsLandmarks: boolean) {
		this._video = video;
		this._canvas = canvas;
		this._canvasContext = canvas.getContext('2d');
		this._drawsLandmarks = drawsLandmarks;
		canvas.hidden = drawsLandmarks === false;
	}

	/** Turns the facial landmark overlay on or off, clearing it when turned off. */
	setDrawsLandmarks(drawsLandmarks: boolean): void {
		this._drawsLandmarks = drawsLandmarks;
		this._canvas.hidden = drawsLandmarks === false;
		if (drawsLandmarks === false && this._canvasContext !== null) {
			this._canvasContext.clearRect(0, 0, this._canvas.width, this._canvas.height);
		}
	}

	/** Whether the camera stream is closed, running, or refused by the browser. */
	get cameraState(): CameraState {
		return this._cameraState;
	}

	/** Whether a reference posture is available to score readings against. */
	get hasReference(): boolean {
		return this._reference !== undefined;
	}

	/**
	 * Whether the camera and the face model have finished starting up — or the
	 * camera has been refused, which nothing else can wait for.
	 */
	get isReady(): boolean {
		if (this._cameraState === 'denied') return true;
		return this._cameraState === 'on' && this._faceLandmarker !== undefined;
	}

	/**
	 * Opens the camera and loads the face model, then keeps analysing frames.
	 * A refused camera permission is recorded and reported, never thrown: the
	 * rest of the application keeps working without the camera.
	 */
	async start(): Promise<void> {
		if (this._cameraState === 'on') return;

		try {
			this._stream = await navigator.mediaDevices.getUserMedia({
				audio: false,
				video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
			});
			this._video.srcObject = this._stream;
			await this._video.play();
			this._cameraState = 'on';
		} catch {
			this._cameraState = 'denied';
			return;
		}

		try {
			if (this._faceLandmarker === undefined) {
				const vision = await FilesetResolver.forVisionTasks(PostureTracker._visionWasmPath());
				this._faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
					baseOptions: { delegate: 'GPU', modelAssetPath: FACE_MODEL_URL },
					numFaces: 1,
					runningMode: 'VIDEO',
				});
			}
		} catch {
			// Without the model the camera picture still shows; readings stay empty.
			return;
		}

		this._resizeCanvas();
		if (this._isLoopRunning === false) {
			this._isLoopRunning = true;
			this._scheduleNextFrame();
		}
	}

	/** Returns the latest posture reading. */
	read(): PostureReading {
		const isFaceVisible = this._cameraState === 'on'
			&& this._reference !== undefined
			&& performance.now() - this._lastFaceAt < FACE_LOST_TIMEOUT_MS;
		return { lean: this._lean, direction: this._direction, isFaceVisible, cameraState: this._cameraState };
	}

	/** Starts collecting samples for a new reference posture. */
	beginCalibration(): void {
		this._isCollectingCalibration = true;
		this._calibrationSamples = [];
	}

	/**
	 * Averages the collected samples into the new reference posture and saves it.
	 * Returns false when too few usable samples were seen, in which case any
	 * previously saved reference posture stays in use.
	 */
	finishCalibration(): boolean {
		this._isCollectingCalibration = false;
		const samples = this._calibrationSamples;
		this._calibrationSamples = [];
		if (samples.length < MINIMUM_CALIBRATION_SAMPLES) return false;

		this._reference = PostureReference.mean(samples);
		PostureReference.save(this._reference);
		this._lean = 0;
		return true;
	}

	/** Closes the camera stream and stops analysing frames. */
	stop(): void {
		this._isLoopRunning = false;
		this._stream?.getTracks().forEach((track) => track.stop());
		this._stream = undefined;
		this._video.srcObject = null;
		this._cameraState = 'off';
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Frame analysis
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/** Analyses one camera frame, then queues the next one. */
	private async _analyseFrame(): Promise<void> {
		if (this._isLoopRunning === false) return;

		const landmarker = this._faceLandmarker;
		const isFrameReady = landmarker !== undefined && this._video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
		if (isFrameReady === false) {
			this._scheduleNextFrame();
			return;
		}

		const now = performance.now();
		const result = landmarker.detectForVideo(this._video, now);
		const landmarks = result.faceLandmarks[0] as FacialLandmark[] | undefined;
		this._drawLandmarks(landmarks);
		if (landmarks !== undefined) {
			this._readMeasurement(landmarks, now);
		}
		this._scheduleNextFrame();
	}

	/**
	 * Queues the next frame analysis with a timer rather than
	 * `requestAnimationFrame`, which stops firing the moment the tab or window
	 * is not the one on screen — behind another window, on another virtual
	 * desktop, or minimized. A timer keeps firing there too, so the reading
	 * keeps updating (at a browser-throttled rate) instead of freezing.
	 */
	private _scheduleNextFrame(): void {
		setTimeout(() => void this._analyseFrame(), ANALYSIS_INTERVAL_MS);
	}

	/** Converts one set of landmarks into a measurement and updates the reading. */
	private _readMeasurement(landmarks: FacialLandmark[], now: number): void {
		const measurement = PostureTracker._measurePosture(landmarks);
		if (measurement === undefined) return;

		this._lastFaceAt = now;
		this._collectCalibrationSample(measurement);

		const reference = this._reference;
		if (reference === undefined) return;
		const { lean, direction } = PostureReference.evaluate(measurement, reference);
		this._lean += (lean - this._lean) * LEAN_SMOOTHING;
		this._direction = direction;
	}

	/** Keeps a calibration sample when the person is holding still. */
	private _collectCalibrationSample(measurement: PostureMeasurement): void {
		if (this._isCollectingCalibration === false) return;

		const firstSample = this._calibrationSamples[0];
		if (firstSample === undefined) {
			this._calibrationSamples = [measurement];
			return;
		}
		if (PostureReference.isStable(measurement, firstSample) === false) {
			this._calibrationSamples = [measurement];
			return;
		}
		this._calibrationSamples.push(measurement);
	}

	/**
	 * Derives the camera-relative facial measurements used to compare the live
	 * posture with the reference. Returns undefined when landmarks are missing.
	 */
	private static _measurePosture(landmarks: FacialLandmark[]): PostureMeasurement | undefined {
		const leftCheek = landmarks[234];
		const rightCheek = landmarks[454];
		const leftEye = landmarks[33];
		const rightEye = landmarks[263];
		const nose = landmarks[1];
		const isComplete = leftCheek !== undefined && rightCheek !== undefined
			&& leftEye !== undefined && rightEye !== undefined && nose !== undefined;
		if (isComplete === false) return undefined;

		const faceScale = Math.hypot(rightCheek.x - leftCheek.x, rightCheek.y - leftCheek.y);
		if (faceScale <= 0) return undefined;

		return {
			faceScale,
			faceX: nose.x,
			faceY: nose.y,
			headTilt: Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x),
		};
	}

	/** Returns the local extension WebAssembly directory when running in Chrome. */
	private static _visionWasmPath(): string {
		const extensionRuntime = (globalThis as typeof globalThis & {
			chrome?: { runtime?: { id?: string; getURL?: (path: string) => string } };
		}).chrome?.runtime;
		if (extensionRuntime?.id !== undefined && extensionRuntime.getURL !== undefined) {
			return extensionRuntime.getURL('wasm');
		}
		return MEDIA_PIPE_WASM_CDN_URL;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Optional landmark drawing
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/** Matches the drawing canvas pixels to the active camera frame dimensions. */
	private _resizeCanvas(): void {
		this._canvas.width = this._video.videoWidth;
		this._canvas.height = this._video.videoHeight;
	}

	/** Draws the detected facial landmarks over the camera picture, when enabled. */
	private _drawLandmarks(landmarks: FacialLandmark[] | undefined): void {
		if (this._drawsLandmarks === false || this._canvasContext === null) return;
		if (this._canvas.width !== this._video.videoWidth) this._resizeCanvas();

		this._canvasContext.clearRect(0, 0, this._canvas.width, this._canvas.height);
		if (landmarks === undefined) return;

		this._drawConnections(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, 'rgb(255 255 255 / 40%)', 1);
		this._drawConnections(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, '#ffffff', 1.5);
		this._drawConnections(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, '#ffffff', 1.5);
		this._drawConnections(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, '#ffffff', 2);
		this._drawConnections(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, '#ffffff', 2);
	}

	/** Draws one group of indexed landmark connections as a single canvas path. */
	private _drawConnections(
		landmarks: FacialLandmark[],
		connections: LandmarkConnection[],
		color: string,
		lineWidth: number,
	): void {
		const context = this._canvasContext;
		if (context === null) return;

		context.beginPath();
		for (const { start, end } of connections) {
			const from = landmarks[start];
			const to = landmarks[end];
			if (from === undefined || to === undefined) continue;
			// The camera picture is mirrored in the page, so the drawing is
			// mirrored here rather than by a second transform on the canvas.
			context.moveTo(this._canvas.width - from.x * this._canvas.width, from.y * this._canvas.height);
			context.lineTo(this._canvas.width - to.x * this._canvas.width, to.y * this._canvas.height);
		}
		context.strokeStyle = color;
		context.lineWidth = lineWidth;
		context.stroke();
	}
}

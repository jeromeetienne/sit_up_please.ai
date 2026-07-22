import '@mediapipe/pose';
import * as poseDetection from '@tensorflow-models/pose-detection';
import './style.css';

const video = document.querySelector<HTMLVideoElement>('#camera');
const overlay = document.querySelector<HTMLCanvasElement>('#overlay');
const startButton = document.querySelector<HTMLButtonElement>('#start-camera');
const status = document.querySelector<HTMLElement>('#status');
const placeholder = document.querySelector<HTMLElement>('#camera-placeholder');
const trackingValue = document.querySelector<HTMLElement>('#tracking-value');
const sampleValue = document.querySelector<HTMLElement>('#sample-value');
const fpsValue = document.querySelector<HTMLElement>('#fps-value');
const debugCheckbox = document.querySelector<HTMLInputElement>('#show-debug');

if (!video || !overlay || !startButton || !status || !placeholder || !trackingValue || !sampleValue || !fpsValue || !debugCheckbox) {
  throw new Error('The posture monitor could not find its required interface elements.');
}

const camera = video;
const landmarkCanvas = overlay;
const cameraButton = startButton;
const statusMessage = status;
const cameraPlaceholder = placeholder;
const trackingDisplay = trackingValue;
const sampleDisplay = sampleValue;
const frameRateDisplay = fpsValue;
const debugToggle = debugCheckbox;
const canvasContext = landmarkCanvas.getContext('2d');
let detector: poseDetection.PoseDetector | undefined;
let sampleCount = 0;
let previousSampleAt = 0;

function setStatus(message: string): void {
  statusMessage.textContent = message;
}

function resizeOverlay(): void {
  landmarkCanvas.width = camera.videoWidth;
  landmarkCanvas.height = camera.videoHeight;
}

const poseConnections: ReadonlyArray<readonly [string, string]> = [
  ['left_ear', 'left_shoulder'],
  ['right_ear', 'right_shoulder'],
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
];

function isUsableKeypoint(keypoint: { x: number; y: number; score?: number }): boolean {
  return Number.isFinite(keypoint.x) && Number.isFinite(keypoint.y) && Number.isFinite(keypoint.score) && (keypoint.score ?? 0) >= 0.4;
}

function mirroredX(x: number): number {
  return landmarkCanvas.width - x;
}

function drawPose(pose: poseDetection.Pose | undefined): void {
  if (!canvasContext) return;

  canvasContext.clearRect(0, 0, landmarkCanvas.width, landmarkCanvas.height);
  if (!debugToggle.checked) return;

  const visibleKeypoints = (pose?.keypoints ?? []).filter(isUsableKeypoint);
  const keypointsByName = new Map(visibleKeypoints.map((keypoint) => [keypoint.name, keypoint]));

  canvasContext.lineWidth = 3;
  canvasContext.strokeStyle = '#70e6c1';
  for (const [fromName, toName] of poseConnections) {
    const from = keypointsByName.get(fromName);
    const to = keypointsByName.get(toName);
    if (!from || !to) continue;
    canvasContext.beginPath();
    canvasContext.moveTo(mirroredX(from.x), from.y);
    canvasContext.lineTo(mirroredX(to.x), to.y);
    canvasContext.stroke();
  }

  for (const keypoint of visibleKeypoints) {
    if (keypoint.score === undefined || keypoint.score < 0.4) continue;
    const x = mirroredX(keypoint.x);
    canvasContext.beginPath();
    canvasContext.arc(x, keypoint.y, 5, 0, Math.PI * 2);
    canvasContext.fillStyle = '#d9ff5a';
    canvasContext.fill();
    canvasContext.fillStyle = '#ffffff';
    canvasContext.font = '600 14px system-ui';
    canvasContext.fillText(keypoint.name ?? 'landmark', x + 9, keypoint.y - 9);
  }
}

async function trackPose(): Promise<void> {
  if (!detector || camera.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    requestAnimationFrame(() => void trackPose());
    return;
  }

  // The camera preview and overlay are mirrored in CSS. Leave landmark
  // coordinates unflipped so the overlay follows that same mirror transform.
  const poses = await detector.estimatePoses(camera, { flipHorizontal: false });
  const pose = poses[0];
  const visibleUpperBodyLandmarks = (pose?.keypoints ?? []).filter((keypoint) =>
    ['nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear', 'left_shoulder', 'right_shoulder'].includes(keypoint.name ?? '') &&
    isUsableKeypoint(keypoint),
  );

  drawPose(pose);
  sampleCount += 1;
  const now = performance.now();
  if (previousSampleAt > 0) {
    frameRateDisplay.textContent = `${(1000 / (now - previousSampleAt)).toFixed(1)} / sec`;
  }
  previousSampleAt = now;
  sampleDisplay.textContent = String(sampleCount);
  trackingDisplay.textContent = `${visibleUpperBodyLandmarks.length} upper-body points`;
  setStatus(visibleUpperBodyLandmarks.length >= 4 ? 'Landmarks are tracking. Move naturally and check the points stay stable.' : 'Move into the camera frame so your face and shoulders are visible.');
  requestAnimationFrame(() => void trackPose());
}

async function startCamera(): Promise<void> {
  cameraButton.disabled = true;
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
    setStatus('Loading the on-device pose model…');
    detector = await poseDetection.createDetector(poseDetection.SupportedModels.BlazePose, {
      runtime: 'mediapipe',
      modelType: 'full',
      enableSmoothing: true,
      solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/pose',
    });
    setStatus('Camera and pose model are ready.');
    void trackPose();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    setStatus(`Camera or pose model could not start: ${message}`);
    cameraButton.disabled = false;
  }
}

cameraButton.addEventListener('click', () => void startCamera());
debugToggle.addEventListener('change', () => {
  if (!debugToggle.checked && canvasContext) {
    canvasContext.clearRect(0, 0, landmarkCanvas.width, landmarkCanvas.height);
  }
});

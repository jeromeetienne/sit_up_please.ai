import '@tensorflow/tfjs-backend-webgl';
import * as tf from '@tensorflow/tfjs-core';
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

if (!video || !overlay || !startButton || !status || !placeholder || !trackingValue || !sampleValue || !fpsValue) {
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

function drawPose(pose: poseDetection.Pose | undefined): void {
  if (!canvasContext) return;

  canvasContext.clearRect(0, 0, landmarkCanvas.width, landmarkCanvas.height);
  for (const keypoint of pose?.keypoints ?? []) {
    if (keypoint.score === undefined || keypoint.score < 0.4) continue;
    canvasContext.beginPath();
    canvasContext.arc(keypoint.x, keypoint.y, 5, 0, Math.PI * 2);
    canvasContext.fillStyle = '#d9ff5a';
    canvasContext.fill();
  }
}

async function trackPose(): Promise<void> {
  if (!detector || camera.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    requestAnimationFrame(() => void trackPose());
    return;
  }

  const poses = await detector.estimatePoses(camera, { flipHorizontal: true });
  const pose = poses[0];
  const visibleUpperBodyLandmarks = (pose?.keypoints ?? []).filter((keypoint) =>
    ['nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear', 'left_shoulder', 'right_shoulder'].includes(keypoint.name ?? '') &&
    (keypoint.score ?? 0) >= 0.4,
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
    await tf.setBackend('webgl');
    await tf.ready();
    detector = await poseDetection.createDetector(poseDetection.SupportedModels.BlazePose, {
      runtime: 'tfjs',
      modelType: 'lite',
      enableSmoothing: true,
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

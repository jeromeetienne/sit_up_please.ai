import '@fontsource-variable/source-serif-4';
import '@fontsource-variable/source-serif-4/wght-italic.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '../css/style.css';

import { InstallPrompt } from './install_prompt';
import { MonitorSession } from './monitor_session';
import { MonitorView } from './monitor_view';
import { NotificationAlerts } from './notification_alerts';
import { OfflineSupport } from './offline_support';
import { PostureTracker } from './posture_tracker';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Main — starts the posture monitor and connects its parts
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * "Sit Up, Please" — a posture monitor that runs entirely in the browser.
 *
 * The camera picture and the facial landmarks taken from it stay on the device:
 * nothing is uploaded, and nothing is kept after the page closes apart from the
 * calibrated reference posture in local browser storage.
 */
class Main {
	/** Builds every part of the monitor and draws the standing-by screen. */
	static start(): void {
		const video = document.querySelector<HTMLVideoElement>('#camera');
		const landmarkCanvas = document.querySelector<HTMLCanvasElement>('#landmark-overlay');
		if (video === null || landmarkCanvas === null) {
			throw new Error('The posture monitor could not find the camera elements.');
		}

		OfflineSupport.register();

		const view = new MonitorView();
		const alerts = new NotificationAlerts();
		const installPrompt = new InstallPrompt();
		let drawsLandmarks = true;
		const tracker = new PostureTracker(video, landmarkCanvas, drawsLandmarks);
		const session = new MonitorSession(tracker, {
			onUpdate: (viewModel) => view.render(viewModel),
			onAlertRaised: (content) => alerts.show(content),
			onAlertTick: (badRunSec) => alerts.escalate(badRunSec),
			onAlertCleared: () => alerts.clear(),
		});

		view.bindActions({
			onStart: () => {
				alerts.prepareAudio();
				void alerts.requestOnFirstStart().then((isEnabled) => view.setAlertsState(alerts.isSupported, isEnabled));
				session.beginCalibration();
			},
			onRecalibrate: () => {
				alerts.prepareAudio();
				void alerts.requestOnFirstStart().then((isEnabled) => view.setAlertsState(alerts.isSupported, isEnabled));
				session.beginCalibration();
			},
			onToggleMonitoring: () => session.toggleMonitoring(),
			onToggleAlerts: () => {
				void alerts.setEnabled(alerts.isEnabled === false).then((isEnabled) => {
					view.setAlertsState(alerts.isSupported, isEnabled);
				});
			},
			onToggleLandmarks: () => {
				drawsLandmarks = drawsLandmarks === false;
				tracker.setDrawsLandmarks(drawsLandmarks);
				view.setLandmarksState(drawsLandmarks);
			},
			onInstall: () => void installPrompt.promptInstall(),
		});

		view.setAlertsState(alerts.isSupported, alerts.isEnabled);
		view.setLandmarksState(drawsLandmarks);
		view.setInstallState(false);
		installPrompt.onAvailabilityChange((isAvailable) => view.setInstallState(isAvailable));
		session.publish();
		window.addEventListener('pagehide', () => session.stop());
	}
}

Main.start();

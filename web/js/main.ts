import 'bootstrap-icons/font/bootstrap-icons.css';
import '../css/style.scss';

import { InstallPrompt } from './pwa/install_prompt';
import { MonitorSession } from './monitor/monitor_session';
import { MonitorView } from './monitor/monitor_view';
import { NotificationAlerts } from './notifications/notification_alerts';
import { NotificationDialog } from './notifications/notification_dialog';
import { OfflineSupport } from './pwa/offline_support';
import { PostureTracker } from './posture/posture_tracker';
import { PomodoroDialog } from './pomodoro/pomodoro_dialog';
import { SettingsDialog } from './settings/settings_dialog';
import { ThemePreference } from './theme/theme_preference';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Main — starts the posture monitor and connects its parts
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Whether the facial landmarks are drawn over the camera picture to begin with. */
const DRAWS_LANDMARKS_BY_DEFAULT = true;

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

		const themePreference = new ThemePreference();

		const view = new MonitorView();
		const alerts = new NotificationAlerts();
		const installPrompt = new InstallPrompt();
		let drawsLandmarks = DRAWS_LANDMARKS_BY_DEFAULT;
		const tracker = new PostureTracker(video, landmarkCanvas, drawsLandmarks);
		const session = new MonitorSession(tracker, {
			onUpdate: (viewModel) => view.render(viewModel),
			onAlertRaised: (content) => alerts.show(content),
			onAlertTick: (badRunSec) => alerts.escalate(badRunSec),
			onAlertCleared: () => alerts.clear(),
			onPomodoroPeriodFinished: (content, toneKind) => alerts.announcePomodoro(content, toneKind),
			onPomodoroNotificationDismissed: () => alerts.clearPomodoro(),
		});

		const settingsDialog = new SettingsDialog({
			onRestoreDefaults: () => {
				drawsLandmarks = DRAWS_LANDMARKS_BY_DEFAULT;
				tracker.setDrawsLandmarks(drawsLandmarks);
				view.setLandmarksState(drawsLandmarks);
			},
		});

		const pomodoroDialog = new PomodoroDialog({
			onSaved: (settings) => session.applyPomodoroSettings(settings),
			onRestoreDefaults: () => session.switchPomodoroOff(),
		});

		const notificationDialog = new NotificationDialog({
			onSaved: (settings) => alerts.applySettings(settings),
			onPlaySample: (soundName, volume) => alerts.playSample(soundName, volume),
			onTogglePermission: () => {
				void alerts.setEnabled(alerts.isEnabled === false).then((isEnabled) => {
					notificationDialog.setPermissionState(alerts.isSupported, isEnabled);
				});
			},
			onRestoreDefaults: () => {
				notificationDialog.setPermissionState(alerts.isSupported, alerts.restoreDefault());
			},
		});

		view.bindActions({
			onStart: () => {
				alerts.prepareAudio();
				void alerts.requestOnFirstStart().then((isEnabled) => {
					notificationDialog.setPermissionState(alerts.isSupported, isEnabled);
				});
				session.beginCalibration();
			},
			onRecalibrate: () => {
				alerts.prepareAudio();
				void alerts.requestOnFirstStart().then((isEnabled) => {
					notificationDialog.setPermissionState(alerts.isSupported, isEnabled);
				});
				session.beginCalibration();
			},
			onToggleMonitoring: () => session.toggleMonitoring(),
			onTogglePomodoro: () => {
				alerts.prepareAudio();
				session.togglePomodoro();
			},
			onOpenSettings: () => settingsDialog.open(),
			onOpenNotifications: () => notificationDialog.open(),
			onOpenPomodoro: () => pomodoroDialog.open(),
			onCycleTheme: () => themePreference.cycle(),
			onToggleLandmarks: () => {
				drawsLandmarks = drawsLandmarks === false;
				tracker.setDrawsLandmarks(drawsLandmarks);
				view.setLandmarksState(drawsLandmarks);
			},
			onInstall: () => void installPrompt.promptInstall(),
		});

		themePreference.onChange((choice) => view.setThemeState(choice));
		notificationDialog.setPermissionState(alerts.isSupported, alerts.isEnabled);
		view.setLandmarksState(drawsLandmarks);
		view.setInstallState(false);
		installPrompt.onAvailabilityChange((isAvailable) => view.setInstallState(isAvailable));
		session.publish();
		window.addEventListener('pagehide', () => session.stop());
	}
}

Main.start();

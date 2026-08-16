import type { MonitorViewModel, SessionBar, StateColour } from './monitor_types';
import type { ThemeChoice } from '../theme/theme_preference';
import { MonitorCopy } from './monitor_copy';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MonitorView — writes the monitor screen from one set of values
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const SESSION_NUMBER_STORAGE_KEY = 'sit-up-please.session-number.v1';
const SESSION_NUMBER_LIMIT = 999;

/** The Bootstrap contextual colour each posture state is drawn in. */
const STATE_CONTEXTUAL_COLOUR: Record<StateColour, string> = {
	good: 'success',
	bad: 'danger',
	unknown: 'secondary',
};

/** The buttons the person can press on the monitor screen. */
export type MonitorActions = {
	onStart: () => void;
	onRecalibrate: () => void;
	onToggleMonitoring: () => void;
	onTogglePomodoro: () => void;
	onOpenSettings: () => void;
	onOpenNotifications: () => void;
	onOpenPomodoro: () => void;
	onToggleLandmarks: () => void;
	onCycleTheme: () => void;
	onInstall: () => void;
};

/**
 * The one place that touches the page. It looks up every element once, then
 * writes the posture colour, the words, the figures and the session ribbon from
 * the values the session hands it.
 */
export class MonitorView {
	private readonly _dateline = MonitorView._require<HTMLElement>('dateline');
	private readonly _sessionNumber = MonitorView._require<HTMLElement>('session-number');
	private readonly _platePlaceholder = MonitorView._require<HTMLElement>('plate-placeholder');
	private readonly _calibrationOverlay = MonitorView._require<HTMLElement>('calibration-overlay');
	private readonly _calibrationKicker = MonitorView._require<HTMLElement>('calibration-kicker');
	private readonly _calibrationCount = MonitorView._require<HTMLElement>('calibration-count');
	private readonly _feedLabel = MonitorView._require<HTMLElement>('feed-label');
	private readonly _cameraNote = MonitorView._require<HTMLElement>('camera-note');
	private readonly _rateNote = MonitorView._require<HTMLElement>('rate-note');
	private readonly _kickerLabel = MonitorView._require<HTMLElement>('kicker-label');
	private readonly _verdict = MonitorView._require<HTMLElement>('verdict');
	private readonly _verdictAlert = MonitorView._require<HTMLElement>('verdict-alert');
	private readonly _guidance = MonitorView._require<HTMLElement>('guidance');
	private readonly _verdictMeta = MonitorView._require<HTMLElement>('verdict-meta');
	private readonly _postureSpine = MonitorView._require<SVGPathElement>('posture-spine');
	private readonly _postureHead = MonitorView._require<SVGCircleElement>('posture-head');
	private readonly _startBlock = MonitorView._require<HTMLElement>('start-block');
	private readonly _startButton = MonitorView._require<HTMLButtonElement>('start-monitoring');
	private readonly _pomodoro = MonitorView._require<HTMLElement>('pomodoro');
	private readonly _pomodoroLabel = MonitorView._require<HTMLElement>('pomodoro-label');
	private readonly _pomodoroCountdown = MonitorView._require<HTMLElement>('pomodoro-countdown');
	private readonly _pomodoroStatus = MonitorView._require<HTMLElement>('pomodoro-status');
	private readonly _figures = MonitorView._require<HTMLElement>('figures');
	private readonly _uprightValue = MonitorView._require<HTMLElement>('upright-value');
	private readonly _slipsValue = MonitorView._require<HTMLElement>('slips-value');
	private readonly _bestRunValue = MonitorView._require<HTMLElement>('best-run-value');
	private readonly _sessionRibbon = MonitorView._require<HTMLElement>('session-ribbon');
	private readonly _sessionElapsed = MonitorView._require<HTMLElement>('session-elapsed');
	private readonly _ribbonBars = MonitorView._require<HTMLElement>('ribbon-bars');
	private readonly _installButton = MonitorView._require<HTMLButtonElement>('install-app');
	private readonly _landmarksSwitch = MonitorView._require<HTMLInputElement>('toggle-landmarks');
	private readonly _themeButton = MonitorView._require<HTMLButtonElement>('toggle-theme');
	private readonly _themeIcon = MonitorView._require<HTMLElement>('toggle-theme-icon');
	private readonly _settingsButton = MonitorView._require<HTMLButtonElement>('open-settings');
	private readonly _notificationsButton = MonitorView._require<HTMLButtonElement>('open-notifications');
	private readonly _pomodoroButton = MonitorView._require<HTMLButtonElement>('open-pomodoro');
	private readonly _pomodoroSwitch = MonitorView._require<HTMLInputElement>('toggle-pomodoro');
	private readonly _pomodoroStartNextButton = MonitorView._require<HTMLButtonElement>('pomodoro-start-next');
	private readonly _pomodoroToggleButton = MonitorView._require<HTMLButtonElement>('pomodoro-toggle');
	private readonly _pomodoroToggleIcon = MonitorView._require<HTMLElement>('pomodoro-toggle-icon');
	private readonly _pomodoroToggleLabel = MonitorView._require<HTMLElement>('pomodoro-toggle-label');
	private readonly _recalibrateButton = MonitorView._require<HTMLButtonElement>('recalibrate');
	private readonly _monitoringButton = MonitorView._require<HTMLButtonElement>('toggle-monitoring');
	private readonly _monitoringIcon = MonitorView._require<HTMLElement>('toggle-monitoring-icon');
	private readonly _monitoringLabel = MonitorView._require<HTMLElement>('toggle-monitoring-label');
	private readonly _announcement = MonitorView._require<HTMLElement>('live-announcement');

	private _renderedBars: SessionBar[] | undefined;
	private _announcedVerdict = '';

	constructor() {
		this._dateline.textContent = MonitorCopy.dateline(new Date());
		this._sessionNumber.textContent = `No. ${MonitorView._nextSessionNumber()}`;
	}

	/** Attaches every button on the screen to the action it performs. */
	bindActions(actions: MonitorActions): void {
		this._startButton.addEventListener('click', actions.onStart);
		this._recalibrateButton.addEventListener('click', actions.onRecalibrate);
		this._monitoringButton.addEventListener('click', actions.onToggleMonitoring);
		this._pomodoroSwitch.addEventListener('change', actions.onTogglePomodoro);
		this._pomodoroStartNextButton.addEventListener('click', actions.onTogglePomodoro);
		this._pomodoroToggleButton.addEventListener('click', actions.onTogglePomodoro);
		this._settingsButton.addEventListener('click', actions.onOpenSettings);
		this._notificationsButton.addEventListener('click', actions.onOpenNotifications);
		this._pomodoroButton.addEventListener('click', actions.onOpenPomodoro);
		this._landmarksSwitch.addEventListener('change', actions.onToggleLandmarks);
		this._themeButton.addEventListener('click', actions.onCycleTheme);
		this._installButton.addEventListener('click', actions.onInstall);
	}

	/** Shows or hides the install button, following the browser's own install-prompt availability. */
	setInstallState(isAvailable: boolean): void {
		this._installButton.hidden = isAvailable === false;
	}

	/** Puts the landmark-overlay switch of the Situp settings panel in its current position. */
	setLandmarksState(isEnabled: boolean): void {
		this._landmarksSwitch.checked = isEnabled;
	}

	/** Labels the theme button with the theme setting in force. */
	setThemeState(choice: ThemeChoice): void {
		const iconByChoice: Record<ThemeChoice, string> = {
			system: 'bi bi-circle-half',
			light: 'bi bi-sun',
			dark: 'bi bi-moon-stars',
		};
		const labelByChoice: Record<ThemeChoice, string> = {
			system: 'Theme: system',
			light: 'Theme: light',
			dark: 'Theme: dark',
		};
		// The button carries an icon and no words, so its name is written where a
		// person and a screen reader can each still reach it.
		this._themeIcon.className = iconByChoice[choice];
		this._themeButton.title = labelByChoice[choice];
		this._themeButton.setAttribute('aria-label', labelByChoice[choice]);
	}

	/** Draws the whole screen from one set of values. */
	render(viewModel: MonitorViewModel): void {
		this._applyStateColour(viewModel);

		this._platePlaceholder.hidden = viewModel.isIdle === false;
		this._calibrationOverlay.hidden = viewModel.isCalibrating === false;
		this._calibrationKicker.textContent = viewModel.calibrationKicker;
		this._calibrationCount.textContent = String(viewModel.calibrationCount);
		this._feedLabel.textContent = viewModel.feedLabel;
		this._cameraNote.textContent = viewModel.cameraNote;
		this._rateNote.textContent = viewModel.rateNote;

		this._kickerLabel.textContent = viewModel.kickerLabel;
		this._verdict.textContent = viewModel.verdict;
		this._guidance.textContent = viewModel.guidance;
		this._verdictMeta.textContent = viewModel.verdictMeta;
		this._postureSpine.setAttribute('d', viewModel.spinePath);
		this._postureHead.setAttribute('cx', viewModel.headX.toFixed(1));
		this._postureHead.setAttribute('cy', viewModel.headY.toFixed(1));

		this._pomodoro.hidden = viewModel.pomodoro.isActive === false;
		this._pomodoroLabel.textContent = viewModel.pomodoro.periodLabel;
		this._pomodoroCountdown.textContent = viewModel.pomodoro.countdownText;
		this._pomodoroStatus.textContent = viewModel.pomodoro.statusText;
		this._pomodoroSwitch.checked = viewModel.pomodoro.isOn;
		this._pomodoroStartNextButton.hidden = viewModel.pomodoro.isAwaitingStart === false;
		this._renderPomodoroToggle(viewModel);

		this._startBlock.hidden = viewModel.isIdle === false;
		this._figures.hidden = viewModel.isLive === false;
		this._uprightValue.textContent = viewModel.uprightText;
		this._slipsValue.textContent = viewModel.slipsText;
		this._bestRunValue.textContent = viewModel.bestRunText;

		this._sessionRibbon.hidden = viewModel.isLive === false;
		this._sessionElapsed.textContent = viewModel.sessionElapsedText;
		this._renderRibbon(viewModel.bars);

		this._monitoringIcon.className = viewModel.monitoringToggleLabel === 'Pause' ? 'bi bi-pause-fill' : 'bi bi-play-fill';
		this._monitoringLabel.textContent = viewModel.monitoringToggleLabel;
		this._monitoringButton.title = viewModel.monitoringToggleLabel;
		this._announce(viewModel);
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Writes the pomodoro button of the navigation bar. The one button covers the
	 * three things the timer can be asked to do, because a press means whichever
	 * of them the cycle is standing in front of: start the cycle, start a period
	 * waiting to be started by hand, or switch the timer off.
	 */
	private _renderPomodoroToggle(viewModel: MonitorViewModel): void {
		const isCountingDown = viewModel.pomodoro.isOn && viewModel.pomodoro.isAwaitingStart === false;
		this._pomodoroToggleIcon.className = isCountingDown ? 'bi bi-stop-fill' : 'bi bi-play-fill';
		this._pomodoroToggleLabel.textContent = viewModel.pomodoro.toggleLabel;
		this._pomodoroToggleButton.title = viewModel.pomodoro.toggleTitle;
		this._pomodoroToggleButton.setAttribute('aria-label', viewModel.pomodoro.toggleTitle);
	}

	/** Writes the posture state as the Bootstrap contextual colour of the verdict. */
	private _applyStateColour(viewModel: MonitorViewModel): void {
		const contextualColour = STATE_CONTEXTUAL_COLOUR[viewModel.stateColour];
		this._verdictAlert.className = `alert alert-${contextualColour} d-flex align-items-center gap-3`;
	}

	/**
	 * Redraws the session ribbon, but only when a new bar has been added. The
	 * ribbon is a Bootstrap stacked progress bar: one segment for every two
	 * seconds of the session, green while the posture held and red while it did
	 * not, each segment taking an equal share of the width.
	 */
	private _renderRibbon(bars: SessionBar[]): void {
		if (this._renderedBars === bars) return;
		this._renderedBars = bars;

		const segmentWidthPercent = bars.length === 0 ? 0 : 100 / bars.length;
		const fragment = document.createDocumentFragment();
		for (const bar of bars) {
			const segment = document.createElement('div');
			segment.className = 'progress';
			segment.setAttribute('role', 'progressbar');
			segment.style.width = `${segmentWidthPercent}%`;

			const fill = document.createElement('div');
			fill.className = bar.isBad ? 'progress-bar bg-danger' : 'progress-bar bg-success';
			segment.append(fill);
			fragment.append(segment);
		}
		this._ribbonBars.replaceChildren(fragment);
	}

	/** Reads the verdict out to assistive technology when the verdict changes. */
	private _announce(viewModel: MonitorViewModel): void {
		if (this._announcedVerdict === viewModel.verdict) return;
		this._announcedVerdict = viewModel.verdict;
		this._announcement.textContent = `${viewModel.verdict} ${viewModel.guidance}`;
	}

	/** Returns an element by its identifier, or fails loudly when it is absent. */
	private static _require<T extends Element>(elementId: string): T {
		const element = document.getElementById(elementId);
		if (element === null) throw new Error(`The posture monitor could not find the element "${elementId}".`);
		return element as unknown as T;
	}

	/**
	 * Returns the session number shown in the navigation bar: how many times this
	 * browser has opened the monitor, counted locally and shown as three digits.
	 */
	private static _nextSessionNumber(): string {
		let count = 1;
		try {
			const stored = Number.parseInt(localStorage.getItem(SESSION_NUMBER_STORAGE_KEY) ?? '', 10);
			count = Number.isFinite(stored) ? (stored % SESSION_NUMBER_LIMIT) + 1 : 1;
			localStorage.setItem(SESSION_NUMBER_STORAGE_KEY, String(count));
		} catch {
			// An unavailable storage only costs the edition number its history.
		}
		return String(count).padStart(3, '0');
	}
}

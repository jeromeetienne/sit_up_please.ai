import type { MonitorViewModel, SessionBar } from './monitor_types';
import { MonitorCopy } from './monitor_copy';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MonitorView — writes the monitor screen from one set of values
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const SESSION_NUMBER_STORAGE_KEY = 'sit-up-please.session-number.v1';
const SESSION_NUMBER_LIMIT = 999;

/** The buttons the person can press on the monitor screen. */
export type MonitorActions = {
	onStart: () => void;
	onRecalibrate: () => void;
	onToggleMonitoring: () => void;
	onToggleAlerts: () => void;
	onToggleLandmarks: () => void;
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
	private readonly _guidance = MonitorView._require<HTMLElement>('guidance');
	private readonly _verdictMeta = MonitorView._require<HTMLElement>('verdict-meta');
	private readonly _postureSpine = MonitorView._require<SVGPathElement>('posture-spine');
	private readonly _postureHead = MonitorView._require<SVGCircleElement>('posture-head');
	private readonly _startBlock = MonitorView._require<HTMLElement>('start-block');
	private readonly _startButton = MonitorView._require<HTMLButtonElement>('start-monitoring');
	private readonly _figures = MonitorView._require<HTMLElement>('figures');
	private readonly _uprightValue = MonitorView._require<HTMLElement>('upright-value');
	private readonly _slipsValue = MonitorView._require<HTMLElement>('slips-value');
	private readonly _bestRunValue = MonitorView._require<HTMLElement>('best-run-value');
	private readonly _sessionRibbon = MonitorView._require<HTMLElement>('session-ribbon');
	private readonly _sessionElapsed = MonitorView._require<HTMLElement>('session-elapsed');
	private readonly _ribbonBars = MonitorView._require<HTMLElement>('ribbon-bars');
	private readonly _installButton = MonitorView._require<HTMLButtonElement>('install-app');
	private readonly _landmarksButton = MonitorView._require<HTMLButtonElement>('toggle-landmarks');
	private readonly _landmarksIcon = MonitorView._require<HTMLElement>('toggle-landmarks-icon');
	private readonly _landmarksLabel = MonitorView._require<HTMLElement>('toggle-landmarks-label');
	private readonly _alertsButton = MonitorView._require<HTMLButtonElement>('toggle-alerts');
	private readonly _alertsIcon = MonitorView._require<HTMLElement>('toggle-alerts-icon');
	private readonly _alertsLabel = MonitorView._require<HTMLElement>('toggle-alerts-label');
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
		this._alertsButton.addEventListener('click', actions.onToggleAlerts);
		this._landmarksButton.addEventListener('click', actions.onToggleLandmarks);
		this._installButton.addEventListener('click', actions.onInstall);
	}

	/** Turns the desktop alert button on, and labels its current setting. */
	setAlertsState(isSupported: boolean, isEnabled: boolean): void {
		this._alertsButton.disabled = isSupported === false;
		this._alertsIcon.className = isEnabled ? 'bi bi-bell' : 'bi bi-bell-slash';
		this._alertsLabel.textContent = isEnabled ? 'Desktop alerts: on' : 'Desktop alerts: off';
	}

	/** Shows or hides the install button, following the browser's own install-prompt availability. */
	setInstallState(isAvailable: boolean): void {
		this._installButton.hidden = isAvailable === false;
	}

	/** Labels the landmark-overlay button with its current setting. */
	setLandmarksState(isEnabled: boolean): void {
		this._landmarksIcon.className = isEnabled ? 'bi bi-eye' : 'bi bi-eye-slash';
		this._landmarksLabel.textContent = isEnabled ? 'Landmarks: on' : 'Landmarks: off';
	}

	/** Draws the whole screen from one set of values. */
	render(viewModel: MonitorViewModel): void {
		this._applyStateVariables(viewModel);

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
		this._announce(viewModel);
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/** Writes the posture colour every part of the page reads. */
	private _applyStateVariables(viewModel: MonitorViewModel): void {
		const rootStyle = document.documentElement.style;
		rootStyle.setProperty('--state', `var(--state-${viewModel.stateColour})`);
		rootStyle.setProperty('--state-deep', `var(--state-${viewModel.stateColour}-deep)`);
	}

	/** Redraws the session ribbon, but only when a new bar has been added. */
	private _renderRibbon(bars: SessionBar[]): void {
		if (this._renderedBars === bars) return;
		this._renderedBars = bars;

		const fragment = document.createDocumentFragment();
		for (const bar of bars) {
			const element = document.createElement('div');
			element.className = bar.isBad ? 'ribbon-bar ribbon-bar-bad' : 'ribbon-bar';
			element.style.height = `${bar.heightPx}px`;
			fragment.append(element);
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
	 * Returns the edition number printed in the masthead: how many times this
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

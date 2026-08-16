import Modal from 'bootstrap/js/dist/modal';

import type { SitupSettingsValues } from './situp_settings';
import { SITUP_DEFAULT_SETTINGS, SITUP_SETTINGS_RANGES, SitupSettings } from './situp_settings';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SettingsDialog — the Situp settings panel, which holds the camera settings
//	and the values behind the posture reading
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** What the panel tells the rest of the application when something changes. */
export type SettingsDialogCallbacks = {
	/** Called with the stored situp settings once the person has pressed save. */
	onSaved: (settings: SitupSettingsValues) => void;
	/**
	 * Called when the person has pressed restore defaults. The panel has already
	 * put the situp settings back to their defaults in its own fields; this asks
	 * the rest of the application to put back the setting it owns, which is the
	 * facial landmark drawing.
	 */
	onRestoreDefaults: () => void;
};

/**
 * The Situp settings panel, which holds the camera settings and the values that
 * decide when a posture counts as a slouch, how soon a slouch is alerted, how
 * long the calibration countdown runs and how often the posture is read.
 *
 * The numbers are read from storage every time the panel opens and written back
 * on save. Pressing cancel, or closing the panel with the escape key, changes no
 * stored value.
 *
 * The facial landmark switch is not part of the save: it acts as soon as it is
 * pressed, and `MonitorView` writes its position.
 *
 * The pomodoro parameters live in the Pomodoro settings panel and the notification
 * setup in the Notification settings panel, each opened from its own button in the
 * navigation bar.
 */
export class SettingsDialog {
	private readonly _callbacks: SettingsDialogCallbacks;
	private readonly _modal = new Modal(SettingsDialog._require<HTMLElement>('settings-dialog'));
	private readonly _forwardAndBackToleranceInput = SettingsDialog._require<HTMLInputElement>('setting-forward-and-back-tolerance');
	private readonly _sidewaysToleranceInput = SettingsDialog._require<HTMLInputElement>('setting-sideways-tolerance');
	private readonly _alertDelayInput = SettingsDialog._require<HTMLInputElement>('setting-alert-delay');
	private readonly _calibrationCountInput = SettingsDialog._require<HTMLInputElement>('setting-calibration-count');
	private readonly _readsPerSecondInput = SettingsDialog._require<HTMLInputElement>('setting-reads-per-second');
	private readonly _restoreDefaultsButton = SettingsDialog._require<HTMLButtonElement>('settings-restore-defaults');
	private readonly _cancelButton = SettingsDialog._require<HTMLButtonElement>('settings-cancel');
	private readonly _saveButton = SettingsDialog._require<HTMLButtonElement>('settings-save');

	constructor(callbacks: SettingsDialogCallbacks) {
		this._callbacks = callbacks;
		this._restoreDefaultsButton.addEventListener('click', () => this._restoreDefaults());
		this._cancelButton.addEventListener('click', () => this._modal.hide());
		this._saveButton.addEventListener('click', () => this._save());
	}

	/** Opens the panel, showing the situp settings as they are stored right now. */
	open(): void {
		this._fillFields(SitupSettings.load());
		this._modal.show();
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Puts every setting of the panel back to its default: the situp settings in
	 * the fields of the panel, and, through the callback, the facial landmark
	 * drawing. The situp settings are only stored once the person presses save, as
	 * with any other edit; the facial landmark drawing takes effect at once.
	 */
	private _restoreDefaults(): void {
		this._fillFields(SITUP_DEFAULT_SETTINGS);
		this._callbacks.onRestoreDefaults();
	}

	/** Writes one set of situp settings into the fields of the panel. */
	private _fillFields(settings: SitupSettingsValues): void {
		this._forwardAndBackToleranceInput.value = String(Math.round(settings.forwardAndBackTolerance * 100));
		this._sidewaysToleranceInput.value = String(Math.round(settings.sidewaysTolerance * 100));
		this._alertDelayInput.value = String(settings.alertDelaySec);
		this._calibrationCountInput.value = String(settings.calibrationCount);
		this._readsPerSecondInput.value = String(settings.readsPerSecond);
	}

	/**
	 * Reads the fields, stores the situp settings and closes the panel. A field
	 * left empty or holding a value outside its range falls back to the default
	 * for that setting rather than stopping the save.
	 */
	private _save(): void {
		const ranges = SITUP_SETTINGS_RANGES;
		const settings: SitupSettingsValues = {
			forwardAndBackTolerance: SettingsDialog._readNumber(
				this._forwardAndBackToleranceInput,
				SITUP_DEFAULT_SETTINGS.forwardAndBackTolerance * 100,
				ranges.forwardAndBackTolerancePercent,
			) / 100,
			sidewaysTolerance: SettingsDialog._readNumber(
				this._sidewaysToleranceInput,
				SITUP_DEFAULT_SETTINGS.sidewaysTolerance * 100,
				ranges.sidewaysTolerancePercent,
			) / 100,
			alertDelaySec: SettingsDialog._readNumber(
				this._alertDelayInput,
				SITUP_DEFAULT_SETTINGS.alertDelaySec,
				ranges.alertDelaySec,
			),
			calibrationCount: SettingsDialog._readNumber(
				this._calibrationCountInput,
				SITUP_DEFAULT_SETTINGS.calibrationCount,
				ranges.calibrationCount,
			),
			readsPerSecond: SettingsDialog._readNumber(
				this._readsPerSecondInput,
				SITUP_DEFAULT_SETTINGS.readsPerSecond,
				ranges.readsPerSecond,
			),
		};

		SitupSettings.save(settings);
		this._callbacks.onSaved(settings);
		this._modal.hide();
	}

	/** Returns a whole number read from a field, held inside its range. */
	private static _readNumber(input: HTMLInputElement, fallback: number, range: { min: number; max: number }): number {
		const parsed = Number.parseInt(input.value, 10);
		if (Number.isFinite(parsed) === false) return fallback;
		return Math.min(range.max, Math.max(range.min, parsed));
	}

	/** Returns an element by its identifier, or fails loudly when it is absent. */
	private static _require<T extends Element>(elementId: string): T {
		const element = document.getElementById(elementId);
		if (element === null) throw new Error(`The Situp settings panel could not find the element "${elementId}".`);
		return element as unknown as T;
	}
}

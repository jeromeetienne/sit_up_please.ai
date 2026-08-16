import type { PomodoroSettingsValues } from '../pomodoro/pomodoro_settings';
import { POMODORO_DEFAULT_SETTINGS, PomodoroSettings } from '../pomodoro/pomodoro_settings';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SettingsDialog — the panel that edits the pomodoro parameters
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The smallest and largest value each number field accepts, in its own unit. */
const WORK_PERIOD_MINUTES_RANGE = { min: 1, max: 180 };
const SHORT_BREAK_MINUTES_RANGE = { min: 1, max: 60 };
const LONG_BREAK_MINUTES_RANGE = { min: 1, max: 90 };
const WORK_PERIODS_BEFORE_LONG_BREAK_RANGE = { min: 1, max: 12 };

/** What the dialog tells the rest of the application when something changes. */
export type SettingsDialogCallbacks = {
	/** Called with the stored settings once the person has pressed save. */
	onSaved: (settings: PomodoroSettingsValues) => void;
};

/**
 * The panel that edits the pomodoro parameters. It reads the stored settings
 * every time it opens, writes them back to local browser storage on save, and
 * hands the saved values to the rest of the application. Pressing cancel, or
 * closing the panel with the escape key, changes nothing.
 */
export class SettingsDialog {
	private readonly _callbacks: SettingsDialogCallbacks;
	private readonly _dialog = SettingsDialog._require<HTMLDialogElement>('settings-dialog');
	private readonly _workPeriodInput = SettingsDialog._require<HTMLInputElement>('setting-work-period');
	private readonly _shortBreakInput = SettingsDialog._require<HTMLInputElement>('setting-short-break');
	private readonly _longBreakInput = SettingsDialog._require<HTMLInputElement>('setting-long-break');
	private readonly _workPeriodsInput = SettingsDialog._require<HTMLInputElement>('setting-work-periods-before-long-break');
	private readonly _automaticStartInput = SettingsDialog._require<HTMLInputElement>('setting-automatic-start');
	private readonly _pauseDuringBreakInput = SettingsDialog._require<HTMLInputElement>('setting-pause-during-break');
	private readonly _restoreDefaultsButton = SettingsDialog._require<HTMLButtonElement>('settings-restore-defaults');
	private readonly _cancelButton = SettingsDialog._require<HTMLButtonElement>('settings-cancel');
	private readonly _saveButton = SettingsDialog._require<HTMLButtonElement>('settings-save');

	constructor(callbacks: SettingsDialogCallbacks) {
		this._callbacks = callbacks;
		this._restoreDefaultsButton.addEventListener('click', () => this._fillFields(POMODORO_DEFAULT_SETTINGS));
		this._cancelButton.addEventListener('click', () => this._dialog.close());
		this._saveButton.addEventListener('click', () => this._save());
	}

	/** Opens the panel, showing the settings as they are stored right now. */
	open(): void {
		this._fillFields(PomodoroSettings.load());
		this._dialog.showModal();
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/** Writes one set of settings into the fields of the panel. */
	private _fillFields(settings: PomodoroSettingsValues): void {
		this._workPeriodInput.value = String(Math.round(settings.workPeriodSec / 60));
		this._shortBreakInput.value = String(Math.round(settings.shortBreakSec / 60));
		this._longBreakInput.value = String(Math.round(settings.longBreakSec / 60));
		this._workPeriodsInput.value = String(settings.workPeriodsBeforeLongBreak);
		this._automaticStartInput.checked = settings.startsNextPeriodAutomatically;
		this._pauseDuringBreakInput.checked = settings.pausesPostureMonitoringDuringBreak;
	}

	/**
	 * Reads the fields, stores the settings and closes the panel. A field left
	 * empty or holding a value outside its range falls back to the default for
	 * that parameter rather than stopping the save.
	 */
	private _save(): void {
		const settings: PomodoroSettingsValues = {
			workPeriodSec: 60 * SettingsDialog._readNumber(
				this._workPeriodInput,
				POMODORO_DEFAULT_SETTINGS.workPeriodSec / 60,
				WORK_PERIOD_MINUTES_RANGE,
			),
			shortBreakSec: 60 * SettingsDialog._readNumber(
				this._shortBreakInput,
				POMODORO_DEFAULT_SETTINGS.shortBreakSec / 60,
				SHORT_BREAK_MINUTES_RANGE,
			),
			longBreakSec: 60 * SettingsDialog._readNumber(
				this._longBreakInput,
				POMODORO_DEFAULT_SETTINGS.longBreakSec / 60,
				LONG_BREAK_MINUTES_RANGE,
			),
			workPeriodsBeforeLongBreak: SettingsDialog._readNumber(
				this._workPeriodsInput,
				POMODORO_DEFAULT_SETTINGS.workPeriodsBeforeLongBreak,
				WORK_PERIODS_BEFORE_LONG_BREAK_RANGE,
			),
			startsNextPeriodAutomatically: this._automaticStartInput.checked,
			pausesPostureMonitoringDuringBreak: this._pauseDuringBreakInput.checked,
		};

		PomodoroSettings.save(settings);
		this._callbacks.onSaved(settings);
		this._dialog.close();
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
		if (element === null) throw new Error(`The settings panel could not find the element "${elementId}".`);
		return element as unknown as T;
	}
}

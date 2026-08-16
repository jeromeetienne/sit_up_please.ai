import Modal from 'bootstrap/js/dist/modal';

import type { PomodoroSettingsValues } from './pomodoro_settings';
import { POMODORO_DEFAULT_SETTINGS, PomodoroSettings } from './pomodoro_settings';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PomodoroDialog — the Pomodoro settings panel, which edits the parameters
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The smallest and largest value each number field accepts, in its own unit. */
const WORK_PERIOD_MINUTES_RANGE = { min: 1, max: 180 };
const SHORT_BREAK_MINUTES_RANGE = { min: 1, max: 60 };
const LONG_BREAK_MINUTES_RANGE = { min: 1, max: 90 };
const WORK_PERIODS_BEFORE_LONG_BREAK_RANGE = { min: 1, max: 12 };

/** What the panel tells the rest of the application when something changes. */
export type PomodoroDialogCallbacks = {
	/** Called with the stored parameters once the person has pressed save. */
	onSaved: (settings: PomodoroSettingsValues) => void;
	/**
	 * Called when the person has pressed restore defaults. The panel has already
	 * put the parameters back to their defaults in its own fields; this asks the
	 * rest of the application to switch the running timer off.
	 */
	onRestoreDefaults: () => void;
};

/**
 * The Pomodoro settings panel, which edits the pomodoro parameters. It reads the
 * stored parameters every time it opens, writes them back to local browser
 * storage on save, and hands the saved values to the rest of the application.
 * Pressing cancel, or closing the panel with the escape key, changes no stored
 * parameter.
 *
 * The switch that runs the timer is not part of the save: it acts as soon as it
 * is pressed, and `MonitorView` writes its position from the running session.
 */
export class PomodoroDialog {
	private readonly _callbacks: PomodoroDialogCallbacks;
	private readonly _modal = new Modal(PomodoroDialog._require<HTMLElement>('pomodoro-dialog'));
	private readonly _workPeriodInput = PomodoroDialog._require<HTMLInputElement>('setting-work-period');
	private readonly _shortBreakInput = PomodoroDialog._require<HTMLInputElement>('setting-short-break');
	private readonly _longBreakInput = PomodoroDialog._require<HTMLInputElement>('setting-long-break');
	private readonly _workPeriodsInput = PomodoroDialog._require<HTMLInputElement>('setting-work-periods-before-long-break');
	private readonly _automaticStartInput = PomodoroDialog._require<HTMLInputElement>('setting-automatic-start');
	private readonly _pauseDuringBreakInput = PomodoroDialog._require<HTMLInputElement>('setting-pause-during-break');
	private readonly _restoreDefaultsButton = PomodoroDialog._require<HTMLButtonElement>('pomodoro-restore-defaults');
	private readonly _cancelButton = PomodoroDialog._require<HTMLButtonElement>('pomodoro-cancel');
	private readonly _saveButton = PomodoroDialog._require<HTMLButtonElement>('pomodoro-save');

	constructor(callbacks: PomodoroDialogCallbacks) {
		this._callbacks = callbacks;
		this._restoreDefaultsButton.addEventListener('click', () => this._restoreDefaults());
		this._cancelButton.addEventListener('click', () => this._modal.hide());
		this._saveButton.addEventListener('click', () => this._save());
	}

	/** Opens the panel, showing the parameters as they are stored right now. */
	open(): void {
		this._fillFields(PomodoroSettings.load());
		this._modal.show();
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Puts every setting of the panel back to its default: the parameters in the
	 * fields of the panel, and, through the callback, the running timer. The
	 * parameters are only stored once the person presses save, as with any other
	 * edit.
	 */
	private _restoreDefaults(): void {
		this._fillFields(POMODORO_DEFAULT_SETTINGS);
		this._callbacks.onRestoreDefaults();
	}

	/** Writes one set of parameters into the fields of the panel. */
	private _fillFields(settings: PomodoroSettingsValues): void {
		this._workPeriodInput.value = String(Math.round(settings.workPeriodSec / 60));
		this._shortBreakInput.value = String(Math.round(settings.shortBreakSec / 60));
		this._longBreakInput.value = String(Math.round(settings.longBreakSec / 60));
		this._workPeriodsInput.value = String(settings.workPeriodsBeforeLongBreak);
		this._automaticStartInput.checked = settings.startsNextPeriodAutomatically;
		this._pauseDuringBreakInput.checked = settings.pausesPostureMonitoringDuringBreak;
	}

	/**
	 * Reads the fields, stores the parameters and closes the panel. A field left
	 * empty or holding a value outside its range falls back to the default for
	 * that parameter rather than stopping the save.
	 */
	private _save(): void {
		const settings: PomodoroSettingsValues = {
			workPeriodSec: 60 * PomodoroDialog._readNumber(
				this._workPeriodInput,
				POMODORO_DEFAULT_SETTINGS.workPeriodSec / 60,
				WORK_PERIOD_MINUTES_RANGE,
			),
			shortBreakSec: 60 * PomodoroDialog._readNumber(
				this._shortBreakInput,
				POMODORO_DEFAULT_SETTINGS.shortBreakSec / 60,
				SHORT_BREAK_MINUTES_RANGE,
			),
			longBreakSec: 60 * PomodoroDialog._readNumber(
				this._longBreakInput,
				POMODORO_DEFAULT_SETTINGS.longBreakSec / 60,
				LONG_BREAK_MINUTES_RANGE,
			),
			workPeriodsBeforeLongBreak: PomodoroDialog._readNumber(
				this._workPeriodsInput,
				POMODORO_DEFAULT_SETTINGS.workPeriodsBeforeLongBreak,
				WORK_PERIODS_BEFORE_LONG_BREAK_RANGE,
			),
			startsNextPeriodAutomatically: this._automaticStartInput.checked,
			pausesPostureMonitoringDuringBreak: this._pauseDuringBreakInput.checked,
		};

		PomodoroSettings.save(settings);
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
		if (element === null) throw new Error(`The Pomodoro settings panel could not find the element "${elementId}".`);
		return element as unknown as T;
	}
}

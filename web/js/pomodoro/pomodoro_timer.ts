import type { PomodoroPeriodKind, PomodoroRunState, PomodoroViewModel } from './pomodoro_types';
import type { PomodoroSettingsValues } from './pomodoro_settings';
import { PomodoroCopy } from './pomodoro_copy';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PomodoroTimer — the work-and-break cycle counted one second at a time
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const COUNTDOWN_INTERVAL_MS = 1_000;
const COUNTDOWN_SECONDS = COUNTDOWN_INTERVAL_MS / 1_000;

/** What the timer tells the rest of the application when something changes. */
export type PomodoroTimerCallbacks = {
	/** Called once every second while a period is counting down. */
	onTick: () => void;
	/** Called the moment a period reaches zero, before the next period is set up. */
	onPeriodFinished: (finishedKind: PomodoroPeriodKind, nextKind: PomodoroPeriodKind, nextDurationSec: number) => void;
};

/**
 * Counts one pomodoro cycle: a work period, then a short break, and a long
 * break instead of the short one once the set number of work periods is
 * finished. The timer runs on its own second-by-second interval, so it keeps
 * counting whether or not posture monitoring is reading the camera.
 */
export class PomodoroTimer {
	private readonly _settings: PomodoroSettingsValues;
	private readonly _callbacks: PomodoroTimerCallbacks;

	private _runState: PomodoroRunState = 'off';
	private _periodKind: PomodoroPeriodKind = 'work';
	private _remainingSec = 0;
	private _completedWorkPeriods = 0;
	private _countdownTimer: number | undefined;

	constructor(settings: PomodoroSettingsValues, callbacks: PomodoroTimerCallbacks) {
		this._settings = settings;
		this._callbacks = callbacks;
	}

	/**
	 * Takes new settings from the settings panel.
	 *
	 * A period already counting down keeps the length it started with, so a
	 * change never moves the finishing line of the period the person is in the
	 * middle of. A period waiting to be started by hand takes its new length
	 * straight away.
	 */
	applySettings(settings: PomodoroSettingsValues): void {
		Object.assign(this._settings, settings);
		if (this._runState === 'awaiting-start') {
			this._remainingSec = this._durationFor(this._periodKind);
		}
	}

	/** Whether a break is counting down right now. */
	get isBreakRunning(): boolean {
		return this._runState === 'running' && this._periodKind !== 'work';
	}

	/** Whether posture monitoring should hold still, because a break is counting down. */
	get holdsPostureMonitoring(): boolean {
		return this._settings.pausesPostureMonitoringDuringBreak && this.isBreakRunning;
	}

	/**
	 * Starts the cycle, starts the period that is waiting to be started by
	 * hand, or switches the whole timer off, depending on where the cycle
	 * currently stands.
	 */
	toggle(): void {
		if (this._runState === 'running') {
			this.stop();
			return;
		}
		if (this._runState === 'awaiting-start') {
			this._beginPeriod(this._periodKind);
			return;
		}
		this._completedWorkPeriods = 0;
		this._beginPeriod('work');
	}

	/** Switches the timer off and forgets the cycle counted so far. */
	stop(): void {
		window.clearInterval(this._countdownTimer);
		this._countdownTimer = undefined;
		this._runState = 'off';
		this._periodKind = 'work';
		this._remainingSec = 0;
		this._completedWorkPeriods = 0;
	}

	/** Builds one complete description of what the pomodoro area should show. */
	viewModel(): PomodoroViewModel {
		const workPeriodNumber = Math.min(this._completedWorkPeriods + 1, this._settings.workPeriodsBeforeLongBreak);
		return {
			isActive: this._runState !== 'off',
			periodLabel: PomodoroCopy.periodLabel(this._periodKind, workPeriodNumber, this._settings.workPeriodsBeforeLongBreak),
			countdownText: PomodoroCopy.formatCountdown(this._remainingSec),
			statusText: PomodoroCopy.statusText(this._runState, this._periodKind),
			toggleLabel: PomodoroCopy.toggleLabel(this._runState),
		};
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	The countdown
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/** Starts counting down one period of the given kind. */
	private _beginPeriod(kind: PomodoroPeriodKind): void {
		window.clearInterval(this._countdownTimer);
		this._runState = 'running';
		this._periodKind = kind;
		this._remainingSec = this._durationFor(kind);
		this._countdownTimer = window.setInterval(() => this._tick(), COUNTDOWN_INTERVAL_MS);
	}

	/** Takes one second off the current period, and closes the period at zero. */
	private _tick(): void {
		this._remainingSec -= COUNTDOWN_SECONDS;
		if (this._remainingSec > 0) {
			this._callbacks.onTick();
			return;
		}
		this._finishPeriod();
	}

	/**
	 * Closes the period that has just reached zero and sets up the one that
	 * follows it, either counting down straight away or waiting for the person
	 * to press start.
	 */
	private _finishPeriod(): void {
		window.clearInterval(this._countdownTimer);
		this._countdownTimer = undefined;

		const finishedKind = this._periodKind;
		if (finishedKind === 'work') {
			this._completedWorkPeriods += 1;
		}
		if (finishedKind === 'long-break') {
			this._completedWorkPeriods = 0;
		}
		const nextKind = this._nextKindAfter(finishedKind);
		const nextDurationSec = this._durationFor(nextKind);
		this._callbacks.onPeriodFinished(finishedKind, nextKind, nextDurationSec);

		if (this._settings.startsNextPeriodAutomatically) {
			this._beginPeriod(nextKind);
			this._callbacks.onTick();
			return;
		}
		this._runState = 'awaiting-start';
		this._periodKind = nextKind;
		this._remainingSec = nextDurationSec;
		this._callbacks.onTick();
	}

	/** Returns which period follows the one that has just finished. */
	private _nextKindAfter(finishedKind: PomodoroPeriodKind): PomodoroPeriodKind {
		if (finishedKind !== 'work') return 'work';
		const isLongBreakDue = this._completedWorkPeriods % this._settings.workPeriodsBeforeLongBreak === 0;
		return isLongBreakDue ? 'long-break' : 'short-break';
	}

	/** Returns how many seconds a period of the given kind lasts. */
	private _durationFor(kind: PomodoroPeriodKind): number {
		if (kind === 'work') return this._settings.workPeriodSec;
		if (kind === 'short-break') return this._settings.shortBreakSec;
		return this._settings.longBreakSec;
	}
}

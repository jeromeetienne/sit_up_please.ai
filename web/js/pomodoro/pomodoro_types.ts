///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Types — the shared data shapes of the pomodoro timer
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Which kind of period the pomodoro timer is counting down. */
export type PomodoroPeriodKind = 'work' | 'short-break' | 'long-break';

/**
 * Whether the pomodoro timer is switched off, counting down, or holding still
 * with a period ready to be started by hand.
 */
export type PomodoroRunState = 'off' | 'running' | 'awaiting-start';

/** The title and body of the desktop notification fired when a period finishes. */
export type PomodoroAlertContent = { title: string; body: string };

/** Which tone plays when a period finishes. */
export type PomodoroToneKind = 'work-finished' | 'break-finished';

/** Everything the interface needs in order to draw the pomodoro area once. */
export type PomodoroViewModel = {
	/** Whether the pomodoro area is drawn at all. */
	isActive: boolean;
	/** The name of the current period, for example `Work period 2 of 4`. */
	periodLabel: string;
	/** The time left in the current period, as `MM:SS`. */
	countdownText: string;
	/** One short line saying what the timer is doing right now. */
	statusText: string;
	/** Whether the timer is switched on at all, whatever it is doing. */
	isOn: boolean;
	/** Whether a period has finished and the next one is waiting to be started by hand. */
	isAwaitingStart: boolean;
};

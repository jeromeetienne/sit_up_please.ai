import type { PomodoroAlertContent, PomodoroPeriodKind, PomodoroRunState } from './pomodoro_types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PomodoroCopy — every sentence the pomodoro timer can show
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The written content of the pomodoro area and of its desktop notification,
 * kept in one place so the wording can be reviewed without reading the timer.
 */
export class PomodoroCopy {
	/** Returns the name of a period, for example `Work period 2 of 4` or `Short break`. */
	static periodLabel(kind: PomodoroPeriodKind, workPeriodNumber: number, workPeriodsBeforeLongBreak: number): string {
		if (kind === 'work') return `Work period ${workPeriodNumber} of ${workPeriodsBeforeLongBreak}`;
		if (kind === 'short-break') return 'Short break';
		return 'Long break';
	}

	/** Formats a number of seconds as `MM:SS`. */
	static formatCountdown(seconds: number): string {
		const wholeSeconds = Math.max(0, Math.ceil(seconds));
		const minutes = Math.floor(wholeSeconds / 60);
		const remainder = wholeSeconds % 60;
		return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
	}

	/** Returns the one short line under the countdown. */
	static statusText(runState: PomodoroRunState, kind: PomodoroPeriodKind): string {
		if (runState === 'awaiting-start') return `Press start when you are ready for the ${PomodoroCopy._plainName(kind)}.`;
		if (kind === 'work') return 'Posture monitoring is watching this period.';
		return 'Posture monitoring is on hold until the break ends.';
	}

	/** Returns the label of the pomodoro button in the footer. */
	static toggleLabel(runState: PomodoroRunState): string {
		if (runState === 'off') return 'Pomodoro: off';
		if (runState === 'awaiting-start') return 'Start next period';
		return 'Pomodoro: on';
	}

	/**
	 * Returns the desktop notification content for a finished period: the
	 * period that has just ended in the title, and what comes next, with its
	 * length, in the body.
	 */
	static finishedContent(
		finishedKind: PomodoroPeriodKind,
		nextKind: PomodoroPeriodKind,
		nextDurationSec: number,
		startsNextPeriodAutomatically: boolean,
	): PomodoroAlertContent {
		const title = finishedKind === 'work' ? 'Work period finished.' : 'Break finished.';
		const minutes = Math.round(nextDurationSec / 60);
		let body = `Back to work for ${minutes} minutes.`;
		if (nextKind === 'short-break') body = `Stand up and take a short break of ${minutes} minutes.`;
		if (nextKind === 'long-break') body = `Stand up and take a long break of ${minutes} minutes.`;
		if (startsNextPeriodAutomatically === false) body = `${body} Press start when you are ready.`;
		return { title, body };
	}

	/** Returns the plain name of a period, for use inside a sentence. */
	private static _plainName(kind: PomodoroPeriodKind): string {
		if (kind === 'work') return 'work period';
		if (kind === 'short-break') return 'short break';
		return 'long break';
	}
}

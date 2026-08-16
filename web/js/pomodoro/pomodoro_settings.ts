///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PomodoroSettings — the seven values that shape a pomodoro cycle
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const SETTINGS_STORAGE_KEY = 'sit-up-please.pomodoro-settings.v1';

/** The values that decide how long each period lasts and what happens between periods. */
export type PomodoroSettingsValues = {
	/** How long one work period lasts, in seconds. */
	workPeriodSec: number;
	/** How long a short break lasts, in seconds. */
	shortBreakSec: number;
	/** How long a long break lasts, in seconds. */
	longBreakSec: number;
	/** How many work periods are finished before a long break is offered instead of a short break. */
	workPeriodsBeforeLongBreak: number;
	/** Whether the next period starts on its own, instead of waiting for the person to press start. */
	startsNextPeriodAutomatically: boolean;
	/** Whether posture monitoring holds still for the length of a break. */
	pausesPostureMonitoringDuringBreak: boolean;
};

/** The values used when the browser has nothing stored from an earlier visit. */
export const POMODORO_DEFAULT_SETTINGS: PomodoroSettingsValues = {
	workPeriodSec: 25 * 60,
	shortBreakSec: 5 * 60,
	longBreakSec: 15 * 60,
	workPeriodsBeforeLongBreak: 4,
	startsNextPeriodAutomatically: false,
	pausesPostureMonitoringDuringBreak: true,
};

/**
 * Reads and writes the pomodoro settings in local browser storage. Nothing on
 * the screen changes these values yet: the timer reads the defaults above, and
 * this class is the one place the Pomodoro settings panel writes to.
 */
export class PomodoroSettings {
	/** Returns the stored settings, filling in every absent value from the defaults. */
	static load(): PomodoroSettingsValues {
		try {
			const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
			if (stored === null) return { ...POMODORO_DEFAULT_SETTINGS };
			const parsed = JSON.parse(stored) as Partial<PomodoroSettingsValues>;
			return { ...POMODORO_DEFAULT_SETTINGS, ...parsed };
		} catch {
			return { ...POMODORO_DEFAULT_SETTINGS };
		}
	}

	/** Stores the settings, and does nothing when browser storage is unavailable. */
	static save(settings: PomodoroSettingsValues): void {
		try {
			localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
		} catch {
			// An unavailable storage only costs the settings their history.
		}
	}
}

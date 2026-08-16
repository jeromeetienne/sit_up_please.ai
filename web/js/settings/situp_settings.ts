import type { PostureTolerances } from '../monitor/monitor_types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SitupSettings — the five values that shape how a slouch is measured and alerted
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const SETTINGS_STORAGE_KEY = 'sit-up-please.situp-settings.v1';

/** The values that decide when a posture counts as a slouch, and how the session is timed. */
export type SitupSettingsValues = {
	/**
	 * How much larger or smaller the face may look than at the calibrated
	 * reference before the posture counts as a slouch, as a share of the
	 * calibrated face size. This is the tolerance for leaning forward and back.
	 */
	forwardAndBackTolerance: number;
	/**
	 * How far the face may move sideways from the calibrated reference before the
	 * posture counts as a slouch, as a share of the width of the camera picture.
	 */
	sidewaysTolerance: number;
	/** How long a slouch must last before the alert is raised, in seconds. */
	alertDelaySec: number;
	/** How many counts the calibration countdown runs through before the reference posture is taken. */
	calibrationCount: number;
	/** How many posture readings are taken every second. */
	readsPerSecond: number;
};

/** The smallest and largest value each setting accepts, in the unit the Situp settings panel writes it in. */
export const SITUP_SETTINGS_RANGES = {
	/** The forward and back tolerance, as a percentage of the calibrated face size. */
	forwardAndBackTolerancePercent: {
		min: 4,
		max: 40,
	},
	/** The sideways tolerance, as a percentage of the width of the camera picture. */
	sidewaysTolerancePercent: {
		min: 2,
		max: 30,
	},
	/** The slouch time before the alert, in seconds. */
	alertDelaySec: {
		min: 1,
		max: 120,
	},
	/** The number of counts of the calibration countdown. */
	calibrationCount: {
		min: 1,
		max: 10,
	},
	/** The number of posture readings taken every second. */
	readsPerSecond: {
		min: 1,
		max: 10,
	},
};

/**
 * The values used when the browser has nothing stored from an earlier visit.
 * They are the values the application carried as fixed constants before the
 * Situp settings panel could edit them.
 */
export const SITUP_DEFAULT_SETTINGS: SitupSettingsValues = {
	forwardAndBackTolerance: 0.14,
	sidewaysTolerance: 0.07,
	alertDelaySec: 5,
	calibrationCount: 3,
	readsPerSecond: 2,
};

/**
 * Reads and writes the situp settings in local browser storage. Every value read
 * back is held inside its range, so a setup stored by an older version of the
 * application can never ask for a tolerance of zero or a reading rate no camera
 * can keep up with.
 */
export class SitupSettings {
	/** Returns the stored settings, filling in every absent or unusable value from the defaults. */
	static load(): SitupSettingsValues {
		try {
			const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
			if (stored === null) return { ...SITUP_DEFAULT_SETTINGS };
			const parsed = JSON.parse(stored) as Partial<SitupSettingsValues>;
			return SitupSettings._sanitised(parsed);
		} catch {
			return { ...SITUP_DEFAULT_SETTINGS };
		}
	}

	/**
	 * Stores the settings, and does nothing when browser storage is unavailable.
	 *
	 * @param settings - The situp settings to store.
	 * @returns Nothing.
	 */
	static save(settings: SitupSettingsValues): void {
		try {
			localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
		} catch {
			// An unavailable storage only costs the settings their history.
		}
	}

	/**
	 * Returns the two tolerances on their own, in the shape the posture reading
	 * asks for, so nothing outside this folder has to know how a situp setting is
	 * named or stored.
	 *
	 * @param settings - The situp settings to take the tolerances from.
	 * @returns The forward and back tolerance and the sideways tolerance.
	 */
	static tolerancesOf(settings: SitupSettingsValues): PostureTolerances {
		return {
			forwardAndBack: settings.forwardAndBackTolerance,
			sideways: settings.sidewaysTolerance,
		};
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/** Returns one usable set of settings built from stored values and the defaults. */
	private static _sanitised(parsed: Partial<SitupSettingsValues>): SitupSettingsValues {
		const ranges = SITUP_SETTINGS_RANGES;
		return {
			forwardAndBackTolerance: SitupSettings._heldInside(
				parsed.forwardAndBackTolerance,
				SITUP_DEFAULT_SETTINGS.forwardAndBackTolerance,
				{ min: ranges.forwardAndBackTolerancePercent.min / 100, max: ranges.forwardAndBackTolerancePercent.max / 100 },
			),
			sidewaysTolerance: SitupSettings._heldInside(
				parsed.sidewaysTolerance,
				SITUP_DEFAULT_SETTINGS.sidewaysTolerance,
				{ min: ranges.sidewaysTolerancePercent.min / 100, max: ranges.sidewaysTolerancePercent.max / 100 },
			),
			alertDelaySec: SitupSettings._heldInside(
				parsed.alertDelaySec,
				SITUP_DEFAULT_SETTINGS.alertDelaySec,
				ranges.alertDelaySec,
			),
			calibrationCount: SitupSettings._heldInside(
				parsed.calibrationCount,
				SITUP_DEFAULT_SETTINGS.calibrationCount,
				ranges.calibrationCount,
			),
			readsPerSecond: SitupSettings._heldInside(
				parsed.readsPerSecond,
				SITUP_DEFAULT_SETTINGS.readsPerSecond,
				ranges.readsPerSecond,
			),
		};
	}

	/** Returns one stored number held inside its range, or its default when the stored value is no usable number. */
	private static _heldInside(stored: unknown, fallback: number, range: { min: number; max: number }): number {
		if (typeof stored !== 'number' || Number.isFinite(stored) === false) return fallback;
		return Math.min(range.max, Math.max(range.min, stored));
	}
}

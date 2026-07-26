import type { PostureDirection, SlipContent } from './monitor_types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MonitorCopy — every sentence the monitor screen can show
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The written content of the interface, kept in one place so the wording can be
 * reviewed without reading the state machine.
 */
export class MonitorCopy {
	/** Rotating encouragement shown while the posture matches the reference. */
	static readonly GOOD_LINES = [
		'Stacked and level. Your neck is doing nothing it will regret.',
		'Shoulders open, chin over the collarbone. Carry on.',
		'That is the reference posture, held.',
	];

	/** The headline word for each direction the posture can drift in. */
	static readonly BAD_VERDICTS: Record<PostureDirection, string> = {
		forward: 'Leaning in.',
		left: 'Leaning left.',
		right: 'Leaning right.',
		down: 'Slumping.',
	};

	/** Rotating correction lines for each direction the posture can drift in. */
	static readonly BAD_LINES: Record<PostureDirection, string[]> = {
		forward: [
			'Your head has drifted forward. Slide back into the chair and let the screen come to you.',
			'You are leaning in. Push the hips back, drop the shoulders, unclench the jaw.',
		],
		left: [
			'You have drifted toward your left. Bring your shoulders back level over your hips.',
			'Your weight has shifted left. Centre yourself in the chair.',
		],
		right: [
			'You have drifted toward your right. Bring your shoulders back level over your hips.',
			'Your weight has shifted right. Centre yourself in the chair.',
		],
		down: [
			'The chin is dipping. Lift the sternum an inch and the rest follows.',
			'You are sinking in the seat. Draw yourself back up against the backrest.',
		],
	};

	/** The reminders shown in the "stop press" slip, chosen in turn. */
	static readonly SLIP_NOTES: SlipContent[] = [
		{ title: 'Chin back.', body: 'Ten seconds of forward head. Ease the skull over the shoulders and breathe out.' },
		{ title: 'Shoulders down.', body: 'They have crept toward your ears again. Let them fall on the exhale.' },
		{ title: 'Sit back.', body: 'You have inched to the front of the seat. Find the backrest.' },
	];

	/** How many session seconds pass before the upright guidance line changes. */
	static readonly GOOD_LINE_INTERVAL_SEC = 47;

	/** Returns the masthead date, for example `SUN 26 JUL`. */
	static dateline(date: Date): string {
		const formatted = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
		return formatted.toUpperCase();
	}

	/** Formats a duration as `12s` below a minute and `3 min 4s` above it. */
	static formatDuration(seconds: number): string {
		const wholeSeconds = Math.max(0, Math.floor(seconds));
		const minutes = Math.floor(wholeSeconds / 60);
		const remainder = wholeSeconds % 60;
		if (minutes > 0) return `${minutes} min ${remainder}s`;
		return `${remainder}s`;
	}

	/** Returns the upright guidance line for a session length in seconds. */
	static goodLine(sessionSeconds: number): string {
		const index = Math.floor(sessionSeconds / MonitorCopy.GOOD_LINE_INTERVAL_SEC) % MonitorCopy.GOOD_LINES.length;
		return MonitorCopy.GOOD_LINES[index];
	}

	/** Returns the headline word naming the direction the posture has drifted in. */
	static badVerdict(direction: PostureDirection): string {
		return MonitorCopy.BAD_VERDICTS[direction];
	}

	/** Returns the correction line for a direction, rotated by the number of slips seen so far. */
	static badLine(direction: PostureDirection, slipCount: number): string {
		const lines = MonitorCopy.BAD_LINES[direction];
		return lines[slipCount % lines.length];
	}

	/** Returns the slip reminder for the number of slips seen so far. */
	static slipNote(slipCount: number): SlipContent {
		return MonitorCopy.SLIP_NOTES[slipCount % MonitorCopy.SLIP_NOTES.length];
	}
}

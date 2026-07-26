import type { PostureBaseline, PostureDirection, PostureMeasurement } from './monitor_types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PostureReference — stores the calibrated posture and scores live readings
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const BASELINE_STORAGE_KEY = 'sit-up-please.posture-baseline.v1';

/**
 * The calibrated reference posture: how it is saved, how calibration samples
 * are averaged, and how a live measurement is turned into a single number that
 * says how far the person has moved away from that reference.
 */
export class PostureReference {
	/**
	 * A reading above this value counts as slouching. A reading of exactly this
	 * value is the point at which one difference measure reaches its full
	 * tolerance, so the scale reads as "0 is calibrated, 1 is far out".
	 */
	static readonly BAD_LEAN_THRESHOLD = 0.42;

	/** The smallest reading the interface reports, for leaning further back. */
	static readonly MIN_LEAN = -0.25;

	/** The largest reading the interface reports. */
	static readonly MAX_LEAN = 1;

	/** How much larger the face may look before the reading reaches the threshold. */
	private static readonly _FACE_SCALE_TOLERANCE = 0.14;

	/** How far the face may move sideways before the reading reaches the threshold. */
	private static readonly _HORIZONTAL_TOLERANCE = 0.07;

	/** How far the face may sink before the reading reaches the threshold. */
	private static readonly _VERTICAL_TOLERANCE = 0.06;

	/**
	 * Reads and validates the saved reference posture from local browser storage.
	 * Older or malformed data is ignored so a new calibration can replace it.
	 */
	static load(): PostureBaseline | undefined {
		try {
			const storedBaseline = localStorage.getItem(BASELINE_STORAGE_KEY);
			if (storedBaseline === null) return undefined;
			const parsedBaseline = JSON.parse(storedBaseline) as Partial<PostureBaseline>;
			const isComplete = Number.isFinite(parsedBaseline.faceScale)
				&& Number.isFinite(parsedBaseline.faceX)
				&& Number.isFinite(parsedBaseline.faceY)
				&& Number.isFinite(parsedBaseline.headTilt);
			if (isComplete === false) return undefined;
			return parsedBaseline as PostureBaseline;
		} catch {
			return undefined;
		}
	}

	/** Writes the reference posture to local browser storage. */
	static save(baseline: PostureBaseline): void {
		try {
			localStorage.setItem(BASELINE_STORAGE_KEY, JSON.stringify(baseline));
		} catch {
			// Monitoring continues for this session when storage is unavailable.
		}
	}

	/** Averages accepted calibration samples into one reference posture. */
	static mean(measurements: PostureMeasurement[]): PostureBaseline {
		const total = measurements.reduce(
			(sum, measurement) => ({
				faceScale: sum.faceScale + measurement.faceScale,
				faceX: sum.faceX + measurement.faceX,
				faceY: sum.faceY + measurement.faceY,
				headTilt: sum.headTilt + measurement.headTilt,
			}),
			{ faceScale: 0, faceX: 0, faceY: 0, headTilt: 0 },
		);
		return {
			faceScale: total.faceScale / measurements.length,
			faceX: total.faceX / measurements.length,
			faceY: total.faceY / measurements.length,
			headTilt: total.headTilt / measurements.length,
		};
	}

	/**
	 * Rejects calibration samples that differ too much from the first sample.
	 * This prevents saving a reference posture while the person is moving.
	 */
	static isStable(measurement: PostureMeasurement, firstMeasurement: PostureMeasurement): boolean {
		const scaleChange = Math.abs(measurement.faceScale / firstMeasurement.faceScale - 1);
		const verticalChange = Math.abs(measurement.faceY - firstMeasurement.faceY);
		return scaleChange < 0.06 && verticalChange < 0.03;
	}

	/**
	 * Scores a live measurement against the reference posture and names which
	 * direction is most responsible for it.
	 *
	 * The three differences the front camera can see — the face growing larger
	 * because the head has come forward, the face moving sideways, and the face
	 * sinking down the frame — are each divided by their own tolerance, and the
	 * strongest one decides both the returned lean value and its direction. The
	 * lean value is scaled so that reaching a tolerance produces exactly
	 * `BAD_LEAN_THRESHOLD`.
	 */
	static evaluate(measurement: PostureMeasurement, reference: PostureBaseline): { lean: number; direction: PostureDirection } {
		const forwardShare = (measurement.faceScale / reference.faceScale - 1) / PostureReference._FACE_SCALE_TOLERANCE;
		const horizontalShift = measurement.faceX - reference.faceX;
		const horizontalShare = Math.abs(horizontalShift) / PostureReference._HORIZONTAL_TOLERANCE;
		const verticalShare = (measurement.faceY - reference.faceY) / PostureReference._VERTICAL_TOLERANCE;

		const strongestShare = Math.max(forwardShare, horizontalShare, verticalShare);
		const lean = Math.max(
			PostureReference.MIN_LEAN,
			Math.min(PostureReference.MAX_LEAN, strongestShare * PostureReference.BAD_LEAN_THRESHOLD),
		);

		let direction: PostureDirection = 'forward';
		if (strongestShare === verticalShare) direction = 'down';
		else if (strongestShare === horizontalShare) {
			// The camera preview is mirrored, so an increasing source x-coordinate
			// is movement toward the person's left in the preview.
			direction = horizontalShift > 0 ? 'left' : 'right';
		}

		return { lean, direction };
	}
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	InstallPrompt — offers to install the page as a standalone application
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The install prompt event a supporting browser fires, ahead of its public standard. */
type BeforeInstallPromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/**
 * Captures the browser's install prompt the moment it becomes available, and
 * replays it when the person presses the footer's install button.
 *
 * Browsers without a programmatic install prompt (Safari, Firefox) never fire
 * the event this depends on, so the availability callback never fires there
 * either, and the footer button stays hidden.
 */
export class InstallPrompt {
	private _deferredEvent: BeforeInstallPromptEvent | undefined;
	private _onAvailabilityChange: ((isAvailable: boolean) => void) | undefined;

	constructor() {
		window.addEventListener('beforeinstallprompt', (event) => {
			event.preventDefault();
			this._deferredEvent = event as BeforeInstallPromptEvent;
			this._onAvailabilityChange?.(true);
		});
		window.addEventListener('appinstalled', () => {
			this._deferredEvent = undefined;
			this._onAvailabilityChange?.(false);
		});
	}

	/** Calls back with true once an install prompt is available to replay, and false once it has been used or the app is already installed. */
	onAvailabilityChange(callback: (isAvailable: boolean) => void): void {
		this._onAvailabilityChange = callback;
	}

	/** Replays the captured install prompt. Returns whether the person accepted it. */
	async promptInstall(): Promise<boolean> {
		const event = this._deferredEvent;
		if (event === undefined) return false;

		this._deferredEvent = undefined;
		this._onAvailabilityChange?.(false);
		await event.prompt();
		const choice = await event.userChoice;
		return choice.outcome === 'accepted';
	}
}

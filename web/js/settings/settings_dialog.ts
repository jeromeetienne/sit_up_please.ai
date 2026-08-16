import Modal from 'bootstrap/js/dist/modal';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SettingsDialog — the Situp settings panel, which holds the camera settings
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** What the panel tells the rest of the application when something changes. */
export type SettingsDialogCallbacks = {
	/**
	 * Called when the person has pressed restore defaults. Every setting of this
	 * panel acts as soon as it is pressed, so there is nothing for the panel to
	 * put back in its own fields: it asks the rest of the application to put back
	 * the settings it owns, which is the facial landmark drawing.
	 */
	onRestoreDefaults: () => void;
};

/**
 * The Situp settings panel, which holds the camera settings. Every setting of
 * the panel acts as soon as it is pressed rather than on a save, so the panel has
 * no save button and closing it changes nothing further.
 *
 * The pomodoro parameters live in the Pomodoro settings panel and the notification
 * setup in the Notification settings panel, each opened from its own button in the
 * navigation bar.
 */
export class SettingsDialog {
	private readonly _callbacks: SettingsDialogCallbacks;
	private readonly _modal = new Modal(SettingsDialog._require<HTMLElement>('settings-dialog'));
	private readonly _restoreDefaultsButton = SettingsDialog._require<HTMLButtonElement>('settings-restore-defaults');

	constructor(callbacks: SettingsDialogCallbacks) {
		this._callbacks = callbacks;
		this._restoreDefaultsButton.addEventListener('click', () => this._callbacks.onRestoreDefaults());
	}

	/** Opens the panel. */
	open(): void {
		this._modal.show();
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/** Returns an element by its identifier, or fails loudly when it is absent. */
	private static _require<T extends Element>(elementId: string): T {
		const element = document.getElementById(elementId);
		if (element === null) throw new Error(`The Situp settings panel could not find the element "${elementId}".`);
		return element as unknown as T;
	}
}

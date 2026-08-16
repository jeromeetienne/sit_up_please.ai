import Modal from 'bootstrap/js/dist/modal';

import type { NotificationEventKind, NotificationSettingsValues, NotificationSoundName } from './notification_types';
import {
	EVENTS_WITHOUT_DESKTOP_NOTIFICATION,
	NOTIFICATION_DEFAULT_SETTINGS,
	NOTIFICATION_EVENT_KINDS,
	NotificationSettings,
} from './notification_settings';
import { NotificationSounds } from './notification_sounds';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	NotificationDialog — the Notification settings panel, which sets up every event
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The elements of the panel that set up one event. */
type EventControls = {
	/** The switch that shows a desktop notification, absent for an event that cannot show one. */
	desktopInput: HTMLInputElement | undefined;
	/** The switch that plays a sound. */
	soundInput: HTMLInputElement;
	/** The list that chooses which sound of the catalogue the event plays. */
	soundNameSelect: HTMLSelectElement;
	/** The slider that sets how loud the event plays its sound. */
	volumeInput: HTMLInputElement;
	/** The words beside the slider that say the volume as a percentage. */
	volumeValueLabel: HTMLElement;
	/** The button that plays the chosen sound at the chosen volume. */
	playButton: HTMLButtonElement;
};

/** What the panel tells the rest of the application when something changes. */
export type NotificationDialogCallbacks = {
	/** Called with the stored setup once the person has pressed save. */
	onSaved: (settings: NotificationSettingsValues) => void;
	/**
	 * Called every time the person presses a play button, with the sound and the
	 * volume standing in the fields of that event at that moment.
	 */
	onPlaySample: (soundName: NotificationSoundName, volume: number) => void;
	/**
	 * Called as soon as the person presses the allow notifications and sounds
	 * switch, because that switch takes effect at once instead of waiting for
	 * save. The browser permission is asked for the first time it goes on.
	 */
	onTogglePermission: () => void;
	/**
	 * Called when the person has pressed restore defaults. The panel has already
	 * put every event back to its default in its own fields; this asks the rest
	 * of the application to put the browser permission switch back as well.
	 */
	onRestoreDefaults: () => void;
};

/**
 * The Notification settings panel, which sets up, for every event of the
 * application, whether the event shows a desktop notification, whether it plays
 * a sound, which sound of the catalogue it plays and how loud. Every event
 * carries a play button, so the sound and the volume can be heard while they
 * are being chosen.
 *
 * The panel reads the stored setup every time it opens and writes it back to
 * local browser storage on save. Pressing cancel, or closing the panel with the
 * escape key, changes nothing that was stored.
 *
 * The allow notifications and sounds switch at the top of the panel is not part
 * of the save: it holds the browser permission, and takes effect as soon as it
 * is pressed. Restore defaults puts it back too.
 */
export class NotificationDialog {
	private readonly _callbacks: NotificationDialogCallbacks;
	private readonly _modal = new Modal(NotificationDialog._require<HTMLElement>('notification-dialog'));
	private readonly _controls: Record<NotificationEventKind, EventControls>;
	private readonly _permissionSwitch = NotificationDialog._require<HTMLInputElement>('toggle-alerts');
	private readonly _restoreDefaultsButton = NotificationDialog._require<HTMLButtonElement>('notification-restore-defaults');
	private readonly _cancelButton = NotificationDialog._require<HTMLButtonElement>('notification-cancel');
	private readonly _saveButton = NotificationDialog._require<HTMLButtonElement>('notification-save');

	constructor(callbacks: NotificationDialogCallbacks) {
		this._callbacks = callbacks;
		this._controls = NotificationDialog._collectControls();

		for (const eventKind of NOTIFICATION_EVENT_KINDS) {
			this._bindEvent(eventKind);
		}
		this._permissionSwitch.addEventListener('change', () => this._callbacks.onTogglePermission());
		this._restoreDefaultsButton.addEventListener('click', () => this._restoreDefaults());
		this._cancelButton.addEventListener('click', () => this._modal.hide());
		this._saveButton.addEventListener('click', () => this._save());
	}

	/** Opens the panel, showing the notification setup as it is stored right now. */
	open(): void {
		this._fillFields(NotificationSettings.load());
		this._modal.show();
	}

	/**
	 * Puts the allow notifications and sounds switch in its current position, and
	 * greys it out in a browser that offers no notifications at all.
	 *
	 * @param isSupported - Whether this browser offers desktop notifications.
	 * @param isEnabled - Whether notifications and sounds are allowed right now.
	 * @returns Nothing.
	 */
	setPermissionState(isSupported: boolean, isEnabled: boolean): void {
		this._permissionSwitch.disabled = isSupported === false;
		this._permissionSwitch.checked = isEnabled;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Puts every event of the panel back to its default in the fields of the
	 * panel, and, through the callback, puts the browser permission switch back
	 * as well. The events are only stored once the person presses save, as with
	 * any other edit; the permission switch takes effect at once.
	 */
	private _restoreDefaults(): void {
		this._fillFields(NOTIFICATION_DEFAULT_SETTINGS);
		this._callbacks.onRestoreDefaults();
	}

	/** Attaches the sound list, the slider and the play button of one event. */
	private _bindEvent(eventKind: NotificationEventKind): void {
		const controls = this._controls[eventKind];

		NotificationDialog._fillSoundList(controls.soundNameSelect);
		controls.soundInput.addEventListener('change', () => this._applySoundSwitch(eventKind));
		controls.volumeInput.addEventListener('input', () => {
			controls.volumeValueLabel.textContent = NotificationDialog._volumeText(controls.volumeInput);
		});
		controls.playButton.addEventListener('click', () => {
			this._callbacks.onPlaySample(
				controls.soundNameSelect.value as NotificationSoundName,
				NotificationDialog._readVolume(controls.volumeInput, NOTIFICATION_DEFAULT_SETTINGS[eventKind].volume),
			);
		});
	}

	/**
	 * Greys out the sound list and the slider of one event while that event is
	 * set to play no sound. The play button stays available, so the sound can
	 * still be heard while it is being chosen.
	 */
	private _applySoundSwitch(eventKind: NotificationEventKind): void {
		const controls = this._controls[eventKind];
		const playsSound = controls.soundInput.checked;
		controls.soundNameSelect.disabled = playsSound === false;
		controls.volumeInput.disabled = playsSound === false;
	}

	/** Writes one notification setup into the fields of the panel. */
	private _fillFields(settings: NotificationSettingsValues): void {
		for (const eventKind of NOTIFICATION_EVENT_KINDS) {
			const controls = this._controls[eventKind];
			const eventSettings = settings[eventKind];

			if (controls.desktopInput !== undefined) {
				controls.desktopInput.checked = eventSettings.showsDesktopNotification;
			}
			controls.soundInput.checked = eventSettings.playsSound;
			controls.soundNameSelect.value = eventSettings.soundName;
			controls.volumeInput.value = String(Math.round(eventSettings.volume * 100));
			controls.volumeValueLabel.textContent = NotificationDialog._volumeText(controls.volumeInput);
			this._applySoundSwitch(eventKind);
		}
	}

	/** Reads the fields, stores the notification setup and closes the panel. */
	private _save(): void {
		const settings = {} as NotificationSettingsValues;
		for (const eventKind of NOTIFICATION_EVENT_KINDS) {
			const controls = this._controls[eventKind];
			const defaults = NOTIFICATION_DEFAULT_SETTINGS[eventKind];

			settings[eventKind] = {
				showsDesktopNotification: controls.desktopInput === undefined ? false : controls.desktopInput.checked,
				playsSound: controls.soundInput.checked,
				soundName: NotificationSounds.isKnownName(controls.soundNameSelect.value)
					? controls.soundNameSelect.value
					: defaults.soundName,
				volume: NotificationDialog._readVolume(controls.volumeInput, defaults.volume),
			};
		}

		NotificationSettings.save(settings);
		this._callbacks.onSaved(settings);
		this._modal.hide();
	}

	/** Puts every sound of the catalogue into one list, in the order the catalogue holds them. */
	private static _fillSoundList(select: HTMLSelectElement): void {
		const fragment = document.createDocumentFragment();
		for (const soundName of NotificationSounds.allNames()) {
			const option = document.createElement('option');
			option.value = soundName;
			option.textContent = NotificationSounds.labelFor(soundName);
			fragment.append(option);
		}
		select.replaceChildren(fragment);
	}

	/** Returns the volume of one slider, between 0 and 1, or the default when it holds no number. */
	private static _readVolume(input: HTMLInputElement, fallback: number): number {
		const parsed = Number.parseInt(input.value, 10);
		if (Number.isFinite(parsed) === false) return fallback;
		return Math.min(1, Math.max(0, parsed / 100));
	}

	/** Returns the volume of one slider as the percentage shown beside it. */
	private static _volumeText(input: HTMLInputElement): string {
		const parsed = Number.parseInt(input.value, 10);
		return `${Number.isFinite(parsed) ? parsed : 0}%`;
	}

	/** Looks up the elements of every event once, by the identifier of its own row. */
	private static _collectControls(): Record<NotificationEventKind, EventControls> {
		const controls = {} as Record<NotificationEventKind, EventControls>;
		for (const eventKind of NOTIFICATION_EVENT_KINDS) {
			const hasDesktopNotification = EVENTS_WITHOUT_DESKTOP_NOTIFICATION.includes(eventKind) === false;
			controls[eventKind] = {
				desktopInput: hasDesktopNotification
					? NotificationDialog._require<HTMLInputElement>(`notification-${eventKind}-desktop`)
					: undefined,
				soundInput: NotificationDialog._require<HTMLInputElement>(`notification-${eventKind}-sound`),
				soundNameSelect: NotificationDialog._require<HTMLSelectElement>(`notification-${eventKind}-sound-name`),
				volumeInput: NotificationDialog._require<HTMLInputElement>(`notification-${eventKind}-volume`),
				volumeValueLabel: NotificationDialog._require<HTMLElement>(`notification-${eventKind}-volume-value`),
				playButton: NotificationDialog._require<HTMLButtonElement>(`notification-${eventKind}-play`),
			};
		}
		return controls;
	}

	/** Returns an element by its identifier, or fails loudly when it is absent. */
	private static _require<T extends Element>(elementId: string): T {
		const element = document.getElementById(elementId);
		if (element === null) throw new Error(`The Notification settings panel could not find the element "${elementId}".`);
		return element as unknown as T;
	}
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ThemePreference — remembers a forced light or dark theme for six hours
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const THEME_STORAGE_KEY = 'sit-up-please.theme-choice.v1';

/** How long a forced light theme or dark theme is remembered, in milliseconds. */
export const THEME_CHOICE_LIFETIME_MSEC = 6 * 60 * 60 * 1000;

/** The three settings a person can pick between. */
export type ThemeChoice = 'system' | 'light' | 'dark';

/** The order the theme button walks through, one press at a time. */
const THEME_CHOICE_ORDER: ThemeChoice[] = ['system', 'light', 'dark'];

/** What is written into local browser storage for a forced theme. */
type StoredThemeChoice = {
	/** The forced theme, which is never the operating system setting. */
	choice: 'light' | 'dark';
	/** When the person picked that theme, as milliseconds since the epoch. */
	savedAtMsec: number;
};

/**
 * Holds the theme setting: the operating system setting, a forced light theme
 * or a forced dark theme. A forced theme is written to local browser storage
 * and is remembered for six hours; once those six hours have passed the setting
 * is forgotten and the page follows the operating system again, whether the
 * page was closed in the meantime or has stayed open the whole time.
 *
 * The forced theme reaches the stylesheet as the Bootstrap data-bs-theme
 * attribute on the root element, which narrows the colour scheme declared in
 * `web/css/tokens.scss` and switches the Bootstrap parts of the page with it.
 */
export class ThemePreference {
	/** The setting in force right now. */
	private _choice: ThemeChoice = 'system';
	/** When the forced theme in force right now was picked, as milliseconds since the epoch. */
	private _savedAtMsec = 0;
	/** The timer that forgets a forced theme while the page stays open. */
	private _forgetTimer: number | undefined = undefined;
	/** Called every time the setting changes, so the button can be relabelled. */
	private _onChanged: (choice: ThemeChoice) => void = () => {};

	/**
	 * Reads the stored theme, drops it when it is older than six hours, and
	 * writes the result to the page straight away.
	 */
	constructor() {
		const loaded = ThemePreference._loadChoice();
		this._choice = loaded.choice;
		this._savedAtMsec = loaded.savedAtMsec;
		this._apply();

		// The operating system setting is read once and written to the page, so a
		// change to it while the page is open has to be followed by hand.
		ThemePreference._systemQuery().addEventListener('change', () => {
			if (this._choice !== 'system') return;
			this._apply();
		});
	}

	/** The setting in force right now. */
	get choice(): ThemeChoice {
		return this._choice;
	}

	/**
	 * Registers the function called every time the setting changes, and calls it
	 * once with the setting in force right now.
	 *
	 * @param onChanged Called with the new setting on every change.
	 * @returns Nothing.
	 */
	onChange(onChanged: (choice: ThemeChoice) => void): void {
		this._onChanged = onChanged;
		this._onChanged(this._choice);
	}

	/**
	 * Moves to the next setting: the operating system setting, then the light
	 * theme, then the dark theme, then back to the operating system setting.
	 *
	 * @returns Nothing.
	 */
	cycle(): void {
		const nextIndex = (THEME_CHOICE_ORDER.indexOf(this._choice) + 1) % THEME_CHOICE_ORDER.length;
		this.set(THEME_CHOICE_ORDER[nextIndex]);
	}

	/**
	 * Puts one setting in force, stores it, and writes it to the page.
	 *
	 * @param choice The setting the person picked.
	 * @returns Nothing.
	 */
	set(choice: ThemeChoice): void {
		this._choice = choice;
		this._savedAtMsec = Date.now();
		ThemePreference._storeChoice(choice, this._savedAtMsec);
		this._apply();
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Writes the setting to the root element and to the browser interface colour,
	 * arms the timer that forgets a forced theme, and reports the setting.
	 */
	private _apply(): void {
		// Bootstrap only knows the light theme and the dark theme, so the
		// operating system setting is read here and written as one of the two.
		const rootElement = document.documentElement;
		rootElement.setAttribute('data-bs-theme', this._choice === 'system' ? ThemePreference._systemTheme() : this._choice);

		ThemePreference._paintBrowserInterface();
		this._armForgetTimer();
		this._onChanged(this._choice);
	}

	/**
	 * Starts the timer that returns the page to the operating system setting once
	 * the six hours of a forced theme have passed, and cancels any earlier timer.
	 * The timer counts the hours left of the six, not six fresh hours, so a theme
	 * picked in an earlier visit is forgotten at the same moment either way.
	 */
	private _armForgetTimer(): void {
		if (this._forgetTimer !== undefined) {
			window.clearTimeout(this._forgetTimer);
			this._forgetTimer = undefined;
		}

		if (this._choice === 'system') return;

		const remainingMsec = Math.max(0, this._savedAtMsec + THEME_CHOICE_LIFETIME_MSEC - Date.now());
		this._forgetTimer = window.setTimeout(() => {
			this._forgetTimer = undefined;
			this.set('system');
		}, remainingMsec);
	}

	/** The media query that reports the dark theme of the operating system. */
	private static _systemQuery(): MediaQueryList {
		return window.matchMedia('(prefers-color-scheme: dark)');
	}

	/** The theme the operating system is asking for right now. */
	private static _systemTheme(): 'light' | 'dark' {
		return ThemePreference._systemQuery().matches ? 'dark' : 'light';
	}

	/**
	 * Copies the page background colour into the theme-color element of the page
	 * head, which is the colour the browser paints its own bars with.
	 */
	private static _paintBrowserInterface(): void {
		const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
		if (themeColor === null) return;
		// The background of the root element, not the --color-bg token itself: the
		// token still holds the light-dark() pair, which no browser accepts here.
		const background = getComputedStyle(document.documentElement).backgroundColor;
		if (background === '') return;
		themeColor.content = background;
	}

	/**
	 * Returns the stored setting and the moment it was picked, or the operating
	 * system setting when nothing is stored, when the stored setting is older than
	 * six hours, or when local browser storage cannot be read.
	 */
	private static _loadChoice(): { choice: ThemeChoice; savedAtMsec: number } {
		const systemSetting = {
			choice: 'system' as ThemeChoice,
			savedAtMsec: 0,
		};

		try {
			const stored = localStorage.getItem(THEME_STORAGE_KEY);
			if (stored === null) return systemSetting;

			const parsed = JSON.parse(stored) as Partial<StoredThemeChoice>;
			const isForcedTheme = parsed.choice === 'light' || parsed.choice === 'dark';
			const savedAtMsec = typeof parsed.savedAtMsec === 'number' ? parsed.savedAtMsec : 0;
			const ageMsec = Date.now() - savedAtMsec;
			if (isForcedTheme === false || ageMsec < 0 || ageMsec >= THEME_CHOICE_LIFETIME_MSEC) {
				localStorage.removeItem(THEME_STORAGE_KEY);
				return systemSetting;
			}

			return {
				choice: parsed.choice as ThemeChoice,
				savedAtMsec: savedAtMsec,
			};
		} catch {
			return systemSetting;
		}
	}

	/**
	 * Stores a forced theme with the moment it was picked, and removes whatever
	 * was stored when the setting is the operating system setting. An unavailable
	 * storage only costs the setting its six hours of memory.
	 */
	private static _storeChoice(choice: ThemeChoice, savedAtMsec: number): void {
		try {
			if (choice === 'system') {
				localStorage.removeItem(THEME_STORAGE_KEY);
				return;
			}

			const stored: StoredThemeChoice = {
				choice: choice,
				savedAtMsec: savedAtMsec,
			};
			localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(stored));
		} catch {
			// An unavailable storage only costs the setting its memory.
		}
	}
}

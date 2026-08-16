# Directory Context: `/web/js/theme`

## Purpose
Holds the theme setting: whether the page follows the operating system, forces the light theme, or forces the dark theme, and for how long a forced theme is remembered.

## Key Exports & Entry Points
- `theme_preference.ts`: `ThemePreference`, whose `cycle()` walks through the three settings, whose `onChange()` reports the setting in force so the theme button can be relabelled, and whose `THEME_CHOICE_LIFETIME_MSEC` is the six hours a forced theme is remembered for.

## Rules
- The colour values themselves live in `../../css/tokens.css`; nothing here holds a colour, and the only thing written to the page is the `data-theme` attribute on the root element and the `theme-color` element of the page head.
- A forced theme is forgotten six hours after it was picked, whether the page was closed in the meantime or has stayed open the whole time, and the page then follows the operating system again.
- The operating system setting stores nothing: it removes whatever was stored instead of writing a third value.

## Background
- The three settings and the `data-theme` attribute come from [issue #12](https://github.com/jeromeetienne/sit_up_please.ai/issues/12).

# Handoff: "Sit Up, Please" — posture monitor UI redesign

## Overview

A single-screen desktop web app that uses the laptop camera to tell the user whether they are sitting up straight. This handoff replaces the existing UI (see `reference/current-ui-before.png`) with a restructured layout built on the **Broadsheet** design system.

The redesign fixes four specific complaints about the current build:

1. **Too many borders/boxes.** The old UI is one big dark-green rounded card containing another rounded card. The new page is an open sheet: whitespace and one thick/thin rule pair do the structuring.
2. **The video is too small.** It is now the hero — roughly 60% of page width, 4:3, with a live tracking overlay drawn on top.
3. **Buttons everywhere, always.** There is now **one** primary button in the idle state. Once monitoring is live, secondary controls sit in a footer row held at 40% opacity that only comes up on hover.
4. **No colour/icon for posture state.** State is now the loudest thing on the page: one colour token (`--state`) simultaneously drives the video's left spine strip, the tracking overlay, a posture pictogram and a full-size headline word (*Upright.* / *Slouching.*).

## About the design files

`design/Sit Up Please.dc.html` is a **design reference created in HTML** — a working prototype showing intended look, states and behaviour. It is **not production code to copy**. It uses a bespoke streaming-template runtime (`support.js`, `<x-dc>`, `{{ }}` holes, `<sc-if>` / `<sc-for>`) that exists only in the design tool; do not port that runtime.

Your task is to **recreate this design in the target codebase's own environment** using its established framework, component library and conventions. The logic class in the file is plain React-class-shaped JavaScript, so the state machine, timing and copy translate almost directly to a React function component with hooks (or the equivalent in whatever framework the app uses).

To view the prototype: open `design/Sit Up Please.dc.html` in a browser from a local static server (it needs the sibling `support.js` and `_ds/` folder, and it will request camera permission).

## Fidelity

**High fidelity.** Colours, type, spacing, states and copy are final. Recreate pixel-accurately, but source every value from the Broadsheet stylesheet (`design/_ds/broadsheet-…/styles.css`) rather than hard-coding — see Design Tokens below.

## Screens / views

There is **one screen** with four phases, plus one transient popup. No navigation, no routing.

### Screen: Monitor (the only screen)

**Purpose:** the user glances at it out of the corner of their eye while working, and corrects their posture when the page turns magenta (or red).

**Page frame**

- Root: `min-height:100vh`, background `--color-bg` (#f3f2f2), text `--color-text` (#201e1d), body font `--font-body` (Source Serif 4), base `font-size:15px`, `line-height:1.55`.
- Padding: `var(--pad)` on left/right/top, `0` bottom. `--pad` = **44px** roomy / **28px** compact.
- `position:relative; overflow-x:clip; box-sizing:border-box`.
- Two 13×13px registration corner marks, absolutely positioned at `top:18px; left:18px` and `top:18px; right:18px`, drawn as `border-left+border-top` / `border-right+border-top`, `1px solid`, colour `--color-neutral-400`.

**Masthead** (front-page furniture — the one place rules are allowed in this system)

- Flex row, `align-items:baseline`, `justify-content:space-between`, `gap:24px`.
- Left: wordmark "SIT UP, PLEASE" — `--font-heading`, weight 600, 15px, `letter-spacing:.14em`, `text-transform:uppercase`. Non-breaking spaces between words.
- Right: three spans, `display:flex; gap:22px; flex:none; white-space:nowrap`, 12px, `letter-spacing:.1em`, uppercase, colour `--color-neutral-700`: `ON-DEVICE ONLY` · `NO. 014` · today's dateline (`en-GB`, `{weekday:'short', day:'numeric', month:'short'}`, uppercased, e.g. `SUN 26 JUL`).
- Below: a **3px** full-bleed bar in `--color-text` (`margin-top:9px`), then a **1px** bar in `--color-text` (`margin-top:3px`), then `margin-bottom: var(--gap)`.

**Main grid**

- `display:grid; grid-template-columns: var(--grid); gap: var(--gap); align-items:start`.
- `--grid` = `minmax(0,1.35fr) minmax(420px,0.65fr)` normally; `minmax(0,1fr)` (stacked) when the `layout` option is `stacked` **or** `window.innerWidth < 1100`. Recompute on resize.
- `--gap` = **44px** roomy / **26px** compact.

#### Left column — the video plate

- Wrapper `position:relative`. Plate: `aspect-ratio:4/3`, background `--color-neutral-900` (#2d2b2b), `border-radius: var(--radius-md)` (2px), `overflow:hidden`.
- `<video autoplay muted playsinline>` absolutely filling the plate, `object-fit:cover`, `filter: grayscale(.4) contrast(1.18)`, `transform: scaleX(-1)` (mirrored, as users expect of a self-view).
- **Newsprint dot screen** over the video (this system's `.halftone` idea for interface imagery): absolute, `pointer-events:none`, `background-image: radial-gradient(circle at 1px 1px, rgba(0,0,0,.42) 1px, transparent 1.2px)`, `background-size:4px 4px`, `mix-blend-mode:multiply`, `opacity:.55`.
- **State spine:** absolute `left:0; top:0; bottom:0; width:9px; background: var(--state); transition: background .5s ease`. This is the peripheral-vision indicator.
- **Live badge:** absolute `right:14px; top:14px`, flex row `gap:8px`, 11px uppercase `letter-spacing:.14em`, colour `--color-bg` at `opacity:.8`. Leading 7px dot in `var(--state)` animating `bs-blink 1.8s infinite` (opacity 1 → .15 → 1). Label: `Off` / `Live` / `No camera`.

**Tracking overlay** (shown when not idle, and when the `showGuides` option is on). Absolute, `pointer-events:none`:

- Vertical plumb line: `left:50%; top:6%; bottom:6%; border-left:1px dashed rgba(243,242,242,.35)`.
- Head ring: 96×96 circle, `left:50%; top:20%; margin-left:-48px`, `border:2px solid var(--state)`, `border-radius:50%`, `transform: translate(calc(var(--tilt) * 1.4), var(--bob))`, `transition: transform .35s ease, border-color .5s ease`.
- Shoulder bar: `left:50%; top:58%; width:56%; margin-left:-28%; height:2px; background: var(--state)`, `transform-origin:50% 50%`, `transform: rotate(var(--tilt)) translateY(var(--bob))`, same transition.
- Centre pip: 9px dot at `left:50%; top:58%` (`margin:-4px 0 0 -4px`), `background: var(--state)`.
- `--tilt` = `lean * 13` degrees; `--bob` = `lean * 16` px. Both written to `document.documentElement` so the overlay can animate without re-rendering.

**Idle placeholder** (phase `idle`): centred column, gap 10px — "Camera off" in `--font-heading` 26px, `--color-neutral-300`; below it "NOTHING IS RECORDED, EVER", 13px uppercase `letter-spacing:.1em`, `--color-neutral-400`.

**Calibration overlay** (phase `calibrating`): full-cover `rgba(32,30,29,.72)`, centred column. Kicker "HOLD YOUR BEST POSTURE" 12px uppercase `letter-spacing:.14em` at `opacity:.75`; countdown numeral `--font-heading` 600 **112px** `line-height:1`; both in `--color-bg`.

**Caption row** under the plate: `margin-top:9px`, flex `space-between`, 11px uppercase `letter-spacing:.12em`, `--color-neutral-600`. Left: `Front camera · mirrored`, or `Camera blocked — showing the tracking layer only`. Right: `2 reads / second` when running, else `Idle`.

#### Right column — the verdict

Flex column, `gap:22px`, `padding-top:2px`.

1. **Kicker row:** 8px dot in `var(--state)` + label, 12px uppercase `letter-spacing:.14em`, `--color-neutral-700`. Label: `Standing by` / `Live monitor` / `Paused`.
2. **Verdict row:** flex, `align-items:flex-start`, `gap:18px`, `min-width:0`.
   - **Posture pictogram** — inline SVG, `viewBox="0 0 48 72"`, rendered 46×69, `margin-top:6px`, `color: var(--state)`, `transition: color .5s ease`. Three elements:
     - seat line `M6 68h36`, `stroke=currentColor`, `stroke-opacity=.28`, `stroke-width=2`
     - spine path, `stroke-width=3.5`, `stroke-linecap=round`. Good: `M23 62 C 23 48, 23 38, 23 28` (straight). Bad: `M22 62 C 24 48, 30 40, ${30+dx} 28` (forward curve), where `dx = max(0, lean) * 11`.
     - head circle `r=8`, `stroke-width=3.5`, `fill=currentColor`, `fill-opacity=.16`. Good: `cx=23, cy=18`. Bad: `cx=32+dx, cy=21`.
   - **Headline** `<h1>`: `font-size: clamp(40px, 5.2vw, 78px)`, `line-height:.94`, `letter-spacing:-.03em`, `margin:0`, `min-width:0`, `overflow-wrap:anywhere`, `hyphens:auto`, `text-wrap:balance`, `color: var(--state)`, `transition: color .5s ease`. (The clamp + `min-width:0` are load-bearing — a fixed 78px "Slouching." overflows the column below ~1100px.)
3. **Guidance paragraph:** `margin:0`, 19px, `line-height:1.45`, `max-width:34ch`, `text-wrap:pretty`, default text colour.
4. **Meta line:** `margin:0`, 14px, `--color-neutral-700`, **italic** (Source Serif 4's true italic).
5. **Idle only — the single primary button:** `--font-heading`, weight 600, **19px**, `padding:15px 30px`, `border:none`, `border-radius: var(--radius-md)`, `background: var(--color-accent)`, `color:#fff`, `cursor:pointer`, `transition: background .18s`. Hover → `--color-accent-600`; active → `--color-accent-700`. Label: **"Start watching my back"**. Below it, 13px `--color-neutral-700`: "Takes three seconds to calibrate."
6. **Live only — the figures:** `border-top:1px solid var(--color-divider)`, `padding-top:18px`, 3-column grid, `gap:18px`. Each cell: value in `--font-heading` **38px** `line-height:1`, label below at 11px uppercase `letter-spacing:.12em` `--color-neutral-700`. Cells: `Upright` (integer %), `Slips` (count), `Best run` (formatted duration).

#### Session ribbon (live only, full width, below the grid)

- `margin-top: var(--gap)`. Header row: `space-between`, 11px uppercase `letter-spacing:.12em`, `--color-neutral-700` — left "THE SESSION SO FAR", right the elapsed session time.
- Bar strip: flex, `align-items:flex-end`, `gap:2px`, `height:52px`, `border-bottom:1px solid var(--color-text)`.
- One bar per 2 seconds of session, keeping the **last 72**. Each: `flex:1 1 0`, `min-width:2px`, `height: round(14 + (1 - min(lean,1)) * 36)` px, background = good/bad state colour, `opacity: 1` if bad else `.55`.

#### Footer (always present, hover-revealed)

- `margin-top: var(--gap)`, `padding:16px 0 22px`, `border-top:1px solid var(--color-divider)`, flex `space-between`, `gap:24px`, **`opacity:.4`**, `transition: opacity .22s`, `:hover → opacity:1`.
- Left: 13px `--color-neutral-700` — "**On-device by design.** Frames and landmarks never leave this browser." ("On-device by design." is weight 600 in `--color-text`.)
- Right: three ghost buttons, `gap:8px`, each `--font-body` 13px, `padding:8px 14px`, `border:1px solid var(--color-divider)`, transparent background, `--color-neutral-700`, `border-radius: var(--radius-md)`. Hover → `border-color: var(--color-text); color: var(--color-text)`.
  - `Demo: force slouch` / `Demo: force slouch ON` — **prototype affordance only; drop it in production**
  - `Recalibrate`
  - `Start` / `Pause` / `Resume`

#### Popup: the "Stop press" slip

Fires after **5 seconds** of continuous bad posture; dismisses itself the moment posture returns to good.

- `position:fixed; right:32px; bottom:32px; width:322px; z-index:20`.
- `background: var(--color-bg)`, `box-shadow: var(--shadow-lg)`, `border-radius: var(--radius-md)`, `padding:20px 22px 18px`.
- Top edge: a **5px** bar in `var(--state)` (i.e. the bad colour), bled to the card edges via `margin:-20px -22px 15px`, top corners rounded.
- Kicker "STOP PRESS", 11px uppercase `letter-spacing:.14em`, colour `var(--state)`, `margin-bottom:5px`.
- Title: `--font-heading` 600, **27px**, `line-height:1.05`, `margin-bottom:7px`.
- Body: 15px, `--color-neutral-800`, `margin:0 0 14px`.
- Dismiss button: same ghost style as the footer buttons. Label "Give me a minute" — sets a 25-second suppression before the slip can return.
- Entry animation `bs-slip .3s ease both`: `opacity 0 → 1`, `translateY(14px) → 0`, held at `rotate(-.6deg)` (a slip of paper, slightly askew).

## Interactions & behaviour

### Phase machine

`idle → calibrating → running` (with `paused` as a flag on `running`). `Recalibrate` re-enters `calibrating` from any phase.

- **Start** (primary button, or footer `Start`): enter `calibrating`, request the camera, begin a **900ms** countdown from **3**. At 0, enter `running` and reset all session counters.
- **Camera:** `navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 960 } })`, assigned to `video.srcObject`. On rejection set camera state to `denied` — the plate stays dark, the tracking overlay and all logic keep running, and the caption explains why. **Never block the app on camera permission.**
- **Pause:** halts evaluation and clears any open slip; the camera stream stays open. **Resume** continues the same session.
- **Unmount:** clear both intervals and call `stop()` on every media track.

### Posture evaluation loop (prototype simulation — replace with real inference)

Runs on a **500ms** interval. In the prototype `lean` is a random walk; in production it is your landmark-derived forward-head/tilt metric normalised to the same 0–1 scale against the calibrated reference.

```
lean = clamp(lean + (random() - 0.47) * 0.17, -0.25, 1)
with a 3.5% chance per tick of a +0.45 jolt
bad  = lean > 0.42          // the single threshold
```

Per tick: `sessionSec += 0.5`; `goodSec += 0.5` when good; `run` (current good streak) resets to 0 when bad; `best = max(best, run)`; `badRun` accumulates while bad and resets on good; `slouches += 1` on each good→bad transition. Every 4th tick (2s) append a ribbon bar. Show the slip when `badRun >= 5` and none is open; hide it whenever posture is good.

`Upright %` = `round(goodSec / sessionSec * 100)`, defaulting to 100 before any time has elapsed.

Duration format: `>= 60s` → `"{m} min {s}s"`, else `"{s}s"`.

### Copy (exact)

Guidance rotates so the app doesn't nag with one sentence.

**Idle** — verdict `Ready.` / guidance "Start the camera and I will hold you to the posture you calibrate. One line, one colour, no dashboard." / meta "Nothing has been watched yet."

**Calibrating** — `Hold it…` / "Sit the way you want to be reminded of. This becomes the reference." / "Calibrating from your own posture, not an average."

**Paused** — `Paused.` / "The camera is still yours. Nothing is being read." / "Resume whenever you like."

**Upright** — `Upright.` / meta "Held for {duration}." / guidance cycles every ~47 session-seconds through:
1. "Stacked and level. Your neck is doing nothing it will regret."
2. "Shoulders open, chin over the collarbone. Carry on."
3. "That is the reference posture, held."

**Slouching** — `Slouching.` / meta "Out of position for {duration}." / guidance selected by `slouches % 3`:
1. "Your head has drifted forward. Slide back into the chair and let the screen come to you."
2. "You are leaning in. Push the hips back, drop the shoulders, unclench the jaw."
3. "The chin is dipping. Lift the sternum an inch and the rest follows."

**Slip notifications** (`slouches % 3`):
1. "Chin back." / "Ten seconds of forward head. Ease the skull over the shoulders and breathe out."
2. "Shoulders down." / "They have crept toward your ears again. Let them fall on the exhale."
3. "Sit back." / "You have inched to the front of the seat. Find the backrest."

### Motion

| Name | Spec |
| --- | --- |
| State colour change | `transition: color/background .5s ease` on the headline, pictogram, spine and overlay |
| Overlay tracking | `transition: transform .35s ease` on the head ring and shoulder bar |
| Live dot | `@keyframes bs-blink` — opacity 1 → .15 → 1, `1.8s infinite` |
| Slip entry | `@keyframes bs-slip` — `.3s ease both`, see above |
| Footer reveal | `transition: opacity .22s`, `.4 → 1` on hover |
| Button hover | `transition: background .18s` |

Respect `prefers-reduced-motion` in production: keep the colour transitions, drop the blink and the slip's translate.

### Responsive

Desktop-first. Below **1100px** the grid collapses to a single stacked column (video, then verdict). The headline is fluid via `clamp(40px, 5.2vw, 78px)`. No mobile layout is specified.

### Accessibility notes

- Announce phase and posture changes via an `aria-live="polite"` region carrying the verdict + guidance — the colour must not be the only channel. The `traffic` palette in particular fails for red/green colour blindness, which is why the word and the pictogram always change too.
- The pictogram SVG is `aria-hidden`; the headline word carries the meaning.
- Keyboard focus: `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px }` — Broadsheet supplies this; do not override it.
- The hover-revealed footer must also come to full opacity on `:focus-within`, or its controls are unreachable by keyboard. **(Known gap in the prototype — fix it in the implementation.)**

## State management

```
phase:      'idle' | 'calibrating' | 'running'
paused:     boolean
posture:    'good' | 'bad'
lean:       number   // -0.25 … 1, the live posture metric
camera:     'off' | 'on' | 'denied'
calibNum:   3 | 2 | 1
sessionSec: number   // seconds
goodSec:    number
badRun:     number   // seconds in the current bad stretch
run:        number   // seconds in the current good stretch
best:       number
slouches:   number
bars:       Array<{ bad: boolean, h: number }>   // last 72
nudge:      [title, body] | null
demo:       boolean  // prototype only
```

Two timers: the 900ms calibration countdown and the 500ms evaluation tick. `--state`, `--state-deep`, `--pad`, `--gap`, `--grid`, `--tilt`, `--bob` are written to `document.documentElement.style` on every update and on window resize.

No network, no persistence, no data fetching. Everything is in-memory and per-session by design.

## Options (exposed as tweaks in the prototype; make them settings or drop them)

| Option | Values | Effect |
| --- | --- | --- |
| `statusPalette` | `press` (default) / `traffic` | Which pair of colours means good/bad — see below |
| `density` | `roomy` (default) / `compact` | `--pad` 44/28px, `--gap` 44/26px |
| `layout` | `split` (default) / `stacked` | Forces the single-column layout |
| `showGuides` | `true` (default) / `false` | Tracking overlay on the video |

## Design tokens

All from `design/_ds/broadsheet-…/styles.css`. **Do not hard-code these** — read the equivalent tokens in the target codebase.

**Broadsheet base**

| Token | Value |
| --- | --- |
| `--color-bg` | `#f3f2f2` |
| `--color-surface` | `#eae9e9` |
| `--color-text` | `#201e1d` |
| `--color-accent` (cyan) | `#0088b0` |
| `--color-accent-2` (magenta) | `#d6006c` |
| `--color-divider` | `color-mix(in srgb, #201e1d 16%, transparent)` |
| `--color-neutral-300 / 400 / 600 / 700 / 800 / 900` | `#d7d3d3` / `#bab6b6` / `#7d7979` / `#605d5d` / `#444141` / `#2d2b2b` |
| `--color-accent-600 / 700` | `#1186ac` / `#006786` |
| `--font-heading` / `--font-body` | `"Source Serif 4", system-ui, sans-serif` (heading weight 600) |
| `--space-1…8` | 5 / 10 / 15 / 20 / 30 / 40 px |
| `--radius-sm / md / lg` | 1 / 2 / 4 px |
| `--shadow-lg` | `0 12px 32px color-mix(in srgb, #2d2b2b 22%, transparent)` |

Font: **Source Serif 4**, variable, weights 300–700, with true italic. Google Fonts, or self-host.

**State palettes** (the only colours added on top of Broadsheet)

| | good | good deep | bad | bad deep |
| --- | --- | --- | --- | --- |
| `press` (default — the system's own two spot inks) | `#0088b0` | `#006786` | `#d6006c` | `#aa0b56` |
| `traffic` (literal green/red) | `#0f7a4a` | `#0b5c38` | `#c8102e` | `#8f0b20` |

Idle/uncalibrated state colour: `#7d7979` (`--color-neutral-600`), deep `#444141`.

**Local page tokens**

`--pad` 44/28px · `--gap` 44/26px · `--grid` (see Main grid) · `--tilt` deg · `--bob` px · `--state`, `--state-deep`.

## Assets

None. No images, no icon files. Everything is type, CSS and two inline SVG paths (the posture pictogram). If you add icons elsewhere, Broadsheet specifies **Phosphor, duotone weight**.

`reference/current-ui-before.png` is a screenshot of the existing UI, for before/after only.

## Files

```
design_handoff_sit_up_please/
├── README.md                                  ← this document
├── design/
│   ├── Sit Up Please.dc.html                  ← the prototype (template + logic in one file)
│   ├── support.js                             ← design-tool runtime; DO NOT PORT
│   └── _ds/broadsheet-8d6e7696-…/
│       ├── styles.css                         ← the token sheet + component layer
│       ├── _ds_bundle.js
│       └── readme.md                          ← the Broadsheet design system guide
└── reference/
    └── current-ui-before.png                  ← the UI being replaced
```

In `Sit Up Please.dc.html`: the markup lives between `<x-dc>` and the `<script data-dc-script>` tag; the state machine, timing and copy live in the `class Component extends DCLogic` block below it. Read the logic class as a React class component — `renderVals()` is its render-prep step, and every `{{ name }}` in the markup is one of the keys it returns.

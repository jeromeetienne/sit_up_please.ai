# Directory Context: `/web/css`

## Purpose
Holds the one stylesheet of the application, which is Bootstrap and almost nothing else.

## Key Exports & Entry Points
- `style.scss`: imports the whole of Bootstrap and adds the three rules Bootstrap has no class for. It is imported from `../js/main.ts`.

## Rules
- Nothing is added here that a Bootstrap class already does. A rule belongs here only when no Bootstrap class, component or utility can do the job, and the rule says in a comment why that is.
- No design tokens, no colour palette, no spacing scale and no typeface of our own. The appearance is Bootstrap's own, so that it stays possible to read the page as plain Bootstrap and to change it by swapping classes in `../index.html`.
- The light theme and the dark theme are Bootstrap's own, switched by the `data-bs-theme` attribute on the root element.
- Colour that carries meaning is written with the Bootstrap contextual classes — `success` for a held posture, `danger` for a lost one, `secondary` for an unknown one — never as a colour value.

## Background
- Adopting Bootstrap comes from [issue #14](https://github.com/jeromeetienne/sit_up_please.ai/issues/14). The hand-written Broadsheet design that came before it, and the design tokens it was built from, were removed at the same time.

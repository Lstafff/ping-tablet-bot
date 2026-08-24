# Frontend layout and color tokens

This inventory keeps layout decisions intentional while the monolithic
stylesheet is split. A repeated number becomes a token only when its uses share
one reason to change.

## Canonical spacing scale

New or migrated layout spacing must use the following scale:

`2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128 px`

The CSS names include the value, from `--space-2` through `--space-128`.
Semantic aliases may point to the scale, for example a feature-local
`--opponent-header-gap`. Do not replace component sizes, font sizes, animation
travel or optical coordinates with spacing tokens merely because the numbers
match.

## Canonical radius scale

New or migrated radii must use:

`2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64 px`

Use `--radius-full` for pills, `50%` for circles and a derived half-size radius
when a control must remain circular as its size changes.

## Documented geometry exceptions

| Exception | Why it is not a spacing/radius token |
| --- | --- |
| Collapsing opponent header coordinates and travel | Feature-local named variables encode the measured expanded/compact geometry: avatar top/half-size, island neck, compact text clearance and summary boundary. |
| Action-menu transform origin and optical offsets | They preserve continuity with the physical `+` trigger. |
| Header, history badge and FNTR badge optical offsets | Negative offsets align icons, sticky backdrops and badges to their visual boundaries; canonical values use the scale, while the measured `-5px` history and `-7px` FNTR offsets are named feature-local variables. |
| Current 26 px page gutter | It is retained during the visual-parity pass; replacing it with 24 px requires a separate width/safe-area comparison. |
| 112 px content-bottom clearance | It is the composed toolbar, safe touch clearance and optical breathing room, not a standalone gap. |
| 99 px floating-action bottom anchor | It aligns the action with the persistent tabbar geometry. |
| 14 px overlay inset | On the 430 px design canvas it preserves the established 402 px sheet/snackbar width. |
| Safe-area insets | Host values are supplied by Telegram/the browser and cannot be quantized. |
| Numeric keypad cell size and avatar/control dimensions | They are component dimensions, not whitespace. |
| One-pixel borders and SVG/filter parameters | They are rendering parameters. Goo remains blur `8` and alpha matrix gain `18`, bias `-7`. |

Any non-scale spacing or radius left after migration must be listed here with a
component-specific reason; visual similarity alone is not a reason.

### Literal exception inventory

| File and line | Value | Why it is outside the scale | Why it remains |
| --- | --- | --- | --- |
| `web/src/tokens.css:166` | `26px` | Established safe-area page gutter. | A 24/32 px replacement needs a separate 320–430 px visual comparison; this refactor preserves current composition. |
| `web/src/tokens.css:167` | `112px` | Composed content clearance, not one gap. | Includes toolbar height, touch clearance and bottom breathing room. |
| `web/src/tokens.css:168` | `99px` | Floating control anchor, not content spacing. | Aligns the `+` control to the persistent tabbar surface. |
| `web/src/tokens.css:169` | `14px` | Overlay geometry on the 430 px canvas. | Produces the established 402 px modal/snackbar width. |
| `web/src/components/ActionSheet.css:24,35` | `38px` | Transform-origin coordinate. | Aligns the dropdown morph with the physical `+` trigger; it is not layout whitespace. |
| `web/src/features/history/history.css:89` | `-5px` | Badge optical correction. | A scale value shifts the crown/loss badge visibly off the avatar edge; the exception is feature-local and named. |
| `web/src/features/profile/profile.css:33` | `-7px` | FNTR badge optical correction. | Keeps the enlarged tilted badge centered on the avatar edge; the exception is feature-local and named. |
| `web/src/features/opponent/opponent.css:2-8` | `54, 38, -91, 52, 1, 25, 226px` | Expanded/compact header coordinates. | These values define measured goo/avatar half-size, compact text clearance and Activity snap geometry, not reusable spacing. |

## Color semantics

| Group | Classification | Rule |
| --- | --- | --- |
| Canvas/surface/text/border | KEEP | Theme semantics; do not rename for numerical similarity. |
| Accent | KEEP | User/product accent only; never substitute for status colors. |
| Success/danger/warning/activity | KEEP | Status and data semantics are independent of accent. |
| Dark tray palette | KEEP | Contextual sheet palette; do not merge into the light surface group. |
| FNTR badge | ADAPT | Use an FNTR-named semantic token instead of the obsolete avatar-blue name. |
| Drawer overlay | ADAPT | Replace the remaining direct `rgba(0,0,0,.46)` with a semantic overlay token at the same value. |
| Declaration-only tokens | REPLACE after repository-wide search | Remove unused tokens rather than keeping a speculative palette. |

Direct literal colors are allowed only inside token declarations, SVG/filter
implementation details or a documented browser fallback that cannot consume a
CSS variable.

## Migration result

The active styles use the canonical spacing/radius scale for layout values.
The exceptions above are named rather than left as unexplained literals.
Feature and shared-component styles are colocated with their owners; the root
stylesheet now contains only reset, shell and genuinely shared rules.

| Old declaration | Current declaration | Reason |
| --- | --- | --- |
| `--color-avatar-blue` | `--color-fntr-badge` | The color belongs to the FNTR status, not to avatars generally. |
| Direct drawer `rgba(0, 0, 0, .46)` | `--color-modal-backdrop` | Preserve exact density while naming the modal role. |
| Repeated `999px` pills | `--radius-full` | One semantic pill radius. |
| Repeated canonical raw radii and layout gaps | `--radius-*` / `--space-*` | One scale without changing component dimensions. |

Declaration-only colors removed after a repository-wide consumer search:
`--color-accent-shadow`, `--color-danger-soft`, `--color-dark-surface`,
`--color-dark-surface-raised`, `--color-dark-error-surface`,
`--color-dark-error-text`, `--color-avatar-purple`, `--color-glass-shadow`.
The unused `--ease-standard` token was removed for the same reason.
Unused `--line-height-relaxed`, `--letter-spacing-normal` and `--ease-drawer`
declarations were also removed rather than reserved speculatively.

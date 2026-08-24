# Frontend motion language

This is the single current motion contract for the Mini App. Older animation
plans document exploration; where they conflict, this document and the current
working UI win.

## Principles

1. Preserve spatial continuity. When an element represents the same object in
   two states, morph that surface or identity instead of introducing a second
   element from a viewport edge.
2. Animate one causal surface. Children already inside a menu or card do not
   fly in independently.
3. Use transform and opacity for motion; avoid layout properties and
   `transition: all`.
4. Frequent actions are quick and interruptible. Springs must settle without a
   visible tail or rebound against hard edges.
5. Reduced motion removes position/scale travel while retaining immediate
   color or opacity feedback and a comprehensible final state.
6. Motion never hides pending, error, focus or disabled state.
7. Existing tokens and `motion/react` are the engine. Do not add a parallel
   animation library.

## Settled interactions

| Interaction | Current contract | Classification |
| --- | --- | --- |
| `+` button | Appears by scaling `.5 -> 1` from its own center; no translation or rotation. | KEEP |
| `+` menu | Dropdown-menu morph on the surface from the trigger origin; open 250 ms, close 150 ms; cards remain static inside. Detail states swap as one 8 px / 3 px blur layer over 250 ms rather than animating their children separately. | KEEP |
| Main tabbar | One persistent shared surface; indicator changes without text selection, overshoot or edge rebound. | KEEP |
| Header text | Whole text states swap upward/downward with one coordinated timeline. | KEEP |
| Numbers | One shared Number Pop-in implementation across Home, Profile and Opponent; no screen-specific delay. | KEEP |
| Opponent identity | Avatar, name and score retain one unique shared identity from the source row into the opponent hero, including History rows. | KEEP |
| Opponent collapse | The avatar shrinks and travels above the physical viewport edge. It never joins a simulated device cutout and is absent from the compact header. Name and score settle on two centered lines while the summary leaves with the hero. | KEEP |
| Opponent snap | A partial deliberate collapse may spring to the Activity boundary; reduced motion disables the automatic spatial jump. | ADAPT |
| Page back | The whole nested page exits right over 250 ms with the standard smooth-out curve; the tabbar remains fixed. | KEEP, device feel-check required |
| Score drawer gesture | The whole Vaul surface is draggable; the visible handle remains a cue and a 44 px touch target, not the only gesture target. | KEEP |
| Modal close | Avatar and opponent-edit dialogs reverse their 250 ms open transition over 150 ms instead of disappearing immediately. | KEEP |
| Initial loading | Structural skeleton uses one opacity-only pulse, then content reveal; reduced motion removes the pulse/translation. | KEEP |
| Decorative hearts/rings | Not part of the product motion language. | REPLACE / forbidden |

## Audit: before, after, why

| Area | Before refactor | Required after refactor | Why |
| --- | --- | --- | --- |
| Vaul score drawer with reduced motion | Vaul still translates the sheet and scales the background. | Disable background scaling and full-height positional travel when reduced motion is requested. | Avoid vestibular movement while retaining a clear modal state. |
| Opponent auto-snap with reduced motion | Scroll can jump from a partial state to the compact boundary. | Do not trigger automatic scrolling; resolve state without position transforms. | Reduced motion is not merely shorter motion. |
| Press feedback with reduced motion | Global transform removal can leave no feedback. | Use short opacity/color feedback without scale/position change. | Preserve system response. |
| History-to-opponent transition | History rows did not provide shared identity IDs. | Each match row now passes a stable per-entry identity into the opponent hero. | One object no longer materializes differently by entry point, while duplicate opponents do not collide. |
| Segmented tabs | Visual indicator exists, keyboard contract is incomplete. | Roving focus, arrow/Home/End keys and linked tabpanels without changing indicator timing. | Motion cannot replace semantic state. |

## Verification matrix

- Automated: no `transition: all`; no `scale(0)`; unit state math; reduced-motion
  E2E; start/mid/end geometry for critical trajectories.
- Browser: Chromium mobile viewports including narrow width and safe-area cases.
- Manual: keyboard focus and interruption during animation.
- Device: Telegram iOS and Android WebViews remain required. Local Playwright
  emulation is not evidence of native WebView rendering or motion feel.

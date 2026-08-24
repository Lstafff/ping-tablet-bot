# Frontend architecture audit

Current-state audit for the Telegram Mini App frontend. The working tree is the
source of truth; this document describes behavior that must survive the
behavior-preserving refactor.

## Target boundary

`web/src/main.tsx` remains the application orchestration boundary. It owns API
requests, mutations, navigation, scroll restoration, preview mode and
cross-screen state. Screen markup and feature-local interaction state live in
feature folders. Shared components are extracted only when they already have
more than one real consumer.

| Area | Source before refactor | Classification | Current boundary |
| --- | --- | --- | --- |
| App shell and orchestration | `main.tsx` | KEEP | `main.tsx` |
| Browser preview transport and fixtures | `main.tsx` | ADAPT | `lib/preview-api.ts` |
| Shared page header and title swap | `main.tsx` | ADAPT | `components/PageHeader.tsx` |
| Initial loading and error presentation | `main.tsx` | ADAPT | `components/AppLoading.tsx` |
| Home | `main.tsx` | ADAPT | `features/home/` |
| History | `main.tsx` | ADAPT | `features/history/` |
| Profile and levels | `main.tsx` | ADAPT | `features/profile/` |
| Score drawer | `main.tsx` | ADAPT | `features/score/` |
| `+` action menu and invite states | `main.tsx` | ADAPT | `features/actions/` |
| Opponent view | `features/opponent/` | KEEP | `features/opponent/` |
| Opponent edit sheets | `main.tsx` | ADAPT | `features/opponent/` |
| Dead route-only score/edit/confirm branches | `main.tsx` | REPLACE | Remove only after reachability and BackButton checks |

## Shared and feature-specific components

| Component family | Classification | Reason |
| --- | --- | --- |
| `ProfileAvatarContent`, `ScorePair`, `EloDeltaBadge`, `AnimatedNumber`, `SegmentedControl`, `ProgressiveLoadTrigger` | KEEP | They already have multiple independent consumers and one reason to change. |
| `BottomNavigation` and `SegmentedControl` | KEEP separate | Both have indicators, but navigation owns shell routing and shared action morph while segmented controls own tab/form semantics. |
| Home opponent row, action-picker row and opponent hero | KEEP separate | They share identity primitives but have different semantics, geometry and motion roles. |
| Action-menu and opponent-edit surfaces | KEEP separate | They reuse the same CSS surface and modal-focus contract, but the `+` menu owns an origin-aware dropdown morph while opponent edit owns a local state transition. A shared animated shell would couple two different reasons to change. |
| Pair score editor | CONSOLIDATE | Games and points editors duplicate the same two-side selector, keypad and save structure. |
| Opponent header, heatmap and tables | KEEP together | They form one cohesive opponent presentation flow and share scroll/tab state. |

No global store, router, UI framework or universal card/button abstraction is
introduced by this refactor.

## Implemented boundaries

| Concern | Current location | Result |
| --- | --- | --- |
| App state, requests, mutations and navigation | `web/src/main.tsx` | Orchestration stays central; screen markup is no longer implemented here. |
| Home | `web/src/features/home/` | `HomeScreen` and its styles own the matches presentation. |
| History | `web/src/features/history/` | `HistoryScreen`, grouping, sticky sections and row motion are feature-local. |
| Profile and Levels | `web/src/features/profile/` | Both screens share profile-only level/FNTR definitions without leaking them into global components. |
| Opponent | `web/src/features/opponent/` | Sticky header, activity, tabs, tables and edit flow remain one cohesive feature boundary. |
| Score entry | `web/src/features/score/` | Vaul drawer and validation guidance are isolated while score ownership remains in `App`. |
| Add/invite flow | `web/src/features/actions/` | Trigger, dropdown morph, picker and invite presentation are isolated. |
| Shared presentation | `web/src/components/` | Header, skeleton, number, avatar, score, segmented control, loading trigger, snackbar and bottom navigation have colocated styles; `ActionSheet.css` is the common surface contract for its two existing consumers. |
| Browser preview transport | `web/src/lib/preview-api.ts` | Preview fixtures no longer obscure application composition. |
| Modal keyboard lifecycle | `web/src/lib/dialog.ts` | Action sheets and avatar picker share Escape, focus trap and focus restoration only. |

The repeated games/points keypad is now one typed `PairKeypadEditor`. The
segmented control supports both tab and two-way choice semantics without
duplicating its moving indicator. The action-menu and opponent-edit surfaces
remain distinct because combining their different transition contracts would
create a universal UI layer rather than a stable shared component.

## Screen behavior that must remain stable

- Home opens an opponent and returns to Home.
- History preserves sort, progressive loading and scroll position; an opponent
  opened from History returns to History.
- Profile edit, avatar edit and Levels/FNTR flows retain their current form and
  BackButton behavior.
- Score and edit flows stay controlled drawers/sheets; API ownership stays in
  `App`.
- The tabbar stays outside nested page exit animation and never flies in from
  the viewport edge.
- Opponent identity remains visible immediately while secondary statistics load.
- Empty, pending, retry, disabled and success states remain distinguishable.

## Confirmed risks and targeted coverage

| Priority | Risk | Evidence needed |
| --- | --- | --- |
| P0 | New extracted files are currently untracked while the refactor remains intentionally uncommitted. | Explicit path review before any future commit; never use a partial broad commit that omits feature/shared files. |
| P0 | Delayed/failed initial and opponent requests are not represented by synchronous preview fixtures. | Deterministic delayed and failed request tests with local retry. |
| P0 | Local Playwright mobile projects are Chromium emulation, not Telegram iOS/Android WebViews. | Real-device WebView pass before declaring device support verified. |
| P1 | Progressive loading lacks stale/out-of-order response coverage in each flow. | Controlled request harness covering one in-flight request and stale response rejection. |
| P1 | Current animation checks often inspect one frame instead of a trajectory. | Poll start/mid/end geometry for menu, opponent collapse and page back. |
| P2 | Critical geometry is concentrated at 390 px. | Small viewport and safe-area matrix for menu and opponent states. |

Local lint, unit, build and Chromium E2E evidence cannot prove native emoji,
safe-area or gesture rendering in Telegram iOS/Android WebViews. Those device
checks remain a release verification step, not unfinished frontend architecture.

# Phase 8: On-Device UI Polish & Accessibility - Context

**Gathered:** 2026-07-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the v1.0 audit's UI-polish and accessibility gaps on **real phone hardware**: every on-screen label renders legibly, and every bottom sheet / modal dialog is keyboard- and focus-accessible. Delivers **POLISH-01, POLISH-02, A11Y-01, A11Y-02, A11Y-03**. **UI hint:** yes.

**In scope:**
- Orb/center-node song-name legibility on small screens — verify `fitOrbLabel`/`ORB_LABEL` on-device against the real ~264-song catalog and fix residual (POLISH-01).
- Formally verify the Phase-6 D-20 FabMenu (speed-dial) and D-22 once-per-version InstallBanner match their originating todos, then move those todos to resolved (POLISH-02).
- Escape-to-dismiss + focus management (trap while open, restore to trigger on close) for all sheets/dialogs (A11Y-01).
- NodeSheet and Explore FilterFab both usable while a constellation node is focused — no occlusion (A11Y-02).
- Viewport resize keeps the camera framed on the focused node — no snap-off (A11Y-03).
- **Folded from a pending todo:** centralized z-index scale in config (the layering half of the bottom-sheets todo).

**Not in scope (deferred):**
- Slide-up/down sheet animation + scrim cross-fade (the animation half of the bottom-sheets todo) — its own polish pass.
- Any change to prediction scoring, the matrix artifact, Show/Explore logic, or the dex.
- The other three matched todos (edge-flow particles, app-wide date format, share-card totals) — separate scope.

</domain>

<decisions>
## Implementation Decisions

### Sheet Accessibility Architecture (A11Y-01)
- **D-01:** **Build ONE shared sheet/modal primitive + a `useFocusTrap` hook** and migrate all 7 sheets onto it. No sheet currently shares code — each hand-rolls the same `role="dialog"` + backdrop idiom, and none handle Escape or focus at all. The a11y logic must live in one place (single-config/DRY ethos, CLAUDE.md). This also retires the duplicated shell idiom the scout found (`rounded-t-2xl border-t border-hairline bg-elevated` + safe-area padding copied inline in every sheet).
- **D-02:** **NodeSheet stays non-modal — different treatment from the 6 true modals.** Per Phase 7 D-14, NodeSheet has no scrim/close button and the graph stays live/interactive above it. It gets **Escape-to-dismiss + focus-restore-to-trigger, but NO focus-trap and NO scrim** — focus can still reach the graph and FilterFab. The 6 true modals — **AppMenu, TrailNodeSheet, EndShowDialog, ShareCardSheet, CompareView, and the "Whose dex is this?" prompt** — get the full trap + restore + Escape treatment.
- **Note for planning:** `WhyDetail.tsx` (opened from PredictionOrb's "why") is the same hand-rolled sheet idiom and a strong candidate to include in the migration; confirm whether it counts as one of the audited dialogs. CompareView is a full-screen overlay (header X, no backdrop), not a bottom sheet — trap/restore still apply, but its dismiss affordances differ.

### NodeSheet ↔ FilterFab Coexistence (A11Y-02)
- **D-03:** **Lift the FilterFab above the NodeSheet's top edge when a node is focused** (and place it above the sheet in the new z-scale). The FAB animates up to rest just above the sheet's top edge — fully visible and tappable, no overlap with sheet content — and returns to its resting position when the sheet closes. Rejected: raise-z-only (overlaps sheet's bottom-right corner) and hide-while-focused (fails A11Y-02's "both remain usable" wording).
- **Context:** Today both sit at `z-30`; the FAB rests ~72px off the bottom, inside the sheet's 40% peek band, and the sheet paints over it. The camera already lifts the *focused node* into the upper 60% (`FOCUS_TARGET_TOP_FRACTION: 0.3`) to clear the sheet, but nothing currently moves the FAB.

### Layering Scope (folded todo)
- **D-04:** **Fold the centralized z-index scale into this phase; DEFER the sheet slide/scrim animation.** The z-scale is needed to fix A11Y-02 and the general FAB-over-sheet layering bug cleanly, and belongs in the single config file (kills the scattered `z-20`/`z-30`/`z-40` magic numbers). Define named tiers so every FAB sits strictly below the sheet tier by default (the focused-node FilterFab lift in D-03 is the deliberate exception). Migrate ALL current `z-*` usages onto the tiers so the fix doesn't just relocate the collision. The animation half stays a deferred todo (keeps this pre-show phase tight/low-risk).

### Orb Label Legibility (POLISH-01)
- **D-05:** **Bar = every REAL song name renders fully on a small phone; verify + tune, keep ellipsis as an unreachable safety net.** Verify all ~264 catalog names on-device, then tune `fitOrbLabel`/`ORB_LABEL` constants (lower the font floor and/or allow the needed line count) so no real name ellipsizes. The ellipsis last-line fallback stays only as a theoretical guard that never fires for real data. Document the chosen minimum-legibility font floor. Applies to both the orb variant (`PredictionOrb` → `orbLabelFit.ts`) and the `_CENTER` variant (`CenterNode`).
- **Caveat for planning:** `orbLabelFit` is a no-DOM heuristic (`CHAR_WIDTH_FACTOR = 0.52` char-advance approximation). On-device the estimate may drift from real rendered widths — verification must be against actual rendered orbs, not the heuristic's self-report; retune the factor/floors as needed.

### Claude's Discretion
- **POLISH-02 (verification + bookkeeping):** Verify the D-20 FabMenu speed-dial and D-22 once-per-version InstallBanner behave as their originating todos intended (both landed in Phase 6), then formally move those todos to resolved. Largely a confirm-and-file task, not a design decision.
- **A11Y-03 (resize reframe):** The focus-camera effect already lists `size.height` in its deps (`ConstellationCanvas.tsx:315-334`), so a resize *does* re-fire `fg.zoom()` + `fg.centerAt()` to re-frame the focused node. Treat as verify-on-device + fix any snap-off edge case (e.g. keyboard show/hide, orientation change), not a from-scratch build.
- Exact z-tier names/values, the shared-primitive API shape, the focus-trap implementation (roving vs sentinel), the FAB lift distance/animation, and final orb-fit constants — planner/research discretion within the decisions above; all tunables land in the single config file.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` — Phase 8 section: goal, 5 success criteria, requirement IDs (POLISH-01, POLISH-02, A11Y-01, A11Y-02, A11Y-03), `Depends on: v1.0 MVP (Phases 1–7)`, `UI hint: yes`.
- `.planning/REQUIREMENTS.md` §14–15 (POLISH-01/02), §19–21 (A11Y-01/02/03) — authoritative requirement text; the traceability table pins all five to Phase 8.
- `.planning/PROJECT.md` / `CLAUDE.md` — single-config-file rule ("no scattered magic numbers"), dark-theme + 44px tap-target + `prefers-reduced-motion`→instant conventions.

### Folded / reviewed todo
- `.planning/todos/pending/2026-07-17-bottom-sheets-smooth-up-down-animation-always-on-top-layerin.md` — the z-index-scale half is FOLDED (D-04); the slide/scrim animation half is DEFERRED. Contains the full current z-index landscape grep and the affected-file list.

### Prior-phase decisions this phase extends
- `.planning/phases/07-explore-mode-constellation/07-CONTEXT.md` — D-14 (NodeSheet is a partial, non-modal, scrim-less sheet so the focused node/neighborhood stay visible — the reason D-02 treats it specially); D-09 (FilterFab idiom); camera/focus config (`FOCUS_TARGET_TOP_FRACTION`, `SHEET_PEEK_FRACTION`).
- `.planning/phases/06-pok-dex-history-stats/06-02-PLAN.md` — D-20 FabMenu and D-22 InstallBanner-once-per-version originating plan (POLISH-02 verifies against this); D-21 `fitOrbLabel` origin (POLISH-01 verifies/tunes this).
- `.planning/phases/03-app-shell-pwa-foundation/03-UI-SPEC.md` — inherited design tokens (spacing, 44px tap floor, dark theme, lucide-react); extend, don't re-derive.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`packages/app/src/config.ts`** — the single app-side config source. `ui:` section (~:178) already holds FAB geometry (`FAB_DIAMETER: 56`, `FAB_ACTION_HEIGHT: 48`); `explore` holds sheet/camera constants (`SHEET_PEEK_FRACTION: 0.4`, `FOCUS_*`); `show:` holds orb-label constants (`ORB_LABEL_BASE_FONT_PX: 13`, `_MAX_LINES: 3`, `_MIN_FONT_PX: 11`, plus `_CENTER` variants). **No z-index or sheet-animation section exists yet** — the new z-scale lands here.
- **`packages/app/src/show/orbLabelFit.ts`** — pure `fitOrbLabel(name, diameterPx, opts)`; two-pass wrap+scale heuristic, ellipsis fallback at the floor. Consumed by `PredictionOrb.tsx` (:63) and `CenterNode.tsx`. Fixture tests at `packages/app/test/orbLabelFit.test.ts`.

### Established Patterns
- **Hand-rolled sheet idiom (to be replaced by the D-01 primitive):** every sheet is a full-screen `role="dialog"` div with a `bg-black/50` backdrop `onClick`-to-close and an inner `stopPropagation` div. No `onKeyDown`, no `useEffect` keydown listener, no `autoFocus`, no focus-return anywhere in `packages/app/src`. There is NO existing focus-trap utility, `useFocusTrap`, Escape handler, or `inert` usage — all net-new.
- **Sheet inventory + current state** (all under `packages/app/src`):
  - `explore/NodeSheet.tsx:130` — `role="dialog"` `aria-modal={false}`; non-modal, no scrim, no close button; swipe-down dismiss only (local `SNAP_MS = 200`). → D-02 special case.
  - `components/AppMenu.tsx:40` — `aria-modal="true"`; backdrop + X button; `z-20`.
  - `show/TrailNodeSheet.tsx:82` — `aria-modal="true"`; backdrop; `z-30`.
  - `show/EndShowDialog.tsx:90` — `aria-modal="true"`; backdrop + cancel; `z-30`.
  - `dex/ShareCardSheet.tsx:83` — `aria-modal="true"`; backdrop + Close; `z-40`.
  - `dex/CompareView.tsx:95` — `aria-modal="true"`; full-screen overlay, header X, no backdrop; `z-40`.
  - "Whose dex is this?" prompt — inline in `settings/SettingsView.tsx:269`; `aria-modal="true"`; backdrop + buttons; input has no `autoFocus`; `z-40`.
  - `show/WhyDetail.tsx:37` — same idiom (`z-20`); confirm inclusion in the migration.
- **Z-index landscape today** (all raw Tailwind classes, no central scale): sheets `z-20`/`z-30`/`z-40`; FabMenu scrim `z-20` + menu `z-30`; `ExploreFilterFab.tsx:56` `z-30`; UpdateToast/InstallBanner `z-10`. Collisions confirmed (FAB at `z-30` ≥ sheets at `z-20`/`z-30`).

### Integration Points
- **Explore focus state:** `explore/ExploreView.tsx:41` (`focusId` useState); `handleFocus` (:175) sets focus + collapses the filter panel; passed to `ConstellationCanvas` `onNodeClick`/`onBackgroundClick`. The D-03 FAB lift keys off this focus state.
- **FilterFab:** `explore/ExploreFilterFab.tsx:56` — fixed bottom-right, `z-30`, `bottom: calc(env(safe-area-inset-bottom) + 64px + 8px)`, 56px circle. Its resting position is the "return to" state after D-03's lift.
- **Resize/reframe:** `ConstellationCanvas.tsx:192` `ResizeObserver` → `size`; focus-camera effect :315 re-frames because `size.height` is a dep (A11Y-03 is mostly wired). NodeSheet has its own independent resize listener (:84) for peek height.

</code_context>

<specifics>
## Specific Ideas

- **"Every real name, in full, on a small phone"** — POLISH-01's bar is the actual 264-song catalog rendered on-device, not the heuristic's self-estimate. Verify against real rendered orbs and retune (D-05).
- **NodeSheet must stay a live window on the graph** — its non-modal nature (no scrim, graph interactive above it) is a deliberate Phase-7 design choice, not an oversight; a11y adds Escape + focus-restore *without* making it modal (D-02).
- **One z-scale, one sheet primitive** — the polish here is a small design-system pass (centralize layering + factor the sheet shell), matching the project's single-source-of-truth ethos, not per-screen patches (D-01, D-04).

</specifics>

<deferred>
## Deferred Ideas

- **Sheet slide-up/down animation + scrim cross-fade** — the animation half of the bottom-sheets todo; deferred to its own polish pass to keep Phase 8 (pre-show) tight. The z-scale half is folded in (D-04). Todo file stays pending, annotated.

### Reviewed Todos (not folded)
- **GizzVerse — animate directional flow along constellation edges** (`.planning/todos/pending/2026-07-17-gizzverse-animate-directional-flow-particles-along-constella.md`) — visual enhancement, not polish/a11y; out of Phase 8 scope.
- **Readable full-date format "Mon D, YYYY" app-wide** (`.planning/todos/pending/2026-07-17-readable-full-date-format-mon-d-yyyy-app-wide.md`) — date-formatting change, distinct from POLISH/A11Y; out of scope.
- **Final show share card uses GizzDex totals** (`.planning/todos/pending/2026-07-18-final-show-share-card-uses-gizzdex-totals.md`) — share-card data/logic, not this phase; out of scope.

</deferred>

---

*Phase: 8-On-Device UI Polish & Accessibility*
*Context gathered: 2026-07-18*

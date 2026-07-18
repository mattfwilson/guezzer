---
phase: 08-on-device-ui-polish-accessibility
verified: 2026-07-18T08:57:08Z
status: passed
score: 5/5 must-haves verified in code (final confirmation deferred to on-device pass)
overrides_applied: 0
human_verification:
  - test: "Orb-label legibility on the physical iPhone via #/dev/orb-fit over the cloudflared HTTPS UAT tunnel"
    expected: "All 264 real @matrix song names render fully — no truncation/overflow/oversizing — and the harness reports ZERO overflow offenders (esp. the 44-char outlier '(You Gotta) Fight for Your Right (To Party!)' and 'Deserted Dunes Welcome Weary Feet')"
    why_human: "The no-DOM heuristic drifts optimistic; only real canvas/DOM metrics on the target device confirm POLISH-01. The automated catalog test locks the heuristic in principle but cannot measure real font rendering."
  - test: "WR-02 — inert propagation through display:contents on iOS Safari with VoiceOver"
    expected: "With a modal <Sheet> open, VoiceOver cannot reach any background control (swipe past the last in-sheet element and confirm focus stays inside the sheet)"
    why_human: "inert on a display:contents element (#app-content has no box) has historically inconsistent descendant propagation across engines; jsdom cannot verify AT-tree suppression. If the background remains reachable, the documented fallback is to move id/inert onto AppShell's root flex box."
  - test: "A11Y-01 real-device dismiss/trap/restore on the 7 audited surfaces (VoiceOver + external keyboard)"
    expected: "Each of NodeSheet, AppMenu, TrailNodeSheet, EndShowDialog, ShareCardSheet, 'Whose dex is this?' prompt, CompareView: Escape dismisses; a modal traps the AT virtual cursor + Tab wraps; focus restores to the trigger on close; NodeSheet stays non-modal (graph reachable)"
    why_human: "jsdom asserts only handler-level behavior; real Tab-order movement and AT virtual-cursor trapping need user-event/VoiceOver on hardware (the plans deferred this to the end-of-phase AT sweep)."
  - test: "A11Y-02 FilterFab no-occlusion on a real phone"
    expected: "Focus a constellation node — the FilterFab rests ~12px above the NodeSheet peek top edge, fully visible and tappable, no overlap with sheet content; it returns to bottom-right when the sheet closes"
    why_human: "Pixel-level occlusion and tap reachability depend on the real visible-viewport height (visualViewport) and safe-area insets, which jsdom does not model."
  - test: "A11Y-03 resize-keeps-camera-framed on a real phone"
    expected: "Focus a node, then rotate the device and toggle the on-screen keyboard — the camera stays framed on that node with no snap-off"
    why_human: "Requires real visualViewport resize/keyboard events on hardware; the automated test only asserts fg.zoom/fg.centerAt re-fire when the shared height changes."
notes_out_of_scope:
  - "WR-03 (WARNING, deferred): full-screen route-overlays outside the audited-7 (SearchSheet, AlbumDetail, ArchiveBrowser, SetlistView, RecapView, CometTrail FullSetlistSheet) still declare aria-modal=\"true\" without a focus trap, Escape, or focus restore. They were z-migrated only (plan 05), not sheet-migrated. This is a known A11Y-01 consistency gap on surfaces outside criterion-3 scope — a false-modal promise to AT, tracked for a follow-up pass. Does not block the phase goal, which scopes criterion 3 to the 7 named surfaces."
  - "IN-02 (info): one raw z-10 Tailwind literal survives in the throwaway dev harness OrbFitHarness.tsx:108 (#/dev/orb-fit). Dev-only, slated for post-phase removal; does not affect the production tier system."
---

# Phase 8: On-Device UI Polish & Accessibility — Verification Report

**Phase Goal:** Every on-screen label is legible and every sheet/dialog is keyboard- and focus-accessible on real phone hardware — closing the v1.0 audit's UI-polish and accessibility gaps.
**Verified:** 2026-07-18T08:57:08Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (Success Criterion) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | POLISH-01 — every prediction-orb + center-node song name renders fully, no truncation/overflow/oversizing | ✓ VERIFIED (code) / device pending | `config.show.ORB_LABEL_MAX_LINES: 4`, `ORB_LABEL_MIN_FONT_PX: 10` (documented 10px@600 floor), `ORB_LABEL_MAX_LINES_CENTER: 4`; `orbLabelFit.ts CHAR_WIDTH_FACTOR = 0.55` (conservative vs old 0.52); `orbLabelFit.catalog.test.ts` passes — zero ellipsis over all 264 real @matrix names at orb 64px + center 92px. Dev harness `OrbFitHarness` mounted at `#/dev/orb-fit`. Final real-render confirmation deferred to device. |
| 2 | POLISH-02 — D-20 FabMenu speed-dial + D-22 InstallBanner behave per originating todos, todos moved to resolved | ✓ VERIFIED | `fabMenu.test.tsx` + `installBannerVersion.test.tsx` pass; `STATE.md` Deferred Items rows both `resolved` (2026-07-18, POLISH-02) — lines 182 & 184; originating todo files in `todos/completed/`. |
| 3 | A11Y-01 — the 7 audited sheets/dialogs dismiss with Escape, trap focus, restore to trigger | ✓ VERIFIED (code) / AT device pending | 6 modals wrap the shared `<Sheet modal>` (`AppMenu`, `EndShowDialog`, `TrailNodeSheet`, `WhyDetail`, `ShareCardSheet`, `CompareView` fullscreen, SettingsView 'Whose dex?' with `initialFocusRef`) → `useFocusTrap` (init-focus + Tab-wrap + inert + restore) + `useDialogDismiss` (LIFO Escape). NodeSheet is deliberately non-modal (`aria-modal={false}`) with Escape+restore only (design requirement of criterion 4). All 10 phase test files pass. Real AT trap/Tab-wrap + WR-02 inert-on-display:contents deferred to device. |
| 4 | A11Y-02 — with a node focused, NodeSheet + Explore FilterFab both usable, no occlusion | ✓ VERIFIED (code) / device pending | `ExploreFilterFab` has `lifted` prop → `translateY(-liftPx)` computed from shared `useVisibleViewportHeight` + `FAB_SHEET_GAP_PX`, `zIndex: lifted ? z.focusedFab(60) : z.fab(30)`; `ExploreView` passes `lifted={focusId != null}`; NodeSheet non-modal (no scrim/inert/trap) keeps graph reachable. `filterFabLift.test.tsx` passes. |
| 5 | A11Y-03 — resizing viewport with a node focused keeps camera framed (no snap-off) | ✓ VERIFIED (code) / device pending | `ConstellationCanvas` focus-camera effect deps `[focusId, graphData, size.height, visibleViewportHeight]` re-fire `fg.zoom` + `fg.centerAt`; shared visible-viewport source (visualViewport?.height) drives keyboard/toolbar reframe, not window.innerHeight. Test asserts re-fire on height change. |

**Score:** 5/5 truths verified in code; 5 items routed to on-device confirmation (per plan design + phase-goal "on real phone hardware").

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `components/Sheet.tsx` | Shared modal/non-modal/fullscreen primitive, portals to body | ✓ VERIFIED | createPortal to document.body; `useFocusTrap(ref,{active:open&&modal})` + `useDialogDismiss(open,onClose)`; `if(!open) return null` guard preserved; zIndex via `config.ui.z`. |
| `a11y/useFocusTrap.ts` | Init-focus + Tab-wrap + inert + restore | ✓ VERIFIED | Captures activeElement, `setRootInert(true)`, initialFocusRef/first-focusable/container focus, Tab-wrap keydown, cleanup restores + decrements. |
| `a11y/useDialogDismiss.ts` | Escape via shared LIFO | ✓ VERIFIED | push/remove onClose keyed on [active,onClose]. |
| `a11y/dialogStack.ts` | Module LIFO, topmost handles Escape | ✓ VERIFIED | Single shared listener, stopPropagation, topmost-only. |
| `a11y/inertRoot.ts` | Ref-counted setRootInert on #app-content | ✓ VERIFIED | Counter flips native `inert` only across 0↔1; guards missing element. |
| `config.ui.z` + `FAB_SHEET_GAP_PX` | Named z tiers + FAB gap | ✓ VERIFIED | content10/page15/toast20/fabScrim25/fab30/sheetScrim40/sheet50/focusedFab60; CR-01 fix (fabScrim<fab) + WR-01 fix (page<sheetScrim) both present. |
| `explore/useVisibleViewportHeight.ts` | Shared visible-viewport hook | ✓ VERIFIED | Consumed by NodeSheet, ExploreFilterFab, ConstellationCanvas. |
| `explore/ExploreFilterFab.tsx` | `lifted` prop | ✓ VERIFIED | See truth 4. |
| `orbLabelFit.catalog.test.ts` | Zero-ellipsis over 264 @matrix names | ✓ VERIFIED | Imports @matrix, passes. |
| `dev/OrbFitHarness.tsx` | Dev route + overflow flagging | ✓ VERIFIED | Mounted only on `#/dev/orb-fit` in App.tsx:47. |
| `App.tsx` #app-content | Inert target wrapper | ✓ VERIFIED | `<div id="app-content" style={{display:"contents"}}>` at :59 (WR-02 device caveat noted). |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| Sheet.tsx | useFocusTrap | `useFocusTrap(contentRef,{active:open&&modal})` | ✓ WIRED |
| inertRoot.ts | #app-content | `getElementById("app-content").inert` | ✓ WIRED (App.tsx has the id) |
| ExploreView.tsx | ExploreFilterFab | `lifted={focusId != null}` | ✓ WIRED (:216) |
| ExploreFilterFab | config.ui.z.focusedFab | zIndex when lifted | ✓ WIRED |
| SettingsView | Sheet | `<Sheet ... initialFocusRef={inputRef}>` | ✓ WIRED |
| ConstellationCanvas | useVisibleViewportHeight | reframe dep | ✓ WIRED |

### Behavioral Spot-Checks / Probe Execution

| Check | Command | Result | Status |
| --- | --- | --- | --- |
| App typecheck | `tsc -p packages/app/tsconfig.json --noEmit` | exit 0 | ✓ PASS |
| Phase-08 test files (10) | `vitest run --project @guezzer/app <10 files>` | 60 passed | ✓ PASS |
| Full app project | `vitest run --project @guezzer/app` | 44 files / 273 tests passed | ✓ PASS |
| D-04 no raw z literal (prod) | grep `z-[0-9]` in packages/app/src | only OrbFitHarness dev header (IN-02) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Status | Evidence |
| --- | --- | --- | --- |
| POLISH-01 | 08-06 | ✓ SATISFIED (code) / device pending | Retune + catalog test + harness (truth 1) |
| POLISH-02 | 08-07 | ✓ SATISFIED | Tests pass + STATE.md resolved (truth 2) |
| A11Y-01 | 08-01/02/03/04 | ✓ SATISFIED (code) / AT device pending | 7 audited surfaces migrated (truth 3) |
| A11Y-02 | 08-04 | ✓ SATISFIED (code) / device pending | FilterFab lift (truth 4) |
| A11Y-03 | 08-04 | ✓ SATISFIED (code) / device pending | Reframe on shared viewport (truth 5) |

All 5 phase requirement IDs (POLISH-01, POLISH-02, A11Y-01, A11Y-02, A11Y-03) are declared in plan frontmatter and map 1:1 to REQUIREMENTS.md Phase-8 rows. No orphaned or unmapped requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| dev/OrbFitHarness.tsx | 108 | raw `z-10` Tailwind literal | ℹ️ Info (IN-02) | Throwaway dev harness only; not in prod tier system. |
| SearchSheet / AlbumDetail / ArchiveBrowser / SetlistView / RecapView / CometTrail | various | `aria-modal="true"` without focus trap/Escape/restore | ⚠️ Warning (WR-03) | Out-of-audited-7 route overlays make a false-modal promise to AT. Consistency gap, not a criterion-3 regression. Deferred follow-up. |

No blocker anti-patterns. No TBD/FIXME/XXX debt markers in phase-modified source. No `dangerouslySetInnerHTML`. Guarded closed/error states preserved (V7).

### Human Verification Required

See frontmatter `human_verification` — 5 on-device checks routed to the end-of-phase device pass over the cloudflared HTTPS UAT tunnel: (1) orb legibility via `#/dev/orb-fit`, (2) WR-02 inert-on-display:contents under VoiceOver, (3) A11Y-01 real AT dismiss/trap/restore across the 7 surfaces, (4) A11Y-02 FilterFab no-occlusion, (5) A11Y-03 resize/rotate/keyboard camera framing.

### Gaps Summary

No code gaps. Every must-have artifact exists, is substantive, is wired, and is exercised by passing automated tests (60 phase-specific + 273 full-app app-project tests) with `tsc --noEmit` clean. The z-tier regressions surfaced in code review (CR-01 fabScrim<fab, WR-01 page<sheetScrim) are confirmed fixed in `config.ui.z`. The phase goal explicitly requires "on real phone hardware," and the plans deliberately deferred the final legibility/AT/viewport confirmations to an end-of-phase device sweep — those are the outstanding human items, not missing implementation. WR-03 (out-of-scope aria-modal surfaces) is noted as a WARNING/follow-up and does not block the criterion-3 goal, which is scoped to the 7 named surfaces (all migrated).

---

_Verified: 2026-07-18T08:57:08Z_
_Verifier: Claude (gsd-verifier)_

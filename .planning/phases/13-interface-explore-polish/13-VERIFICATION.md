---
phase: 13-interface-explore-polish
verified: 2026-07-19T20:42:00Z
status: passed
score: 4/4 must-haves code-verified; 3/3 device UAT items owner-approved 2026-07-19
device_uat: passed (UX-01, UX-02, UX-04 — see 13-HUMAN-UAT.md)
overrides_applied: 0
human_verification:
  - test: "UX-01: On a notched iPhone installed (standalone) PWA over the cloudflared HTTPS tunnel, open the AppShell header then each top overlay (SearchSheet, ArchiveBrowser, AlbumDetail, CompareView, SetlistView, RecapView)."
    expected: "A single env(safe-area-inset-top) dead band above the header (no doubled ~50px band); header content vertically aligned across shell + six overlays; RecapView intentionally 12px lower."
    why_human: "iOS Safari viewport-fit=cover safe-area rendering on physical notched hardware cannot be observed from source or jsdom."
  - test: "UX-02: In the installed PWA, start a show (screen stays awake), End Show, leave the device untouched."
    expected: "After End Show the screen dims/sleeps on the normal iOS auto-lock timer and stays asleep — the wake lock is released, not lingering."
    why_human: "Real Screen Wake Lock behaviour on iOS hardware (screen actually sleeping) is not observable in jsdom; the automated test covers the release logic but not the physical outcome."
  - test: "UX-04: In the installed PWA open Explore, pan/zoom into a region, trigger address-bar collapse (scroll) and rotate portrait<->landscape; separately focus a node then drive it off-screen via a resize."
    expected: "Camera stays put after address-bar collapse + rotation (no fit-all snap); an off-screen focused node smoothly re-centers pan-only at current zoom (no re-zoom, no fit-all)."
    why_human: "iOS address-bar collapse / orientation viewport resizing and canvas camera behaviour require a physical device; jsdom cannot exercise real resize + visualViewport events."
---

# Phase 13: Interface & Explore Polish Verification Report

**Phase Goal:** The remaining low-severity live-venue UI/model rough edges are smoothed — safe-area inset, wake-lock release, fill-hint accuracy, and constellation camera behavior.
**Verified:** 2026-07-19T20:42:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 (UX-01) | Single top safe-area inset; overlay headers align with shell header | ✓ VERIFIED (code); device confirm pending | `styles.css:186-190` — `padding-top: env(safe-area-inset-top)` deleted from `body`, replaced with a `UX-01 / D-01` NOTE comment; bottom/left/right insets retained. `RecapView.tsx:162-165` — intentional `+24px` retained with a "do NOT normalize" comment. All seven top surfaces self-apply `calc(env(safe-area-inset-top) + Npx)` (six +12px, RecapView +24px). |
| 2 (UX-02) | Wake lock reliably released after End Show even when release races an in-flight acquire | ✓ VERIFIED (code); device confirm pending | `wakeLock.ts:67-74` — post-await `if (!showActive)` re-check releases `next` in a swallowing try/catch and returns WITHOUT storing `sentinel` or calling `onUnsupported`; `next.released` branch, reacquire listener, and `releaseWakeLock` unchanged. Race regression test passes (6 wakeLock tests green). |
| 3 (UX-03) | Fill-hints name the correct song after skipped/deleted trail entries — no off-by-N | ✓ VERIFIED (fully automated) | `suggest.ts:165-225` — `resolvePlaceholders` rewritten to interval-count-match subsequence anchoring by `songId` (not raw position); emits 1:1 bracketed hints only on per-interval count match, else suppresses. `FillHint` interface/signature unchanged. 28 suggest tests pass (6 new UX-03 fixtures incl. skipped-song→B, count-mismatch suppress). No device item — pure core. |
| 4 (UX-04) | Constellation keeps user's pan/zoom across container resizes instead of snapping to fit-all | ✓ VERIFIED (code); device confirm pending | `ConstellationCanvas.tsx:771-780` — `zoomToFit` gated behind `firstSettleRef.current`; fx/fy pinning loop (`:755-761`) remains unconditional (EXPL-06 preserved). Off-screen focus pan re-center at `:390-406` uses `graph2ScreenCoords` + `FOCUS_OFFSCREEN_MARGIN_PX`, pans at current zoom (`fg.zoom()`), never re-zooms. `config.ts:474` adds `FOCUS_OFFSCREEN_MARGIN_PX: 24`. 14 app camera tests pass. |

**Score:** 4/4 truths code-verified (UX-03 fully automated; UX-01/02/04 code-complete with on-device confirmation deferred to HUMAN-UAT).

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/app/src/styles.css` | body top padding removed, bottom/left/right kept | ✓ VERIFIED | Line 186 deleted; explanatory D-01 comment present; three sibling insets present. |
| `packages/app/src/dex/RecapView.tsx` | +24px retained + intentional comment | ✓ VERIFIED | `:162-165` comment + `+24px` value unchanged. |
| `.planning/.../13-HUMAN-UAT.md` | consolidated device-UAT checklist w/ UX-01/02/04 | ✓ VERIFIED | `status: pending`, cloudflared tunnel runbook, three unchecked device sections. |
| `packages/app/src/wakeLock.ts` | post-await showActive re-check | ✓ VERIFIED | `:67-74` re-check present; contains `showActive`; A5 residual documented. |
| `packages/app/test/wakeLock.test.ts` | race regression test | ✓ VERIFIED | Race test present; 6 wakeLock tests pass. |
| `packages/core/src/live/suggest.ts` | interval-count-match resolvePlaceholders | ✓ VERIFIED | `:165-225` anchors by songId; doc comment rewritten. |
| `packages/core/test/suggest.test.ts` | position-gap/skip regression fixtures | ✓ VERIFIED | 28 tests pass (6 new fixtures). |
| `packages/app/src/explore/ConstellationCanvas.tsx` | firstSettleRef gate + off-screen pan | ✓ VERIFIED | firstSettleRef, reset effect, off-screen pan all present and wired. |
| `packages/app/src/config.ts` | FOCUS_OFFSCREEN_MARGIN_PX | ✓ VERIFIED | `:474` `FOCUS_OFFSCREEN_MARGIN_PX: 24` in explore section. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| AppShell header | body (styles.css) | in-flow header inherits body padding | ✓ WIRED | body no longer applies top pad; header self-applies its own inset — single inset. |
| acquireWakeLock re-check | releaseWakeLock never-throw idiom | copied try/catch swallow | ✓ WIRED | `wakeLock.ts:68-72` swallowing catch matches `:103-107`. |
| resolvePlaceholders anchors | editor rows | match by songId | ✓ WIRED | `suggest.ts:186` `editorIndexBySongId.get(e.songId)`. |
| onEngineStop | zoomToFit | firstSettleRef gate | ✓ WIRED | `:771` `if (firstSettleRef.current)` wraps zoomToFit; fx/fy loop unconditional. |
| focus-camera effect | graph2ScreenCoords off-screen test | size.width dep + margin check | ✓ WIRED | `:396` graph2ScreenCoords, `:407` size.width in deps, pan-only at current zoom. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| UX-03 anchoring + suppression | `vitest run --project @guezzer/core suggest` | 28 passed | ✓ PASS |
| UX-02 race + UX-04 camera | `vitest run --project @guezzer/app wakeLock filterFabLift` | 14 passed | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| UX-01 | 13-01 | Single top safe-area inset; aligned overlay headers | ✓ SATISFIED (code); device confirm pending | styles.css / RecapView fix verified |
| UX-02 | 13-02 | Wake lock released after End Show under acquire/release race | ✓ SATISFIED (code); device confirm pending | wakeLock.ts re-check + race test |
| UX-03 | 13-03 | Fill-hints correct after skipped/deleted entries | ✓ SATISFIED (automated) | suggest.ts rewrite + 28 tests |
| UX-04 | 13-04 | Camera preserved across container resizes | ✓ SATISFIED (code); device confirm pending | ConstellationCanvas gate + pan re-center |

All four requirement IDs (UX-01..04) are declared in plan frontmatter, mapped to Phase 13 in REQUIREMENTS.md (lines 86-89), and accounted for. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| ConstellationCanvas.tsx | 259-261 | `[graphData]`-keyed reset effect effectively dead (graphData session-stable; view switch flips `visibleNodeIds`, not graphData) | ℹ️ Info (WR-01) | Does NOT undermine goal: resize preservation holds because a resize changes `size.*` → reheat → settle → gate already false → no zoomToFit. Maintainability/misleading-comment concern only. |
| ConstellationCanvas.tsx | 380-407 | `visibleViewportHeight` dep vestigial (off-screen math uses `size.height`) | ℹ️ Info (WR-02) | No keyboard-summoning input in Explore (only a range slider), so the case does not arise today. Latent, not active. |
| suggest.ts | 187-188 | Reprise (song repeated in show) → `editorIdx <= lastEditorIdx` suppresses ALL hints | ℹ️ Info (WR-03) | Intentional per locked conservative-suppress D-03 posture ("no hint beats a wrong hint"). Errs safe; not off-by-N. Documentation/graceful-degradation improvement, not a goal miss. |

No debt markers (TBD/FIXME/XXX/HACK/PLACEHOLDER) in any modified source file. No stubs — all `return []` paths are intentional suppression, not placeholders.

### Human Verification Required

Three on-device confirmations remain (already documented in `13-HUMAN-UAT.md`, `status: pending`). These are legitimate physical-device checks, not code gaps — the code implementations are all verified present and wired, and the automated tests are green.

1. **UX-01 safe-area inset (device)** — Install on a notched iPhone via cloudflared HTTPS tunnel; confirm single dead band and aligned overlay headers.
2. **UX-02 wake-lock release (device)** — Start then End Show; confirm the screen sleeps and stays asleep.
3. **UX-04 camera preservation (device)** — Pan/zoom, collapse address bar + rotate; confirm no fit-all snap and pan-only off-screen re-center.

### Gaps Summary

No code gaps. All four fixes exist, are substantive, and are correctly wired in the codebase; targeted test suites pass (28 core suggest, 14 app camera/wakeLock). The three code-review warnings (WR-01 dead reset effect, WR-02 vestigial dep, WR-03 reprise global-suppress) are maintainability/scope items that do not undermine the phase goal:

- **WR-01** — confirmed against `ExploreView.tsx:73-74` (`graphData` keyed on `[result]`, session-stable). The reset effect is effectively dead, but the resize-preservation goal (UX-04) still holds functionally because the resize path relies on `size.*` changes reheating with the gate already `false`, not on the reset effect.
- **WR-02** — inert in Explore (no keyboard-summoning input); latent only.
- **WR-03** — matches the locked D-03 conservative-suppress posture; errs safe, never off-by-N (UX-03's actual contract).

Status is `human_needed` (not `passed`) solely because UX-01/02/04 carry deferred on-device confirmation items in HUMAN-UAT.md. UX-03 is fully verified with no device dependency.

---

_Verified: 2026-07-19T20:42:00Z_
_Verifier: Claude (gsd-verifier)_

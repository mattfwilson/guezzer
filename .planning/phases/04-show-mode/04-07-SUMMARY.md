---
phase: 04-show-mode
plan: 07
subsystem: show-mode-survivability
tags: [react, wake-lock, screen-wake-lock, page-visibility, gesture-suppression, touch-action, overscroll-behavior, weak-fan, end-show, dexie]

# Dependency graph
requires:
  - phase: 04-show-mode
    plan: 06
    provides: ActionBar + CometTrail + TallyReadout + TrailNodeSheet — the full correctable tracking loop
  - phase: 04-show-mode
    plan: 04
    provides: ShowView lifecycle root + useShowSession (active-show branch where the wake lock attaches)
  - phase: 04-show-mode
    plan: 03
    provides: OrbitStage + isWeakFan/confidence.ts (weak-fan softening already computed and applied live, EVAL-04/D-10)
  - phase: 04-show-mode
    plan: 01
    provides: db endShow finalize helper + config.show/copy.show (wake-lock fallback + End Show copy)
provides:
  - Screen Wake Lock helper (acquireWakeLock) — feature-detect + verify-sentinel-held + visibilitychange reacquire + release, never throws (SHOW-12)
  - WakeLockNotice — calm once-per-show unsupported fallback (pre-iOS-18.4 installed PWA) instead of a silent dim
  - Gesture-suppression CSS on the non-scrolling orbit stage + action bar (touch-action/overscroll-behavior/user-select, SHOW-13)
  - EndShowDialog — explicit confirm before endShow finalizes the setlist to read-only (D-04)
  - Live weak-fan softening confirmed wired from 04-03 (top score < WEAK_FAN_THRESHOLD → softened orbs + honest %, EVAL-04)
affects: [phase-05-live-sync-export, phase-06-recap]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "wakeLock.ts mirrors pwa/persist.ts: a silent-on-failure browser-API wrapper — feature-detect, try/catch, never throw, idempotent; it VERIFIES the returned sentinel is actually live (immediate release/rejection treated as unsupported → onUnsupported), not trusting `'wakeLock' in navigator` alone (Pitfall 1, the phase's highest-risk item)"
    - "Wake-lock reacquire is a module-level visibilitychange listener gated on an active show and no held sentinel — reacquire is silent (no copy); only the initial unsupported detection surfaces the once-per-show WakeLockNotice"
    - "Gesture suppression is declarative CSS scoped to the stage/action-bar classes (no passive-listener JS footguns): touch-action:manipulation + overscroll-behavior:none + user-select/-webkit-user-select:none + -webkit-touch-callout:none, plus overscroll-behavior-y:none on html/body — the stage is a non-scrolling fixed region (the 04-04 AppShell scroll=false seam holds)"
    - "End Show is a two-step destructive commit: EndShowDialog confirm → db.endShow(sessionId) flips status to finalized/read-only (D-04) — no accidental mid-show ending"
    - "Weak-fan softening stays a single source of truth: OrbitStage computes isWeakFan(candidates) once against config.show.WEAK_FAN_THRESHOLD and the honest small % still renders — no renormalization, no faked number (EVAL-04/D-10)"

key-files:
  created:
    - packages/app/src/wakeLock.ts
    - packages/app/src/show/WakeLockNotice.tsx
    - packages/app/src/show/EndShowDialog.tsx
    - packages/app/test/wakeLock.test.ts
    - packages/app/test/endShowDialog.test.tsx
  modified:
    - packages/app/src/show/ShowView.tsx
    - packages/app/src/show/ActionBar.tsx
    - packages/app/src/show/OrbitStage.tsx
    - packages/app/src/styles.css

key-decisions:
  - "Wake-lock verify-held guard treats an immediately-released or rejected sentinel as unsupported (Pitfall 1) — the iOS <18.4 installed-PWA false-positive never bricks the loop; it degrades to the calm WakeLockNotice"
  - "Reacquire on visibilitychange is silent per UI-SPEC; only the first unsupported detection shows copy, and only once per show"
  - "Gesture suppression is pure declarative CSS on the stage/action-bar scope — no touchstart/touchmove preventDefault JS (avoids passive-listener footguns), relying on the 04-04 non-scrolling AppShell seam"
  - "End Show requires an explicit confirm (D-04) before endShow finalizes to read-only — one-tap Undo (04-06) remains the mid-show correction path; ending the night is deliberately heavier"
  - "Weak-fan softening needed no new code — it was already live in OrbitStage from 04-03 (isWeakFan applied to orbs + the muted Low-confidence hint); this plan confirmed it is still wired rather than duplicating the pipeline"

requirements-completed: [SHOW-12, SHOW-13, EVAL-04]

# Metrics
duration: ~10min
completed: 2026-07-09
---

# Phase 4 Plan 07: Dark-Venue Survivability Summary

**The dark-venue survivability layer lands: a Screen Wake Lock helper that feature-detects AND verifies the sentinel is actually held (defeating the iOS <18.4 installed-PWA silent-fail, Pitfall 1), reacquires silently on visibilitychange, and degrades to a calm once-per-show WakeLockNotice when unsupported (SHOW-12); declarative gesture-suppression CSS (touch-action/overscroll-behavior/user-select) on the non-scrolling orbit stage + action bar so a fat thumb never scrolls, rubber-bands, double-tap-zooms, or long-press-selects (SHOW-13); an EndShowDialog that finalizes the setlist to read-only only behind an explicit confirm (D-04); and confirmed-still-live weak-fan softening from 04-03 (EVAL-04). 178 workspace tests green, `tsc -p packages/app --noEmit` clean. The six on-device perceptual checks (SHOW-12/SHOW-13) are the only remaining debt and were explicitly DEFERRED by user approval on 2026-07-13 to the phase end-of-phase human-verify gate — not skipped.**

## Performance

- **Duration:** ~10 min (Tasks 1–2 execution) + continuation finalization
- **Tasks:** 2 of 3 code tasks complete; Task 3 is the on-device human-verify checkpoint (deferred, see below)
- **Files:** 9 (5 created, 4 modified)

## Accomplishments

- **Task 1 — Wake Lock helper + reacquire + WakeLockNotice fallback** (`a17e560`): `wakeLock.ts` mirrors `pwa/persist.ts` — `acquireWakeLock(onUnsupported)` feature-detects `"wakeLock" in navigator`, calls `request("screen")` in a try/catch, and VERIFIES the returned sentinel did not immediately fire `release` / is live (the iOS <18.4 installed-PWA false-positive, Pitfall 1 — the phase's highest-risk item); an immediate release or a rejection is treated as unsupported and fires `onUnsupported`. A `release()` and a module-level `visibilitychange` listener reacquire silently while a show is active and no sentinel is held. The helper never throws. `WakeLockNotice.tsx` renders the muted, dismissible, once-per-show fallback (copy from `config.copy.show`) only when `onUnsupported` fired. ShowView acquires on entering the active-show branch, releases on End Show / leaving, registers the reacquire, and renders WakeLockNotice when unsupported.
- **Task 2 — Gesture suppression CSS + End Show finalize confirm** (`cdb550e`): `styles.css` sets `touch-action: manipulation`, `overscroll-behavior: none`, `user-select`/`-webkit-user-select: none`, and `-webkit-touch-callout: none` scoped to the orbit-stage + action-bar classes, plus `overscroll-behavior-y: none` on `html, body` — the stage stays a non-scrolling fixed region (the 04-04 AppShell `scroll=false` seam holds; the comet-trail strip may scroll horizontally, the stage never rubber-bands). `EndShowDialog.tsx` is a confirm dialog ("End show?" heading + destructive-styled "End show" / "Keep tracking" per UI-SPEC) that on confirm calls `endShow(sessionId)`, flipping status to finalized/read-only (D-04) — required before starting the next night. Weak-fan softening confirmed still applied live in OrbitStage from 04-03 (no new code — `isWeakFan(candidates)` against `config.show.WEAK_FAN_THRESHOLD`, honest % preserved, EVAL-04/D-10).

## Task Commits

1. **Task 1 — Wake lock helper + verify-held + reacquire + fallback notice** — `a17e560` (feat)
2. **Task 2 — Gesture suppression CSS + End Show finalize confirm** — `cdb550e` (feat)

_Plan metadata (SUMMARY/STATE/ROADMAP/REQUIREMENTS) committed separately._

## Deviations from Plan

None — plan executed as written for the two code tasks. Weak-fan softening was correctly found already-live from 04-03 (as the plan's read-first anticipated), so no duplicate pipeline was introduced. No Rule 1/2/3/4 fixes were required.

## Deferred Human Verification (end-of-phase gate)

Task 3 is a `checkpoint:human-verify` gated `blocking-human` — SHOW-12 and SHOW-13 are device-only per 04-VALIDATION (no reliable jsdom assertion for real Wake Lock hold or native gesture behavior). On **2026-07-13 the user approved with an explicit decision to DEFER** these on-device checks to the phase's end-of-phase human-verify gate (config `human_verify_mode: end-of-phase`). **These are the SHOW-12 / SHOW-13 device-only items — deferred, NOT skipped.** They must be run on a real **installed** PWA (home-screen, not a Safari tab) on the **oldest iOS device in the friend group** before show #1:

1. **Wake lock holds:** Start a show → the screen stays awake for several minutes untouched. On a pre-iOS-18.4 device, confirm the calm "keep your screen on manually…" fallback (WakeLockNotice) appears **once** — not a silent dim.
2. **Silent reacquire:** Background the app (home / app-switch) and return → the wake lock reacquires silently (screen stays awake again, no copy shown on reacquire).
3. **Gesture suppression:** Over the orbit stage attempt pull-to-refresh, double-tap-zoom, and long-press text-select → **none** fire; the stage does not scroll or rubber-band.
4. **Weak-fan softening:** Force a weak fan (sparse moment) → the orbs soften + the muted "Low confidence · Wide-open moment" hint shows while the honest small % still renders (no faked number).
5. **End Show finalize:** Tap End Show → confirm dialog → the setlist finalizes read-only and returns to the pre-show launcher.
6. **Record versions:** When eventually run, record the tested iOS/device versions and the oldest friend-group device. **This resolves the STATE.md `[Phase 4] iOS PWA lifecycle` blocker** (real-iPhone wake-lock spike on the oldest iOS in the group).

## Next Phase Readiness

- The full Show-Mode one-thumb loop is now code-complete: orbit predictions + logging + recenter + restore (04-03/04), miss paths + search + ??? (04-05), set structure + comet trail + tally + undo/edit (04-06), and now wake lock + gesture suppression + weak-fan softening + End Show finalize (04-07). All SHOW-* 🎯 bars for Phase 4 are implemented; SHOW-12/13 await only the deferred on-device confirmation.
- **Phase 5 (live sync / export):** finalized (read-only) shows are the stable basis for JSON export; the End Show status flip gives export a clean "night complete" signal.
- Full workspace suite green: **178 tests / 26 files**; `tsc -p packages/app --noEmit` clean.

## Self-Check: PASSED

- FOUND: packages/app/src/wakeLock.ts
- FOUND: packages/app/src/show/WakeLockNotice.tsx
- FOUND: packages/app/src/show/EndShowDialog.tsx
- FOUND: packages/app/test/wakeLock.test.ts
- FOUND: packages/app/test/endShowDialog.test.tsx
- FOUND commit: a17e560 (feat)
- FOUND commit: cdb550e (feat)

---
*Phase: 04-show-mode*
*Completed: 2026-07-09 (finalized 2026-07-13, device checks deferred to end-of-phase gate)*

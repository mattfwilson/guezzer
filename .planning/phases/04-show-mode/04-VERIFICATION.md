---
phase: 04-show-mode
verified: 2026-07-13T00:00:00Z
status: passed
score: 35/35 code-level truths verified; SHOW-12/SHOW-13 on-device human confirmation completed 2026-07-13 on iPhone 16 Pro, iOS 26.3.1 (04-HUMAN-UAT.md)
overrides_applied: 0
human_verification_result:
  completed: 2026-07-13
  device: iPhone 16 Pro, iOS 26.3.1
  outcome: "All six on-device steps passed (04-HUMAN-UAT.md). Residual gap: iOS <18.4 Wake Lock false-positive fallback path not exercised (test device is 26.3.1) — non-blocking, unit-covered."
re_verification:
  previous_status: none
  note: "Initial verification. A prior code review (04-REVIEW.md) found 1 Critical + 3 Warnings, all fixed (b20cdaa, ff477d8, a852795, 4442e26) and re-confirmed present in this verification."
human_verification:
  - test: "Install the built PWA to the home screen on the oldest iOS device in the friend group. Start a show; leave it untouched several minutes."
    expected: "Screen stays awake without interaction. On pre-iOS-18.4 devices, the calm 'Keep your screen on manually…' WakeLockNotice appears ONCE (not a silent dim)."
    why_human: "Wake Lock hold + iOS <18.4 false-positive fallback cannot be exercised in jsdom; requires a real installed PWA (SHOW-12)."
  - test: "Background the app (home / app-switch) during an active show, then return."
    expected: "The wake lock reacquires silently on visibilitychange (screen stays awake again, no notice)."
    why_human: "visibilitychange reacquire against a live Wake Lock sentinel is device-runtime behavior (SHOW-12)."
  - test: "Over the orbit stage, attempt pull-to-refresh, double-tap-zoom, and long-press text-select."
    expected: "None fire; the stage does not scroll or rubber-band."
    why_human: "Touch-gesture suppression is a perceptual on-device check (SHOW-13); CSS presence is verified in code but browser behavior is not."
  - test: "Force a weak fan (sparse moment / top score < 0.15) on the orbit."
    expected: "Orbs visibly soften (reduced opacity + desaturate) and the 'Low confidence · Wide-open moment' hint shows, while the honest small % still renders (no faked numbers)."
    why_human: "Perceptual softening quality is visual/on-device (EVAL-04/D-10); the code path and threshold are verified but the visual is not."
  - test: "Force-quit the installed PWA mid-show and relaunch."
    expected: "The app resumes straight into the active show with the exact same trail, date, and current song (SHOW-11 on real iOS PWA-discard behavior)."
    why_human: "iOS PWA state-discard + relaunch restore is device-only; the write-through + restore logic is unit-tested but the real-device lifecycle is not."
  - test: "Tap End Show → confirm dialog → confirm."
    expected: "The setlist finalizes to read-only; starting a new night is required before another active show can begin (D-04)."
    why_human: "End-to-end finalize gesture on the installed PWA is part of the deferred device gate; endShow logic is verified in code."
---

# Phase 4: Show Mode Verification Report

**Phase Goal:** At a live show, with one thumb, in the dark, the user can see credible next-song predictions and log the entire setlist without the app ever stalling, moving a tap target, or losing state.
**Verified:** 2026-07-13
**Status:** passed (on-device human confirmation completed 2026-07-13 on iPhone 16 Pro, iOS 26.3.1)
**Re-verification:** No — initial verification (prior code review 04-REVIEW.md fixes re-confirmed present)

## Goal Achievement

Phase 4 delivers the full Show Mode loop as a set of pure, config-driven core/app helpers wired into 13 presentational + orchestration components under `packages/app/src/show/`, backed by an additive Dexie `version(2)` schema. All code-level truths across the seven plans are verified against the actual codebase: the persistence substrate (write-through, restore, single-active, set-structure, undo, provisional attendance), the pure prediction/layout/confidence helpers, the fuzzy search in core, the orbit render layer, the reactive session hook, the miss paths (Search + ???), the trail/tally/edit views, and the dark-venue survivability layer (Wake Lock verify-held + reacquire + fallback, gesture-suppression CSS, weak-fan softening, End Show finalize).

The four code-review findings (1 Critical + 3 Warnings) are all fixed and confirmed present. The only outstanding work is the six on-device steps for SHOW-12/SHOW-13 (and the perceptual EVAL-04/SHOW-11 confirmations), which were explicitly deferred by the user on 2026-07-13 to the end-of-phase human-verify gate (`human_verify_mode: end-of-phase`).

### Observable Truths

| # | Truth (plan) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Start Show writes a date-keyed tracked-show row surviving relaunch (04-01, DEX-01) | ✓ VERIFIED | `db.ts` `startShow`; `showSession.test.ts` attendance case; 181 tests green |
| 2 | Every confirmed song write-through to IndexedDB, re-read exactly on relaunch (04-01, SHOW-11) | ✓ VERIFIED | `logSong` in `db.transaction("rw",...)`; write-through + restore tests green |
| 3 | Exactly one active show; End Show required before next (04-01, D-03/D-04) | ✓ VERIFIED | `startShow` single-active assert; `getActiveShow` status="active" first |
| 4 | Set break→'2', encore→'e', entries snapshot set number (04-01, SHOW-06) | ✓ VERIFIED | `markSetBreak`/`markEncore`; `logSong` snapshots `show.currentSetNumber` |
| 5 | Undo removes most recent entry in one call (04-01, SHOW-07) | ✓ VERIFIED | `undoLast` deletes max-position entry (sortBy position .at(-1)) |
| 6 | Running tally derived from entries, correct after any edit (04-01, SHOW-09) | ✓ VERIFIED | `scoring.ts` `deriveTally`; `tally.test.ts` green |
| 7 | Tracked-show row persists date + local sessionId only (04-01, D-05) | ✓ VERIFIED | `TrackedShow` shape: showId null, no venue label |
| 8 | Pure DOM-free searchCatalog fuzzy-matches by name (04-02, SHOW-04) | ✓ VERIFIED | `core/search/search-catalog.ts`; core purity intact (no React/DOM) |
| 9 | Search tolerates one-char typo (04-02) | ✓ VERIFIED | `search-catalog.test.ts` typo case green |
| 10 | Empty query returns [] (04-02) | ✓ VERIFIED | short-circuit in `makeCatalogSearcher`; test green |
| 11 | Current song center + top 5–8 orbs sized/placed by probability, deterministic (04-03, SHOW-01/02) | ✓ VERIFIED | `orbitLayout.ts` `layoutOrbs`/`selectFan`; `orbitLayout.test.ts` determinism green |
| 12 | Same input → same orb positions (04-03, SHOW-02) | ✓ VERIFIED | determinism deep-equal test green |
| 13 | Every orb ≥56px visual / ≥44px hit area (04-03, SHOW-02) | ✓ VERIFIED | `ORB_MIN_DIAMETER` clamp; `min-h-11 min-w-11` on orb |
| 14 | Absolute model %, <1% floor, never renormalized + tuning color (04-03, SHOW-01/D-09) | ✓ VERIFIED | `confidence.ts` `formatOrbPercent`; `tuningColor.ts` keys exact union |
| 15 | Info dot (not plain tap) opens verbatim reason (04-03, SHOW-10/D-11) | ✓ VERIFIED | `PredictionOrb.tsx` separate sibling `<button>` for Info → onWhy |
| 16 | Weak fan (<0.15) softens visually (04-03, EVAL-04/D-10) | ✓ VERIFIED | `isWeakFan`; OrbitStage passes `isWeak`; confidence.test.ts green |
| 17 | Tap Start Show opens orbit, today's date, provisional attendance (04-04, DEX-01) | ✓ VERIFIED | `PreShowLauncher` → `startShow`; ShowView branch |
| 18 | Pre-opener 'Tap the opener' prompt, NO fan, predict() never called w/o current song (04-04) | ✓ VERIFIED | `useShowSession.ts:108` null-gate; ShowView pre-opener branch |
| 19 | Tapping orb logs hit, appends old current to trail, recenters, recomputes (04-04, SHOW-03) | ✓ VERIFIED | `ShowView` onTapOrb → classifyOutcome + logSong; useLiveQuery recompute; restore/hit test green |
| 20 | Write-through + force-quit restore exact active show (04-04, SHOW-11) | ✓ VERIFIED | restore integration test green; `useShowSession` useLiveQuery single-source |
| 21 | ShowView branches pre-show / active / finalized (04-04) | ✓ VERIFIED | ShowView lifecycle branching present |
| 22 | Orbit stage does not scroll/rubber-band in AppShell (04-04, SHOW-13 seam) | ✓ VERIFIED | AppShell scroll seam resolved; gesture CSS in styles.css |
| 23 | Search seeds opener, first fan renders (04-05, SHOW-04) | ✓ VERIFIED | `SearchSheet` → onSelect seeds currentSongId; `makeCatalogSearcher` |
| 24 | Opening song logs as miss (empty shown-fan) (04-05, D-06/D-08) | ✓ VERIFIED | SearchSheet logs outcome:"miss"; classifyOutcome empty fan → miss |
| 25 | Always-visible Search, select logs miss + recenters (04-05, SHOW-04) | ✓ VERIFIED | ActionBar Search button; SearchSheet select → logSong miss |
| 26 | Always-visible ??? logs placeholder miss instantly, no confirm (04-05, SHOW-05/D-14) | ✓ VERIFIED | ActionBar ??? → logSong(songId null, isPlaceholder true, miss), no dialog |
| 27 | No-result search offers logging as ??? inline (04-05) | ✓ VERIFIED | SearchSheet no-match ??? offer |
| 28 | Set break/encore, entries snapshot + round-trip kglw encoding (04-06, SHOW-06) | ✓ VERIFIED | ActionBar secondary row → markSetBreak/markEncore; set-structure test green |
| 29 | Undo one tap; older node opens edit/delete/rename (04-06, SHOW-07/D-15) | ✓ VERIFIED | ActionBar Undo → undoLast; TrailNodeSheet edit/delete/rename |
| 30 | Comet trail last ~4 diminishing nodes + hit/miss rings + +N at 30 (04-06, SHOW-08) | ✓ VERIFIED | `CometTrail.tsx` config.show.TRAIL_VISIBLE_RECENT/COMPRESS_AT; B2 hexes |
| 31 | Persistent hit/miss tally recomputes after any edit (04-06, SHOW-09) | ✓ VERIFIED | `TallyReadout.tsx` tabular-nums; useLiveQuery reactive |
| 32 | Wake lock held + reacquired on visibilitychange; calm fallback when unsupported (04-07, SHOW-12) | ✓ VERIFIED (code + device) | `wakeLock.ts` verify-held (sentinel released check) + visibilitychange reacquire + onUnsupported; device-confirmed 2026-07-13 (iPhone 16 Pro, iOS 26.3.1): screen held + silent reacquire. Residual: pre-18.4 fallback path not exercised (see Human Verification) |
| 33 | Stage/action bar suppress pull-to-refresh, bounce, double-tap zoom, text select (04-07, SHOW-13) | ✓ VERIFIED (code + device) | `styles.css` touch-action/overscroll-behavior/user-select/touch-callout; device-confirmed 2026-07-13 (iPhone 16 Pro, iOS 26.3.1): no gesture fired, stage did not scroll/rubber-band |
| 34 | Weak-fan softening applied live when top < 0.15 (04-07, EVAL-04/D-10) | ✓ VERIFIED | OrbitStage `isWeakFan` live; honest % still renders |
| 35 | End Show finalizes to read-only via confirm; required before next night (04-07, D-04) | ✓ VERIFIED | `EndShowDialog.tsx` → endShow(sessionId) after confirm |

**Score:** 35/35 code-level truths verified. SHOW-12 and SHOW-13 (truths 32, 33) on-device human confirmation was completed 2026-07-13 on iPhone 16 Pro, iOS 26.3.1 (all six steps passed; see 04-HUMAN-UAT.md).

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/app/src/db/db.ts` | v2 tables + write helpers | ✓ VERIFIED | version(2) trackedShows/trackedEntries; all helpers; CR-01 fix present |
| `packages/app/src/config.ts` | config.show + copy.show | ✓ VERIFIED | show tunables + copy strings |
| `packages/app/src/show/scoring.ts` | classifyOutcome + deriveTally | ✓ VERIFIED | pure, tested |
| `packages/core/src/search/search-catalog.ts` | toCatalog + makeCatalogSearcher | ✓ VERIFIED | fuse.js wrapper, zero DOM/React |
| `packages/app/src/show/orbitLayout.ts` | layoutOrbs + selectFan | ✓ VERIFIED | pure, config-driven, tested |
| `packages/app/src/show/matrix.ts` | bundled loader + schemaVersion guard | ✓ VERIFIED | schemaVersion===1 guard; memoized buildMatrixIndex |
| `packages/app/src/show/OrbitStage.tsx` | adaptive 5–8 orb fan | ✓ VERIFIED | renders CenterNode + PredictionOrb×N |
| `packages/app/src/show/useShowSession.ts` | reactive hooks | ✓ VERIFIED | useLiveQuery, null-safe currentSongId gate |
| `packages/app/src/show/ShowView.tsx` | lifecycle branching | ✓ VERIFIED | pre-show/active/finalized/load-failure |
| `packages/app/src/show/ActionBar.tsx` | two-row bar | ✓ VERIFIED | safe-area, both rows wired |
| `packages/app/src/show/SearchSheet.tsx` | fuzzy search sheet | ✓ VERIFIED | core searchCatalog; opener seed + miss log |
| `packages/app/src/show/CometTrail.tsx` | trail + rings + +N | ✓ VERIFIED | config constants; B2 hexes |
| `packages/app/src/show/TallyReadout.tsx` | persistent tally | ✓ VERIFIED | tabular-nums; zero-state |
| `packages/app/src/show/TrailNodeSheet.tsx` | edit/delete/rename | ✓ VERIFIED | WR-01 re-classify on edit present |
| `packages/app/src/wakeLock.ts` | acquire/verify/reacquire/release | ✓ VERIFIED | verify-held + visibilitychange + never throws |
| `packages/app/src/show/WakeLockNotice.tsx` | once-per-show fallback | ✓ VERIFIED | WR-03 per-session reset present |
| `packages/app/src/show/EndShowDialog.tsx` | finalize confirm | ✓ VERIFIED | endShow after confirm |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| App.tsx | ShowView.tsx | route === "show" | ✓ WIRED | App.tsx:46-47 |
| OrbitStage/showContext | core predict() | predictFan → predict | ✓ WIRED | showContext.ts:45-49 |
| SearchSheet | core searchCatalog | makeCatalogSearcher(toCatalog) | ✓ WIRED | SearchSheet.tsx:21,56 |
| useShowSession | db.ts | useLiveQuery trackedShows/Entries | ✓ WIRED | reactive single-source |
| ShowView | wakeLock.ts | acquire + visibilitychange | ✓ WIRED | reset effect keyed on sessionId |
| EndShowDialog | db.ts endShow | confirm → finalize | ✓ WIRED | EndShowDialog.tsx:31 |
| ActionBar secondary | db.ts | markSetBreak/markEncore/undoLast | ✓ WIRED | ActionBar.tsx:51-53 |
| matrix.ts | transition-matrix.json | Vite bundle-import | ✓ WIRED | build bundled into JS (775KB), precached (12 entries) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| OrbitStage/PredictionOrb | candidates/fan | predict() over bundled matrix + live entries | Yes (matrix bundled + real predict) | ✓ FLOWING |
| CometTrail | entries | useLiveQuery over trackedEntries | Yes (Dexie write-through) | ✓ FLOWING |
| TallyReadout | tally | deriveTally(entries) | Yes | ✓ FLOWING |
| SearchSheet | results | makeCatalogSearcher(matrix.nodes) | Yes (264-node catalog) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Full test suite | `npx vitest run` | 26 files / 181 tests passed | ✓ PASS |
| App typecheck | `npx tsc -p packages/app --noEmit` | exit 0 | ✓ PASS |
| Core typecheck | `npx tsc -p packages/core --noEmit` | exit 0 | ✓ PASS |
| Production build | `npm run build --workspace packages/app` | built; matrix bundled (775KB JS); PWA precache 12 entries / 786 KiB | ✓ PASS |
| Core purity | grep React/DOM/window in packages/core/src | only local `window` var in predict.ts (not browser global) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Status | Evidence |
| --- | --- | --- | --- |
| SHOW-01 | 04-03 | ✓ SATISFIED | OrbitStage center + orbs, tuning color, % on orb |
| SHOW-02 | 04-03 | ✓ SATISFIED | deterministic layoutOrbs, ≥56px, no force sim |
| SHOW-03 | 04-01/04-04 | ✓ SATISFIED | onTapOrb → logSong hit → recenter (useLiveQuery) |
| SHOW-04 | 04-02/04-05 | ✓ SATISFIED | core searchCatalog + SearchSheet; opener seed |
| SHOW-05 | 04-05 | ✓ SATISFIED | ??? instant placeholder miss, no confirm |
| SHOW-06 | 04-01/04-06 | ✓ SATISFIED | set break/encore snapshot; round-trip encoding |
| SHOW-07 | 04-01/04-06 | ✓ SATISFIED | one-tap undoLast; TrailNodeSheet edit/delete |
| SHOW-08 | 04-06 | ✓ SATISFIED | CometTrail diminishing + rings + +N at 30 |
| SHOW-09 | 04-01/04-06 | ✓ SATISFIED | deriveTally + persistent TallyReadout |
| SHOW-10 | 04-03 | ✓ SATISFIED | separate Info dot → WhyDetail verbatim reason |
| SHOW-11 | 04-01/04-04 | ✓ SATISFIED | write-through + restore test green |
| SHOW-12 | 04-07 | ✓ SATISFIED | wakeLock verify-held + reacquire + fallback; device-confirmed 2026-07-13 (iPhone 16 Pro, iOS 26.3.1): screen held + silent reacquire (pre-18.4 fallback path not exercised — residual gap, unit-covered) |
| SHOW-13 | 04-07 | ✓ SATISFIED | gesture-suppression CSS on non-scrolling stage; device-confirmed 2026-07-13: no gesture fired, no scroll/rubber-band; End Show finalize + return to launcher confirmed |
| EVAL-04 | 04-03/04-07 | ✓ SATISFIED | weak-fan softening live, honest % retained |
| DEX-01 | 04-01/04-04 | ✓ SATISFIED | startShow writes provisional attendance row |

All 15 phase requirement IDs are accounted for in REQUIREMENTS.md (SHOW-12/SHOW-13 marked "Complete — device verification deferred to end-of-phase gate"). No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (none) | — | No unreferenced TBD/FIXME/XXX debt markers in phase-modified files; no dangerouslySetInnerHTML; no stub returns feeding render | — | Clean |

The `return []`/`= []` patterns present (e.g. pre-opener `fan: []`, `candidates: []`) are intentional null-safe guards overwritten by real predict() output once a current song exists — not stubs. IN-01/IN-02 from the review are documented non-defects (idempotent double selectFan; opener-as-miss is an endorsed D-08 semantic).

### Code Review Fix Confirmation

| Finding | Fix | Commit | Confirmed in code |
| --- | --- | --- | --- |
| CR-01 (BLOCKER) | logSong derives position from max, not count | b20cdaa | ✓ db.ts:204-208 `(existing.at(-1)?.position ?? 0) + 1` |
| WR-01 | Edit re-classifies outcome; renameEntry persists it | ff477d8 | ✓ TrailNodeSheet.tsx:57-59 classifyOutcome; db.ts renameEntry(outcome?) |
| WR-02 | Info control unnested from orb button (siblings) | a852795 | ✓ PredictionOrb.tsx `<div>` + two sibling `<button>` |
| WR-03 | Wake notice resets per-show not per-session | 4442e26 | ✓ ShowView.tsx:77-80 effect keyed on activeSessionId |

### Human Verification Required — COMPLETED 2026-07-13

All six on-device steps (SHOW-12/SHOW-13 device gate, plus perceptual SHOW-11/EVAL-04 confirmations) were run on **iPhone 16 Pro, iOS 26.3.1** and **passed** — see `04-HUMAN-UAT.md` (status: resolved). Summary:

1. Wake Lock holds — PASS (screen stayed awake, iOS ≥18.4 holds path)
2. Silent reacquire on return — PASS
3. Gesture suppression on stage — PASS (no gesture fired, no scroll/rubber-band)
4. Weak-fan softening — PASS (multiple orbs <10%, orbs softened, honest % retained)
5. Force-quit / relaunch exact restore — PASS
6. End Show finalize + return to launcher — PASS (finished show persisted; viewing scoped to Phase 6)

**Residual gap (non-blocking):** the iOS <18.4 Wake Lock false-positive fallback path was not exercised because the test device is 26.3.1. The fallback logic is unit-covered (`wakeLock.test.ts` API-absent case) and the verify-held guard is sound; close out opportunistically if a pre-18.4 device becomes available.

### Gaps Summary

No code-level gaps. The Critical + 3 Warnings from the code review are all fixed and re-confirmed present. Tests (181/181), both typechecks, and the production build (offline-complete matrix bundle) all pass. Core purity holds. The phase goal is achieved in code, and the six deferred on-device confirmations for SHOW-12/SHOW-13 (and the perceptual SHOW-11/EVAL-04 checks) were completed on-device 2026-07-13 (iPhone 16 Pro, iOS 26.3.1) — status advanced from `human_needed` to `passed`. The only residual item is the pre-18.4 Wake Lock fallback path (non-blocking, unit-covered).

---

_Verified: 2026-07-13_
_Verifier: Claude (gsd-verifier)_

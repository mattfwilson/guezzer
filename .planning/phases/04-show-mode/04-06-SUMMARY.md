---
phase: 04-show-mode
plan: 06
subsystem: show-mode-setlist-history
tags: [react, actionbar, comet-trail, tally, trail-node-sheet, set-structure, undo, dexie]

# Dependency graph
requires:
  - phase: 04-show-mode
    plan: 05
    provides: ActionBar two-row scaffold (secondary row placeholders) + SearchSheet + ShowView active-orbit wiring
  - phase: 04-show-mode
    plan: 04
    provides: useShowSession (live entries + derived tally) + ShowView lifecycle root
  - phase: 04-show-mode
    plan: 01
    provides: db write helpers (markSetBreak/markEncore/undoLast/renameEntry) + config.show/copy.show + deriveTally
provides:
  - ActionBar secondary row live — Set break/Encore (set-structure snapshot, D-04 no auto-end) + one-tap Undo (D-15 no dialog)
  - CometTrail — last ~4 diminishing hit/miss-ringed nodes + "+N" compression at 30 opening a scrollable full-setlist sheet (SHOW-08)
  - TallyReadout — persistent {hits}/{total} · {pct}% with tabular-nums + 0/0 · — zero-state (SHOW-09)
  - TrailNodeSheet — edit / destructive-confirm delete / rename-??? from a trail tap (SHOW-07/D-15)
  - deleteEntry(id) db helper — confirm-gated older-entry delete
affects: [phase-05-live-sync-export, phase-06-pokedex]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Comet trail + tally are dumb components fed useShowSession's live entries/tally — Dexie stays the single source of truth; the trail, tally, and +N threshold all recompute automatically after any log/undo/edit (SHOW-08/09/11)"
    - "D-15 destructive split encoded structurally: one-tap Undo (undoLast, no dialog) in ActionBar vs confirm-gated deleteEntry in TrailNodeSheet — the two removal paths never share a control"
    - "Edit and rename-??? share one write path: both re-pick via the core SearchSheet and call renameEntry(id, songId, songName), which also clears isPlaceholder (D-14/D-15)"
    - "Hit/miss ring hexes (B2 #22C55E/#EF4444) live beside the trail (mirroring tuningColor.ts) — semantic data colors, not config.show model tunables; trail node visual diameters DO live in config.show (mirroring ORB_MIN_DIAMETER)"
    - "kglw-origin song names render as React text only across CometTrail + TrailNodeSheet — never dangerouslySetInnerHTML (T-04-14)"

key-files:
  created:
    - packages/app/src/show/CometTrail.tsx
    - packages/app/src/show/TallyReadout.tsx
    - packages/app/src/show/TrailNodeSheet.tsx
    - packages/app/test/actionBar.test.tsx
    - packages/app/test/cometTrail.test.tsx
    - packages/app/test/tallyReadout.test.tsx
    - packages/app/test/trailNodeSheet.test.tsx
  modified:
    - packages/app/src/show/ActionBar.tsx
    - packages/app/src/show/ShowView.tsx
    - packages/app/src/db/db.ts
    - packages/app/src/config.ts
    - packages/app/test/showSession.test.ts

key-decisions:
  - "TallyReadout (+ auto-stamped date) mounted in a ShowView region-1 sub-header, NOT the AppShell app-global header: AppShell's header is shared chrome with no injection seam, so ShowView owns the show-specific header row per UI-SPEC region 1 (date left, tally right)"
  - "The '+N' full-setlist expansion is built as a small FullSetlistSheet inside CometTrail (AppMenu overlay idiom), listing every entry newest-first with ring + set number; each row taps through to the same TrailNodeSheet path"
  - "Edit (normal entry) and rename (??? placeholder) both route through renameEntry — no separate 'editEntry' helper — since renameEntry(id, songId, songName) already re-points songId/songName and clears isPlaceholder"
  - "Added config.copy.show.editCta ('Edit') and config.show.TRAIL_NODE_MIN/MAX_DIAMETER — CLAUDE.md forbids scattered copy/magic-numbers; the UI-SPEC copy table lacked an Edit label and a trail-node diameter (Rule 2 missing copy/constant, mirroring 04-05's searchCta)"
  - "ActionBar-wiring assertions split across two files: button→callback render tests in the new actionBar.test.tsx (JSX can't live in the .ts showSession suite), and callback→db-helper→behavior flow tests extended into showSession.test.ts's set-structure/undo blocks"
  - "TrailNodeSheet unit-tested with mocked db + SearchSheet to prove the confirm-before-delete split and rename→renameEntry wiring WITHOUT importing the @matrix bundle alias (unresolved under the vitest app project)"

requirements-completed: [SHOW-06, SHOW-07, SHOW-08, SHOW-09]

# Metrics
duration: 12min
completed: 2026-07-09
---

# Phase 4 Plan 06: Setlist Structure & History Views Summary

**The ActionBar secondary row goes live (Set break/Encore snapshot the round-trippable set number without ending the show, D-04; one-tap Undo with no dialog, D-15), and three reactive history components mount in ShowView: the CometTrail (last ~4 diminishing hit/miss-ringed nodes with a tappable "+N" full-setlist sheet at 30+ songs, SHOW-08), the persistent tabular-nums TallyReadout (0/0 · — zero-state, SHOW-09), and the TrailNodeSheet (edit / destructive-confirm delete / rename-??? , SHOW-07/D-15) — all fed by useShowSession so the trail and tally recompute automatically after any edit; 170 workspace tests green, typecheck clean, production build succeeds.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-09T12:53:51Z
- **Completed:** 2026-07-09T13:06:09Z
- **Tasks:** 3
- **Files:** 12 (7 created, 5 modified)

## Accomplishments

- **Task 1 — ActionBar secondary row wired:** activated the three placeholder buttons from 04-05 with `onSetBreak`/`onEncore`/`onUndo` callbacks, bound in ShowView to `markSetBreak`/`markEncore`/`undoLast`. Set break/Encore only shift the show's snapshotted `currentSetNumber` (subsequent logs stamp `"2"`/`"e"`, SHOW-06) and never touch show status (D-04). Undo removes the most-recent entry in one tap with NO dialog (the common "oops", D-15) — the write-through recenters via `useLiveQuery`. Buttons stay `text-primary` (never accent). Added component render tests (button→callback wiring, no confirm dialog on Undo) plus flow assertions extended into the existing `set-structure`/`undo` blocks (setNumber snapshot through the UI flow; undo removes only the newest and leaves the show active).
- **Task 2 — CometTrail + TallyReadout:** `CometTrail` renders the last `TRAIL_VISIBLE_RECENT` (config, 4) entries as diminishing circles (oldest smallest → most-recent largest), each wearing a hit-green/miss-red ring derived from `entry.outcome` (D-06/D-08, B2 hexes). At `TRAIL_COMPRESS_AT` (config, 30) the older overflow collapses into a tappable `+N` chip opening a scrollable full-setlist sheet. The strip is fixed-height, horizontally scrollable, and never wraps into the fan; every node and the chip are ≥44px. `TallyReadout` renders `{hits}/{total} · {pct}%` with `tabular-nums` and the `0/0 · —` zero-state, `text-primary` never accent (SHOW-09). Both mounted in ShowView — the tally in a new region-1 sub-header (date left, tally right), the trail as region 2 above the orbit.
- **Task 3 — TrailNodeSheet:** an AppMenu-idiom bottom sheet opened by a trail node tap. A normal entry offers **Edit** (re-pick via SearchSheet) and **Delete** (destructive, confirm-gated — the D-15 split from one-tap Undo); a `???` placeholder offers **Name this song** (rename via SearchSheet → `renameEntry`, clearing `isPlaceholder`) and **Skip**. Added `deleteEntry(id)` to db.ts. Edit and rename share the single `renameEntry` write path. Deleting recomputes the derived tally automatically via `useLiveQuery`. Song names render as React text only (T-04-14). Unit-tested with mocked db + SearchSheet.

## Task Commits

1. **Task 1 — ActionBar secondary row (Set break/Encore/Undo)** — `94ae7bd` (feat)
2. **Task 2 — CometTrail + TallyReadout mounted in ShowView** — `2e509fb` (feat)
3. **Task 3 — TrailNodeSheet edit/delete/rename** — `0491350` (feat)

_Plan metadata (SUMMARY/STATE/ROADMAP/REQUIREMENTS) committed separately._

## Deviations from Plan

### Auto-added missing copy / constants (Rule 2)

**1. [Rule 2 — missing copy] Added `config.copy.show.editCta` ("Edit")**
- **Found during:** Task 3.
- **Issue:** The UI-SPEC Component Inventory lists TrailNodeSheet "Edit / delete / rename" but the Copywriting table gives no **Edit** button label; CLAUDE.md forbids hardcoding Show-Mode strings.
- **Fix:** Added `editCta: "Edit"` to `config.copy.show` (mirrors 04-05's `searchCta` precedent); TrailNodeSheet reads it.
- **Files:** `packages/app/src/config.ts`, `packages/app/src/show/TrailNodeSheet.tsx`
- **Commit:** `0491350`

**2. [Rule 2 — no scattered magic numbers] Added `config.show.TRAIL_NODE_MIN/MAX_DIAMETER`**
- **Found during:** Task 2.
- **Issue:** The diminishing trail-node circle sizes are visual constants; CLAUDE.md mandates all such numbers live in config (ORB diameters already do).
- **Fix:** Added `TRAIL_NODE_MIN_DIAMETER: 24` / `TRAIL_NODE_MAX_DIAMETER: 40` to `config.show`; CometTrail's `nodeDiameter` reads them.
- **Files:** `packages/app/src/config.ts`, `packages/app/src/show/CometTrail.tsx`
- **Commit:** `2e509fb`

### Layout / architecture reconciliations (not scope changes)

**3. TallyReadout in a ShowView region-1 sub-header, not the AppShell header**
- The plan said "TallyReadout in the header top-right." AppShell's header is app-global chrome (wordmark + menu) with no injection seam, so a literal placement there is impossible without prop-threading through AppShell. Rendered a show-specific region-1 sub-header inside ShowView (date left, persistent tally right) per UI-SPEC region 1, which co-locates the date stamp there too. Consistent with 04-05's in-flow ActionBar reconciliation.

**4. Test file split for ActionBar-wiring assertions**
- The plan asked to extend `showSession.test.ts` (a `.ts` file) with ActionBar-wiring assertions. JSX cannot live in a `.ts` file, so the button→callback render tests went in a new `actionBar.test.tsx`, while the callback→db-helper→behavior flow tests were extended into the existing `set-structure`/`undo` `it` blocks of `showSession.test.ts` (so the `-t "set-structure"`/`-t "undo"` filters still resolve). Together they cover the full wiring.

No Rule 1 (bug), Rule 3 (blocking), or Rule 4 (architectural) fixes were required.

## Threat Model Coverage

- **T-04-13 (set-structure serialization tampering):** mitigated — set numbers are authored only from the closed `"1"|"2"|"e"` union via `markSetBreak`/`markEncore`; entries snapshot `currentSetNumber` (never inferred from `transition_id`), and the extended `set-structure` test asserts grouping round-trips the kglw encoding.
- **T-04-14 (XSS via trail/sheet captions):** mitigated — every song name in CometTrail, the full-setlist sheet, and TrailNodeSheet renders as React text (`{entry.songName}`); no `dangerouslySetInnerHTML` anywhere in this plan.
- **T-04-15 (repudiation / data loss — delete vs undo):** mitigated — destructive `deleteEntry` requires an explicit confirm dialog, while one-tap Undo remains bounded to the most-recent entry only (D-15); the two paths are separate controls, asserted in the trailNodeSheet + actionBar tests.

No new security surface introduced (Phase 4 is fully offline; no network, no new dependencies).

## Manual Verification Deferred (per VALIDATION, config human_verify_mode: end-of-phase)

On device (SHOW-06/07/08/09 perceptual): mark a set break then encore → later entries group under set 2 / encore and round-trip on export; log several hits and misses → trail nodes show correct green/red rings and diminish, the tally updates live; Undo removes the newest in one tap; tap an older node → edit/delete sheet, delete asks to confirm then removes it and the tally recomputes; tap a ??? node → rename via search or Skip; simulate a 30+ song set → older history collapses to a tappable +N opening the full setlist. Carried to the phase's end-of-phase human-verify gate.

## Next Phase Readiness

- The full Show-Mode tracking loop is now complete and correctable: opener seed + hit/miss logging (04-04/05), set structure + encore, one-tap undo, older-entry edit/delete/rename, persistent tally, and the comet trail with compression. What remains for the phase: End Show finalize + wake lock (if not yet landed in a sibling plan).
- **Phase 5 (live sync / export):** `deleteEntry` may leave position gaps — export must re-derive contiguous positions (already noted in the db.ts JSDoc). The set-structure snapshot on every entry is the round-trippable basis for the kglw-encoded export.
- Full workspace suite green: **170 tests / 24 files**; `tsc -p packages/app --noEmit` clean; `vite build` succeeds (12 precache entries / 782 KiB, matrix bundle-included).

## Self-Check: PASSED

- FOUND: packages/app/src/show/CometTrail.tsx
- FOUND: packages/app/src/show/TallyReadout.tsx
- FOUND: packages/app/src/show/TrailNodeSheet.tsx
- FOUND: packages/app/src/db/db.ts (deleteEntry)
- FOUND: packages/app/test/actionBar.test.tsx, cometTrail.test.tsx, tallyReadout.test.tsx, trailNodeSheet.test.tsx
- FOUND commit: 94ae7bd (feat), 2e509fb (feat), 0491350 (feat)

---
*Phase: 04-show-mode*
*Completed: 2026-07-09*

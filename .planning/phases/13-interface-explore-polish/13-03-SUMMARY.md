---
phase: 13-interface-explore-polish
plan: 03
subsystem: ui
tags: [live-sync, suggestions, fill-hint, pure-core, tdd, vitest]

# Dependency graph
requires:
  - phase: 05-live-sync-data-safety
    provides: "resolvePlaceholders / FillHint (D-04 fill-hint scaffold)"
  - phase: 11-live-sync-prediction-correctness
    provides: "guardLatestRows once-at-ingress filter + diffLatestAgainstTrail by-songId keying idiom"
provides:
  - "resolvePlaceholders rewritten to interval-count-match subsequence anchoring (matches by songId, not raw position) — fill-hints never name an off-by-N song after a skipped/deleted trail entry (UX-03)"
  - "Six new regression fixtures locking correct-bracket-or-suppress behavior across position gaps, skips, count mismatch, absent/out-of-order anchors, and trailing-tail mismatch"
affects: [live-sync, show-mode, fill-hint, suggestion-strip]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conservative-suppress: emit a correct bracketed hint or nothing — never a coin-flip guess"
    - "Anchor-by-songId subsequence bracketing (reuses diffLatestAgainstTrail's by-song_id keying) to reconcile monotonic-gapped trail positions against contiguous editor positions"

key-files:
  created: []
  modified:
    - "packages/core/src/live/suggest.ts (resolvePlaceholders reimplemented; FillHint interface + signature unchanged)"
    - "packages/core/test/suggest.test.ts (six new UX-03 regression fixtures)"

key-decisions:
  - "UX-03: resolvePlaceholders anchors ??? placeholders between logged trail entries matched by songId, not by raw position — trail TrackedEntry.position is monotonic max+1 and gaps on skipped/deleted entries while editor LatestSetlistRow.position is contiguous, so the old row.position===entry.position matcher named an off-by-N song after the first divergence"
  - "Conservative-suppress posture (D-03): a hint is emitted only when a bounded interval's placeholder count equals its editor-row count; any count mismatch, absent-from-editor anchor, or out-of-order anchor suppresses (safe fallback: suppress everything)"
  - "FillHint.entryPosition stays the placeholder's own position (the renameEntry handle); position/songId/songName come from the bracketed editor row, never the raw same-position row"

patterns-established:
  - "Interval-count-match subsequence anchoring: sort both sequences, build strictly-increasing-editor-index anchors by songId, partition into head/mid/tail intervals, emit 1:1 only on per-interval count match"

requirements-completed: [UX-03]

# Metrics
duration: ~12min
completed: 2026-07-19
---

# Phase 13 Plan 03: Fill-Hint Off-by-N Fix (UX-03) Summary

**resolvePlaceholders rewritten to interval-count-match subsequence anchoring — fill-hints now name the correctly bracketed song (matched by songId, not raw position) after skipped/deleted trail entries, or emit nothing, never an off-by-N song one tap from a wrong renameEntry.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-07-19
- **Tasks:** 2 (TDD: RED test fixtures → GREEN implementation)
- **Files modified:** 2

## Accomplishments
- Root-caused and fixed the off-by-N fill-hint bug (UX-03): the old `row.position === entry.position` matcher paired a `???` placeholder to a `latest` editor row by raw position, but trail positions gap on skipped/deleted entries while editor positions stay contiguous — so after the first divergence the hint confidently named the wrong song.
- Rewrote `resolvePlaceholders` as interval-count-match subsequence anchoring: anchors are logged trail entries matched to editor rows **by songId** and required to form a strictly-increasing editor-index subsequence; placeholders are bracketed between consecutive anchors (including head and tail) and named 1:1 **only** when the interval's placeholder count equals its editor-row count, otherwise suppressed.
- Added six regression fixtures encoding correct-bracket-or-suppress across: deleted mid-trail entry, skipped song (resolves to B, not C), count mismatch, absent-from-editor anchor, out-of-order anchor, and trailing-tail mismatch — plus an explicit contiguous gap-free regression.
- Preserved the `FillHint` interface and the exported signature unchanged; kept the change pure-core (zero DOM, zero db import); all four pre-existing `resolvePlaceholders` tests stay green.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 (RED): position-gap / skipped-song regression fixtures** — `192e07e` (test)
2. **Task 2 (GREEN): interval-count-match anchoring rewrite** — `204c0bd` (feat)

_No REFACTOR commit — the GREEN implementation was already clean._

## Files Created/Modified
- `packages/core/src/live/suggest.ts` — `resolvePlaceholders` reimplemented (sort copies by position; anchor logged entries by songId into a strictly-increasing editor-index subsequence; partition into head/mid/tail intervals; emit 1:1 only on per-interval count match, else suppress). Doc comment updated to describe the conservative-suppress contract, replacing the stale "SAME position" comment. `FillHint` / `TrailEntryInput` interfaces and the exported signature untouched.
- `packages/core/test/suggest.test.ts` — six new fixtures in the existing `describe("resolvePlaceholders (D-04)")` block, asserting resolved `songId` (and `entryPosition`/`position` where they disambiguate) so a wrong-song match fails loudly.

## Decisions Made
- None beyond the plan — followed the resolved UX-03 decision (interval-count-match subsequence anchoring, conservative-suppress) exactly as specified in the plan objective.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The worktree spawned without a `node_modules` and briefly at an older base commit; both were pre-execution environment conditions, not code problems. The branch was aligned to the expected base `241a964` via a fast-forward `git reset --hard` (clean tree, ancestor-only, sanctioned agent-startup step), and dependencies were made available by junctioning the worktree's `node_modules` to the already-installed root `node_modules` (npm-workspaces root layout; `node_modules` is gitignored, so nothing leaked into the commit). No source changes resulted.
- The plan's `--project core` filter does not match the configured project name; the vitest project is named `@guezzer/core`. Used `--project @guezzer/core`.

## Verification
- `npx vitest run --project @guezzer/core suggest` — 28 passed (6 new fixtures went RED before Task 2, GREEN after; all four pre-existing `resolvePlaceholders` assertions stayed green throughout).
- `npx vitest run --project @guezzer/core` (full core suite) — 335 passed; core `tsc --noEmit` exits 0 (erasableSyntaxOnly respected — no enum/namespace).
- `npx vitest run` (full repo, both projects) — 634 passed. No ripple into `diffLatestAgainstTrail` / `guardLatestRows` or the app tier.
- No app import added to `packages/core`; `FillHint` interface unchanged.

## Next Phase Readiness
- UX-03 is fully automated (pure-core) — no device UAT item required per the plan.
- Fill-hints in Show Mode now name the correct song after gaps or emit nothing; the app tier consumes `resolvePlaceholders` through the unchanged signature, so no app-side change is needed.

---
*Phase: 13-interface-explore-polish*
*Completed: 2026-07-19*

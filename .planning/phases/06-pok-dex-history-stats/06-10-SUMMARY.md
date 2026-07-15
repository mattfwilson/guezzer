---
phase: 06-pok-dex-history-stats
plan: 10
subsystem: dex-compare
tags: [pokedex, compare, friend-file, d-17, share, react, tdd, pure-core]

# Dependency graph
requires:
  - phase: 06-pok-dex-history-stats
    plan: 03
    provides: deriveDex / DexStats (perSong tiers, completion, showCount) — compareDexes diffs two of these; DexSnapshotInput the friend envelope feeds
  - phase: 06-pok-dex-history-stats
    plan: 06
    provides: DexView / TierBadge / useDexStats surface CompareView reuses
  - phase: 06-pok-dex-history-stats
    plan: 07
    provides: envelope v2 owner fork key + exportEnvelope zod gate + snapshot()/db.snapshot the fork validates against
provides:
  - "compareDexes(mine, theirs) — pure read-only songId diff + You-vs-them stat columns (never merges)"
  - "classifyImport(rawJson, localOwnerName) — the D-17 compare-vs-merge fork (invalid/mine/friend/unowned) AFTER zod, BEFORE any write"
  - "CompareView — read-only friend trophy case (second deriveDex + diff, zero DB writes, escaped names)"
  - "config.copy.compare.* copy block"
affects: [06-11 share card reuses derived dex stats + the compare/share copy family]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "compareDexes is the structural INVERSE of parseAndMergeImport: same songId identity discipline, never merges/writes"
    - "Fork-before-merge (RESEARCH Pattern 5): classifyImport validates + forks on envelope.owner BEFORE parseAndMergeImport/importSnapshot are reachable — D-17 is structural, not behavioral"
    - "CompareView runs deriveDex a SECOND time over the friend envelope (v2 is a DexSnapshotInput superset) — zero DB writes by construction"

key-files:
  created:
    - packages/core/src/dex/compare.ts
    - packages/core/test/dex/compare.test.ts
    - packages/app/src/dex/CompareView.tsx
    - packages/app/test/importFork.test.ts
    - packages/app/test/compareView.test.tsx
  modified:
    - packages/core/src/index.ts
    - packages/app/src/settings/importPicker.ts
    - packages/app/src/settings/SettingsView.tsx
    - packages/app/src/config.ts

key-decisions:
  - "compareDexes takes two already-derived DexStats and returns songId-only diff lists (onlyMine/onlyTheirs/shared) tier-sorted legendary-first — names resolve in the view (core stays name-free; matrix has duplicate names)"
  - "classifyImport added as the NEW fork seam; pickAndImport kept VERBATIM (still commits the merge) so it is called ONLY for the 'mine' kind — friend/unowned carry the parsed envelope out to the compare path and never touch a DB"
  - "CompareView mounted from SettingsView component state (the fork originates in #/settings) as a full-screen overlay — simplest host; DexView was NOT modified (plan-listed but unnecessary)"
  - "Unowned (owner null / v1) files prompt 'Whose dex is this?' with a name field + an explicit 'It's mine — merge it' escape; a name matching the local owner routes to merge, any other opens compare"

requirements-completed: [SHAR-01]

# Metrics
duration: 7min
completed: 2026-07-15
---

# Phase 6 Plan 10: Friend Compare (D-17) Summary

**The friend-compare half of the phase's social payoff: the pure-core `compareDexes` songId diff (structural inverse of the merge — never writes), the `classifyImport` fork that validates then routes on `envelope.owner` BEFORE any merge code is reachable (so a friend's file is structurally incapable of inflating your counts, D-17), and the read-only `CompareView` that runs `deriveDex` a second time over the friend's parsed envelope and renders You-vs-{name} columns + tier-sorted diff lists with zero DB writes. TDD RED→GREEN per task.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-07-15T03:23:23Z
- **Completed:** 2026-07-15T03:30:03Z
- **Tasks:** 2 (each TDD: failing test → implementation)
- **Files:** 9 (5 created, 4 modified)

## Accomplishments

### Task 1 — Core `compareDexes` (SHAR-01, D-17)
- `packages/core/src/dex/compare.ts`: `compareDexes(mine: DexStats, theirs: DexStats): CompareResult`. Pure set arithmetic over the two `perSong` maps (caught = sightings > 0), keyed **strictly by songId** (never name — matrix has duplicate names). Returns `columns.{mine,theirs}` (completion %, caught, shows, per-tier counts) + `onlyMine`/`onlyTheirs`/`shared` songId lists sorted **rarest-tier-first** (legendary → common → untiered) then songId for trophy browsing.
- Read-only: neither input mutated (deep-equal before/after pinned). No import from `data-safety/merge.ts` or any DB — the structural inverse of merge.
- Barrel-exported `compareDexes` / `CompareResult` / `CompareColumn`.

### Task 2 — Import fork + CompareView (D-17, RESEARCH Pattern 5)
- `classifyImport(rawJson, localOwnerName)` in `importPicker.ts`: runs `JSON.parse` + `exportEnvelope.safeParse` FIRST, then forks on `envelope.owner` vs the trimmed/case-insensitive local owner → `{ invalid | mine | friend | unowned }`. Only `mine` ever flows to the untouched `pickAndImport` (Phase-5 merge VERBATIM); `friend`/`unowned` carry the parsed envelope out — the compare path never reaches `parseAndMergeImport`/`importSnapshot`.
- `SettingsView` routes the four kinds: `invalid` → existing rejection copy; `mine` → merge; `friend` → open `CompareView`; `unowned` → "Whose dex is this?" bottom-sheet prompt (name field + "It's mine — merge it" escape) whose answer routes to merge or compare.
- `CompareView.tsx`: reads your live dex via `useDexStats`, runs `deriveDex` a **second time** over the friend envelope (v2 is a `DexSnapshotInput` superset), `compareDexes`-diffs them, and renders the persistent D-17 banner ("Viewing {name}'s dex — nothing was added to yours."), You-vs-{name} `tabular-nums` stat columns, and three collapsible tier-sorted diff sections with `TierBadge`s. Song + owner names render as escaped React text, CSS-clamped. Imports **no** write helper.
- `config.copy.compare` block (banner, column headings, diff headings, prompt, close).

## Task Commits

TDD RED (test) → GREEN (feat) per task:

1. **Task 1 RED:** failing compareDexes diff test — `82f4260` (test)
2. **Task 1 GREEN:** pure compareDexes + barrel export — `d87c549` (feat)
3. **Task 2 RED:** failing classify + zero-writes test — `506dab6` (test)
4. **Task 2 GREEN:** import fork + CompareView + copy — `8ea7b9f` (feat)

## Decisions Made

- **`compareDexes` is name-free.** Diff lists are `songId[]`; the view resolves display names from `archive.songs`. Keeps core free of the matrix's duplicate-name hazard and matches the merge-side identity discipline (songId only).
- **`pickAndImport` left VERBATIM; `classifyImport` is the new fork seam.** The five existing `exportImportRoundtrip.test.ts` merge assertions stay green because their (unowned/own) files still merge through the unchanged `pickAndImport` — the fork routing lives in `SettingsView`, which calls `pickAndImport` only for the `mine` kind. This preserves the D-17 structural guarantee without disturbing the Phase-5 merge contract.
- **CompareView hosted by SettingsView, not DexView.** The import fork originates in `#/settings`; mounting the read-only overlay from `SettingsView` component state is the simplest host and needs no cross-view plumbing.

## Deviations from Plan

### Structural / host adjustments

**1. [Rule 3 — Structural] `classifyImport` added alongside an unchanged `pickAndImport` (not a `pickAndImport` refactor that returns friend/unowned)**
- **Found during:** Task 2. The plan's action text suggested refactoring `pickAndImport` to return the friend/unowned outcomes, but `pickAndImport(file): Promise<ImportResult>` is called by five green `exportImportRoundtrip.test.ts` assertions that expect merge behavior for owner-null files. Widening its return would break them.
- **Fix:** Added `classifyImport` as the tested fork seam and kept `pickAndImport` byte-for-byte (the merge commit). `SettingsView` calls `pickAndImport` only for `mine`. This satisfies "merge path still green for 'mine'" and "friend path never reaches the writers" while preserving the Phase-5 contract.
- **Files:** importPicker.ts, SettingsView.tsx. **Commit:** `8ea7b9f`.

**2. [Rule 2 — Coverage] `CompareView` mounted from SettingsView; `DexView.tsx` NOT modified**
- **Reason:** The plan's `files_modified` listed `packages/app/src/dex/DexView.tsx` and `packages/app/src/config.ts` (core) but the import fork originates in Settings. CompareView is mounted from `SettingsView` component state (the "simplest host consistent with the drill-in pattern" the action text also allowed). `DexView.tsx` needed no change. The plan also listed `packages/core/src/config.ts` under `files_modified`, but no core config change was required (rarity thresholds already exist from 06-01/06-03; compare copy lives in **app** config per the copy-family convention).
- **Commit:** `8ea7b9f`.

**3. [Rule 2 — Coverage] Added `packages/app/test/compareView.test.tsx` (beyond the plan's file list)**
- **Reason:** Task 2 acceptance requires "CompareView renders the banner string from config" and the D-17 zero-writes proof. A dedicated render test pins the banner, the You-vs-{name} columns, the tier-sorted diff rows (names from the archive), and re-snapshots every table before/after render to prove zero writes — a stronger guarantee than a source grep alone.
- **Commit:** `8ea7b9f`.

## Threat Model Coverage

- **T-06-24 (attendance inflation):** mitigated structurally — `classifyImport` forks a friend file before `parseAndMergeImport`/`importSnapshot` are reachable; the `importFork.test.ts` + `compareView.test.tsx` before/after table deep-equals pin zero writes.
- **T-06-25 (prototype pollution / oversized fields):** the strict `exportEnvelope.safeParse` whole-file gate runs BEFORE any fork routing; owner is `.max(40)` clamped (06-07).
- **T-06-26 (XSS via owner + song names):** CompareView renders every untrusted string as escaped React text with CSS truncation — grep-verified no `dangerouslySetInnerHTML`/`innerHTML`.
- **T-06-SC (supply chain):** no new dependencies.

## Known Stubs

None. The share-card half of the compare/share payoff (SHAR-02) is a documented deferral to 06-11 (the compare copy family already reserves the `friendOpening`/name-prompt strings). The compare view and fork are fully wired to live derived data.

## Verification

- `npx vitest run --project @guezzer/core test/dex/compare.test.ts` — 4/4 green.
- `npx vitest run --project @guezzer/app test/importFork.test.ts test/compareView.test.tsx` — 11/11 green.
- `npx vitest run` (full repo) — **455 tests green (59 files)**; +34 over the 06-09 baseline (421).
- `npx tsc --noEmit -p packages/core/tsconfig.json` and `-p packages/app/tsconfig.json` — both clean (envelope v2 stays structurally assignable to DexSnapshotInput).
- grep: `compare.ts` has no db/merge imports (comment matches only); `CompareView.tsx` imports/calls no write helper (comment match only).
- Dev-server friend-fixture spot check: deferred (autonomous run, no device gate this plan) — the zero-writes invariant is unit-proven by two independent before/after table deep-equals.

## Self-Check: PASSED

All 5 claimed created files exist on disk; all 4 task commits (`82f4260`, `d87c549`, `506dab6`, `8ea7b9f`) exist in git history. Core suite green, full repo 455/455 green, both typechecks clean.

## TDD Gate Compliance

Each task followed RED (a committed failing `test(...)`) → GREEN (`feat(...)`). Gate commits present: Task 1 `82f4260`→`d87c549`; Task 2 `506dab6`→`8ea7b9f`. No refactor commits needed.

---
*Phase: 06-pok-dex-history-stats*
*Completed: 2026-07-15*

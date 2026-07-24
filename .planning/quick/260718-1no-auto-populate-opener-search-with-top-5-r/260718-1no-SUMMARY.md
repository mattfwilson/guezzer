---
status: complete
phase: quick-260718-1no
plan: 01
subsystem: show-mode
tags: [opener-suggestions, search, core-derivation, recency-weighted]
requires:
  - packages/core/src/dex/archive-types.ts (ArchiveShow)
  - packages/core/src/model/decay.ts (decayedWeight)
  - packages/app/src/dex/archive-loader.ts (loadArchive)
provides:
  - deriveTopOpeners (pure core recency-weighted opener ranking)
  - getOpenerSuggestions (memoized app wrapper)
  - SearchSheet pre-opener suggestions branch
affects:
  - packages/app/src/show/ShowView.tsx (pre-opener SearchSheet wiring)
tech-stack:
  added: []
  patterns:
    - pure-core derivation + fixture test (CLAUDE.md core/UI separation)
    - module-level memoization over the static bundled archive
    - single-config: count/heading in app config, halfLifeDays from core config
key-files:
  created:
    - packages/core/src/dex/openers.ts
    - packages/core/test/dex/openers.test.ts
    - packages/app/src/show/openerSuggestions.ts
  modified:
    - packages/core/src/index.ts
    - packages/app/src/config.ts
    - packages/app/src/show/SearchSheet.tsx
    - packages/app/src/show/ShowView.tsx
decisions:
  - "Opener rank = sum of decayedWeight(showDate, latestShowDate, halfLife) over each show a song opened; tie-break score desc → raw count desc → songId asc"
  - "Recency anchor is archive.latestShowDate passed in as asOfDate (pure/deterministic, no Date.now)"
  - "getOpenerSuggestions() is module-memoized (stable reference), so ShowView calls it as a plain const below its early returns — NOT a useMemo hook (avoids rules-of-hooks violation)"
metrics:
  duration: ~15min
  completed: 2026-07-18
  tasks: 3
  files: 7
---

# Quick 260718-1no: Auto-populate opener search with top-5 recency-weighted openers Summary

Pre-opener, the LiveGizz SearchSheet now auto-populates with the top 5 recency-weighted King Gizzard show openers under a "Popular openers" heading before any typing — typing runs the normal fuzzy catalog search, clearing returns to the suggestions, and selecting an opener logs it through the unchanged onSelect → handleSearchSelect → logSong path.

## What was built

**Task 1 — pure core `deriveTopOpeners` + fixture test (commit 7d893ae)**
- `packages/core/src/dex/openers.ts`: `deriveTopOpeners(shows, songs, { asOfDate, halfLifeDays, limit })` → `TopOpener[]` (`{ songId, songName, count, score }`). Opener = `show.sets.find(s => s.n === "1")?.songs[0]`; shows with no Set 1 / empty Set-1 skipped. Score = summed `decayedWeight`; deterministic sort (score desc → count desc → songId asc); score rounded via `config.weightedCountPrecision` for float-summation determinism. Zero React/DOM/Date.now.
- Barrel export added to `packages/core/src/index.ts`.
- `packages/core/test/dex/openers.test.ts`: 8 fixture tests — recency order, weight-beats-count, count-desc tie-break, songId-asc tie-break, limit, no-Set-1/empty-Set-1 edge, name-fallback edge, purity (deep-equal on repeat call).

**Task 2 — app config + memoized wrapper (commit d47f7fd)**
- `config.show.OPENER_SUGGESTION_COUNT: 5` and `config.copy.show.openerSuggestionsHeading: "Popular openers"`.
- `packages/app/src/show/openerSuggestions.ts`: `getOpenerSuggestions()` calls `loadArchive()`, returns `[]` on failure, else `deriveTopOpeners(archive.shows, archive.songs, { asOfDate: archive.latestShowDate, halfLifeDays: coreConfig.decayHalfLifeDays, limit: config.show.OPENER_SUGGESTION_COUNT })` mapped to `{ songId, songName }`. Module-level memoized (static archive). halfLifeDays sourced from `@guezzer/core/config`, never hardcoded.

**Task 3 — SearchSheet branch + ShowView wiring (commit 3421b20)**
- `SearchSheet.tsx`: optional `openerSuggestions?` prop; when `query.trim() === "" && openerSuggestions?.length`, renders the heading + suggestion rows reusing the exact existing result-row button markup/classes (song name as React text only — never dangerouslySetInnerHTML). Non-empty query → fuzzy results; clearing → suggestions; absent/empty prop → today's blank empty-query state.
- `ShowView.tsx`: `openerSuggestions={session.currentSongId === null ? openerSuggestions : undefined}` — suggestions pre-opener only; mid-show empty search stays blank.

## Deviations from Plan

**1. [Rule 3 — Blocking] Worktree module-resolution for the new core export**
- **Found during:** Task 2 (app typecheck)
- **Issue:** The worktree has no local `node_modules`; `@guezzer/core` resolved up-tree to the MAIN repo's symlinked `packages/core` (stale, lacking the new `deriveTopOpeners` export) → `TS2305 no exported member`.
- **Fix:** Created worktree-local junctions `node_modules/@guezzer/core` → `packages/core` and `node_modules/@guezzer/app` → `packages/app` so typecheck resolves against this worktree's core. Build-env only (node_modules is gitignored — NOT committed; resolves correctly once merged to master since the symlink target is then the same tree).
- **Files modified:** none committed.

**2. [Rule 1 — Bug] useMemo placed below early returns (rules-of-hooks)**
- **Found during:** Task 3 (first `npm test` run — recapView.test.tsx crashed with "Rendered more hooks than during the previous render")
- **Issue:** Initially wired the suggestions via `useMemo(() => getOpenerSuggestions(), [])` placed after ShowView's conditional early returns (recap / PreShowLauncher).
- **Fix:** `getOpenerSuggestions()` is already module-memoized (stable reference), so dropped the hook and call it as a plain const — no rules-of-hooks concern.
- **Files modified:** packages/app/src/show/ShowView.tsx
- **Commit:** 3421b20 (fix folded into the Task 3 commit before it was made)

## Verification

**App typecheck** — `npx tsc -p packages/app/tsconfig.json --noEmit`
```
APP_TSC_EXIT=0
```

**Core typecheck** — `npx tsc -p packages/core/tsconfig.json --noEmit`
```
CORE_TSC_EXIT=0
```

**Full test suite** — `npm test`
```
 Test Files  71 passed (71)
      Tests  527 passed (527)
```
(includes the new `packages/core/test/dex/openers.test.ts` — 8 tests — and configMirror.test.ts, both green. jsdom "Not implemented: navigation/getContext" lines are pre-existing environment warnings, not failures.)

## Self-Check: PASSED

- packages/core/src/dex/openers.ts — FOUND
- packages/core/test/dex/openers.test.ts — FOUND
- packages/app/src/show/openerSuggestions.ts — FOUND
- Commits 7d893ae, d47f7fd, 3421b20 — FOUND in git log

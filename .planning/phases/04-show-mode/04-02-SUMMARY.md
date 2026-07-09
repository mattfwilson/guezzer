---
phase: 04-show-mode
plan: 02
subsystem: api
tags: [fuse.js, fuzzy-search, core, typescript, tdd]

# Dependency graph
requires:
  - phase: 02-transition-matrix-model-backtest
    provides: MatrixNode domain type (songId + songName) as the catalog source
provides:
  - Pure DOM-free searchCatalog core API (toCatalog + makeCatalogSearcher) over the 264-song matrix catalog (SHOW-04)
  - config.search.{threshold, distance} tunables for fuse.js
  - fuse.js@7.4.2 in the core workspace
affects: [show-mode, miss-path, SearchSheet, orbit-recenter]

# Tech tracking
tech-stack:
  added: [fuse.js@7.4.2]
  patterns:
    - "Pure core lib-wrapper: fuse.js behind a swappable makeCatalogSearcher factory (mirrors tuning-tags.ts zod idiom)"
    - "Index-built-once/query-many searcher factory returning a memoizable closure"
    - "Search tunables centralized in config.search (no scattered magic numbers)"

key-files:
  created:
    - packages/core/src/search/search-catalog.ts
    - packages/core/test/search-catalog.test.ts
  modified:
    - packages/core/src/config.ts
    - packages/core/src/index.ts
    - packages/core/package.json

key-decisions:
  - "Catalog source is the existing MatrixNode[] (songId + songName) — no separate catalog file"
  - "fuse.js pinned exact (7.4.2, no caret) to match core's existing zod pin convention"
  - "Empty/whitespace query short-circuits to [] to avoid whole-catalog dumps in the one-thumb miss sheet"

patterns-established:
  - "Pure core lib-wrapper: fuse.js wrapped behind a swappable core function per CLAUDE.md"
  - "Searcher factory builds the Fuse index once, returns a (query) => SearchResult[] closure the caller memoizes"

requirements-completed: [SHOW-04]

# Metrics
duration: 8min
completed: 2026-07-09
---

# Phase 4 Plan 02: Catalog Fuzzy Search Summary

**Pure, DOM-free `searchCatalog` core API wrapping fuse.js@7.4.2 over the 264-node matrix catalog — exact-match-first, one-typo-tolerant, empty-query-safe (SHOW-04).**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-09T08:12:00Z
- **Completed:** 2026-07-09T08:15:30Z
- **Tasks:** 1 (TDD: RED → GREEN)
- **Files modified:** 5

## Accomplishments
- `toCatalog(nodes)` projects `MatrixNode[]` → `{ songId, songName }[]` losslessly
- `makeCatalogSearcher(catalog)` builds the Fuse index once and returns a memoizable `(query) => SearchResult[]`
- Exact match ranked first; one-character typo ("Ratlesnake") still surfaces the intended song; empty/whitespace query returns `[]`
- fuse.js threshold/distance sourced from a new `config.search` block — no inline literals
- Core barrel re-exports `makeCatalogSearcher`, `toCatalog`, `CatalogEntry`, `SearchResult`
- Core purity intact: `packages/core` typechecks clean under its ES2023/no-DOM/no-React tsconfig with fuse.js imported

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 (RED): failing searchCatalog test** - `2b0e908` (test)
2. **Task 1 (GREEN): implement searchCatalog** - `a23e130` (feat)

No REFACTOR commit — GREEN implementation was already clean.

## Files Created/Modified
- `packages/core/src/search/search-catalog.ts` - fuse.js wrapper: `toCatalog`, `makeCatalogSearcher`, `CatalogEntry`, `SearchResult`
- `packages/core/test/search-catalog.test.ts` - node-env unit test with a small fixture and known expected outputs
- `packages/core/src/config.ts` - added `search: { threshold: 0.4, distance: 100 }` block with JSDoc-per-key
- `packages/core/src/index.ts` - barrel export block for the search API
- `packages/core/package.json` - added `fuse.js` (pinned `7.4.2`)

## Decisions Made
- Catalog source is the existing `MatrixNode[]` (songId + songName), not a separate catalog file — matches RESEARCH Pattern 4.
- Pinned `fuse.js` exact (`7.4.2`, no caret) to match core's existing `zod` pin convention; reconciled the root lockfile.
- Empty/whitespace query short-circuits to `[]` (never a whole-catalog dump) — protects the one-thumb miss sheet.

## Deviations from Plan

None - plan executed exactly as written. (fuse.js was pre-verified CITED+VERIFIED per RESEARCH Package Legitimacy Audit — no package-legitimacy checkpoint required; install succeeded on first attempt.)

## Issues Encountered
- npm defaulted the install to `^7.4.2`; changed to exact `7.4.2` and re-ran `npm install` to reconcile the lockfile, matching the existing zod pin convention.

## TDD Gate Compliance
- RED gate present: `2b0e908` (`test(04-02): ...`) — 3 of 4 assertions failed as expected before implementation.
- GREEN gate present: `a23e130` (`feat(04-02): ...`) after RED — all 4 tests pass.
- Full suite: 139/139 tests pass; core typecheck exit 0.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SHOW-04 search engine is ready for the later Show Mode wave to wire into `SearchSheet.tsx` (miss path).
- No app files were touched — fully parallel with plan 04-01.

---
*Phase: 04-show-mode*
*Completed: 2026-07-09*

## Self-Check: PASSED

All created/modified files exist on disk; both task commits (2b0e908, a23e130) present in history.

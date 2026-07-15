---
phase: 06-pok-dex-history-stats
plan: 05
subsystem: app-dex-data
tags: [pokedex, loaders, useLiveQuery, reactive-derivation, vite-alias, covers, tdd]

# Dependency graph
requires:
  - phase: 06-pok-dex-history-stats
    plan: 01
    provides: data/normalized/archive.json + dex-albums.json artifacts, archive-types.ts zod schemas (ArchiveArtifact / DexAlbumsArtifact)
  - phase: 06-pok-dex-history-stats
    plan: 03
    provides: deriveDex + buildRarityIndex (the pure derivation this hook wraps)
  - phase: 06-pok-dex-history-stats
    plan: 04
    provides: packages/app/src/assets/covers/*.webp + covers-manifest.json (the covers asset module's glob source)
  - phase: 02-transition-matrix
    provides: show/matrix.ts + matrix-artifact.d.ts + vite.config.ts @matrix idiom
  - phase: 04-show-mode
    provides: show/useShowSession.ts (useLiveQuery + useMemo derivation idiom), db/db.ts tables
provides:
  - loadArchive / loadDexAlbums — guarded, memoized bundled-artifact loaders (schemaVersion sentinel, never throw)
  - "@archive / @dexAlbums Vite aliases + ambient declare modules (the @matrix idiom, second/third copies)"
  - coverUrlFor(slug) — slug→bundled-asset-URL via import.meta.glob, null → initials placeholder
  - useDexStats — reactive DexStatsResult hook (useLiveQuery over 3 tables + useMemo(deriveDex), no stored counts)
affects: [06-06 AlbumGrid/AlbumDetail/DexView render on these contracts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bundled-artifact loader = @matrix idiom per artifact: Vite alias + ambient declare module + guarded memoized loader with schemaVersion sentinel"
    - "Reactive dex = useLiveQuery(3 attendance tables) + useMemo(deriveDex); Dexie is the single source of truth, no useState mirror, unmark is free"
    - "Module-memoized buildRarityIndex(archive) — archive is static, corpus rescanned exactly once and shared by reference"
    - "coverUrlFor is manifest-agnostic: the import.meta.glob IS the truth; a missing .webp degrades to null (initials placeholder), never a broken image"

key-files:
  created:
    - packages/app/src/dex/dex-artifacts.d.ts
    - packages/app/src/dex/archive-loader.ts
    - packages/app/src/dex/dex-albums-loader.ts
    - packages/app/src/dex/covers.ts
    - packages/app/src/dex/useDexStats.ts
    - packages/app/test/dexView.test.tsx
  modified:
    - packages/app/vite.config.ts
    - vitest.config.ts

key-decisions:
  - "useDexStats returns a discriminated loading-safe shape { ready, error, dex, rarity, archive, albums }: loader failure surfaces { ready:false, error } with null data (T-06-12 calm error), liveQuery-undefined derives over empty tables (zero counts, ready:false)"
  - "Guards split into two `if (!x.ok)` returns (not `||`) so TypeScript narrows each discriminated union branch cleanly"
  - "Added @matrix/@archive/@dexAlbums resolve.alias to vitest.config.ts app project so alias-importing hooks are collectable under Vitest — previously @matrix was unresolved and tests avoided importing such modules"

requirements-completed: [DEX-03]

# Metrics
duration: 6min
completed: 2026-07-15
---

# Phase 6 Plan 05: Dex Data Foundation (App) Summary

**The dex data substrate every Pokédex surface consumes: `@archive`/`@dexAlbums` bundled-artifact loaders (the @matrix idiom — alias + ambient declare + guarded memoized `schemaVersion` sentinel that never throws), the `coverUrlFor` covers module (glob-driven slug→URL, null→initials placeholder), and the reactive `useDexStats` hook (useLiveQuery over the three attendance tables + `useMemo(deriveDex)` — Dexie is the single source of truth, zero stored counts). TDD RED→GREEN; a fake-indexeddb reactivity test proves a single `attendedShows` write recomputes the whole dex with no manual refresh.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-15T01:51:50Z
- **Completed:** 2026-07-15T01:57:03Z
- **Tasks:** 1 (TDD: failing test → implementation)
- **Files:** 8 (6 created, 2 modified)

## Accomplishments

- **`archive-loader.ts` / `dex-albums-loader.ts` (T-06-12):** `loadArchive()` / `loadDexAlbums()` mirror `show/matrix.ts` exactly — bundle-import the aliased artifact, guard `schemaVersion === 1`, and return a handled `{ ok:false, error }` sentinel on any mismatch. Memoized so the guard runs once. Never throw at the read site.
- **`dex-artifacts.d.ts`:** ambient `declare module "@archive"` / `"@dexAlbums"` typed as core's `ArchiveArtifact` / `DexAlbumsArtifact`, so tsc resolves the bundle imports across the core/app boundary without a relative path.
- **`vite.config.ts` aliases:** `@archive` / `@dexAlbums` point at the repo-root `data/normalized/archive.json` / `dex-albums.json` (the `fileURLToPath(new URL(...))` @matrix idiom). Both ride the JS bundle → precached by the existing `**/*.js` Workbox glob, no `json` glob edit needed (offline-complete).
- **`covers.ts`:** `import.meta.glob("../assets/covers/*.webp", { eager, query:"?url", import:"default" })` mapped to a slug→URL record; `coverUrlFor(slug)` returns the bundled URL or `null`. Manifest-agnostic — the glob is the truth, so buckets and any uncovered card degrade to the initials placeholder.
- **`useDexStats.ts` (DEX-03):** `useLiveQuery` reads of `attendedShows` / `trackedShows` / `trackedEntries` feed a `useMemo(deriveDex)` over the guarded artifacts and a module-memoized `buildRarityIndex`. No `useState` mirror; a mark/unmark write-through anywhere re-derives every count (D-12 "unmark is free"). Returns a loading-safe `{ ready, error, dex, rarity, archive, albums }` shape.

## Task Commits

TDD RED (test) → GREEN (feat):

1. **RED:** failing dex loader-guard + useDexStats reactivity test — `341e2d0` (test)
2. **GREEN:** loaders + aliases + ambient types + covers + hook — `bd6ccfa` (feat)

## Files Created/Modified

- `packages/app/src/dex/archive-loader.ts` — `ArchiveLoadResult`, guarded memoized `loadArchive`
- `packages/app/src/dex/dex-albums-loader.ts` — `DexAlbumsLoadResult`, guarded memoized `loadDexAlbums`
- `packages/app/src/dex/dex-artifacts.d.ts` — ambient `@archive` / `@dexAlbums` module declarations
- `packages/app/src/dex/covers.ts` — glob-driven `coverUrlFor(slug): string | null`
- `packages/app/src/dex/useDexStats.ts` — reactive `DexStatsResult` hook (useLiveQuery + useMemo(deriveDex))
- `packages/app/test/dexView.test.tsx` — reactivity + loader-guard test (extended in 06-06)
- `packages/app/vite.config.ts` — `@archive` / `@dexAlbums` aliases
- `vitest.config.ts` — app-project `resolve.alias` for `@matrix` / `@archive` / `@dexAlbums`

## Decisions Made

- **Loading-safe discriminated result.** `useDexStats` returns `{ ready, error, dex, rarity, archive, albums }`: a loader-guard failure yields `{ ready:false, error, dex:null, ... }` (the T-06-12 calm error consumers render), while a still-resolving `useLiveQuery` derives over empty tables (zero counts, no NaN) with `ready:false`. A resolved `[]` flips `ready` true.
- **Split guards for narrowing.** The two loader results are checked with separate `if (!x.ok) return` branches rather than `||`, so TypeScript narrows each `{ ok:true }` union member cleanly (a `||` disjunction left `.error` unreachable to the compiler).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added alias resolution to vitest.config.ts**
- **Found during:** Task 1 (making the reactivity test collectable)
- **Issue:** The plan's verify (`npx vitest run ... test/dexView.test.tsx`) imports `useDexStats`, which imports the loaders, which import `@archive` / `@dexAlbums`. Vitest uses its own `vitest.config.ts` (not `packages/app/vite.config.ts`), where those aliases did not exist — so the module was unresolvable and the file failed at collection. (The pre-existing `@matrix` alias had the same gap; earlier tests worked around it by never importing an alias-using module, per the `trailNodeSheet.test.ts` comment.)
- **Fix:** Added a `resolve.alias` block to the `@guezzer/app` project in `vitest.config.ts` mapping `@matrix` / `@archive` / `@dexAlbums` to the real committed artifacts. `vi.mock` still overrides them with tiny fixtures in the test, so the 141 KB artifacts are never loaded during the run.
- **Files modified:** vitest.config.ts
- **Verification:** `npx vitest run --project @guezzer/app test/dexView.test.tsx` — 3/3 green; full suite 359/359 green.
- **Committed in:** `bd6ccfa`

---

**Total deviations:** 1 auto-fixed (1 blocking). Pure test-harness plumbing to satisfy the plan's own verify gate; no behavioral change and no scope creep.

## Issues Encountered

- Root `npx tsc --noEmit` prints CLI help (no root tsconfig) — the project typechecks per-project (`packages/app/tsconfig.json`, `packages/app/tsconfig.node.json`, `packages/core/tsconfig.json`), all clean. Same note as 06-03.

## User Setup Required

None — app-only additions, no new dependencies or external services.

## Next Phase Readiness

- Plan 06-06 can render `DexView` / `AlbumGrid` / `AlbumDetail` directly on these contracts: `useDexStats()` for live counts, `coverUrlFor(slug)` for card thumbnails (null → initials), and the guarded loaders' `{ ok:false }` sentinel for the calm error state. The test file is seeded for 06-06 to extend.
- `archiveShows` (the online-fallback setlist cache) is intentionally omitted from the hook's `deriveDex` input — it joins in plan 06-08 when the `version(4)` table + retro-mark path land.
- No blockers.

## Known Stubs

None — the loaders, covers module, and hook are fully wired to the committed artifacts and live Dexie tables. `archiveShows` is a deliberate, documented deferral to 06-08 (optional in `DexSnapshotInput`), not a stub.

## TDD Gate Compliance

RED (`341e2d0` — a committed failing `test(...)`) → GREEN (`bd6ccfa` — `feat(...)`). No refactor needed. Both gate commits are present in git history.

## Verification

- `npx vitest run --project @guezzer/app test/dexView.test.tsx` — 3/3 green (reactive showCount/completion recompute + both loader sentinels).
- `npx vitest run` (full repo) — 359 tests green (48 files); +3 over the 06-04 baseline (356).
- `npx tsc --noEmit -p packages/app/tsconfig.json` and `-p packages/app/tsconfig.node.json` and `-p packages/core/tsconfig.json` — all clean.
- `grep useState packages/app/src/dex/useDexStats.ts` — only the doc-comment mention (no state mirror); the hook is `useLiveQuery` + `useMemo` only.

## Self-Check: PASSED

All 6 claimed created files exist on disk; both modified files carry the aliases; both task commits (`341e2d0`, `bd6ccfa`) exist in git history. App suite 3/3 for the new file, full repo 359/359 green, three typechecks clean.

---
*Phase: 06-pok-dex-history-stats*
*Completed: 2026-07-15*

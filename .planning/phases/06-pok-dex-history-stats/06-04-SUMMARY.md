---
phase: 06-pok-dex-history-stats
plan: 04
subsystem: app-assets
tags: [sharp, musicbrainz, cover-art-archive, build-time-pipeline, webp, pokedex, covers]

# Dependency graph
requires:
  - phase: 06-pok-dex-history-stats
    plan: 01
    provides: data/normalized/dex-albums.json (29 studio card albums drive the fetch list)
  - phase: 02-transition-matrix
    provides: packages/core/src/config.ts (userAgent, fetchDelayMs, fetchTimeoutMs) and the fetch-corpus paced-fetch idiom
provides:
  - packages/app/src/assets/covers/{slug}.webp — 29 committed 160x160 WebP album thumbnails (~195 KB total)
  - packages/app/src/assets/covers/covers-manifest.json — provenance (slug → CAA sourceUrl/mbid/fetchedAt)
  - packages/app/scripts/fetch-covers.ts — manual one-command MusicBrainz→CAA→sharp cover pipeline
  - "@guezzer/core/config" package subpath export
  - npm script fetch:covers; sharp@0.35.3 devDependency
affects: [06-06 AlbumGrid/AlbumDetail cover rendering]

# Tech tracking
tech-stack:
  added:
    - sharp@0.35.3 (devDependency, app) — build-time image resize/WebP encode
  patterns:
    - "One-time paced Node fetch script mirroring cli/fetch-corpus.ts (User-Agent + AbortSignal.timeout + strictly-sequential paceNextRequest), manual-run-only, never CI"
    - "External image bytes re-encoded through sharp before commit — never stored verbatim (T-06-09); hard-fail budget guard on output size"
    - "Provenance manifest (slug → source URL/mbid/fetchedAt) mirroring the fetch-meta.json idiom"
    - "Committed-asset guard test asserting per-file/total byte budgets + manifest↔asset parity + card-album membership"

key-files:
  created:
    - packages/app/scripts/fetch-covers.ts
    - packages/app/src/assets/covers/covers-manifest.json
    - packages/app/src/assets/covers/*.webp (29 files)
    - packages/app/test/coversManifest.test.ts
    - packages/app/tsconfig.node.json (renamed from tsconfig.scripts.json)
  modified:
    - packages/app/package.json (sharp devDep + fetch:covers script)
    - packages/core/package.json (./config subpath export)
    - packages/app/tsconfig.json (exclude the fs-based node test)
    - package-lock.json (sharp)

key-decisions:
  - "Cover source = MusicBrainz WS/2 + Cover Art Archive front-250 (documented D-03 discretion call; kglw.net has no image field and scraping is forbidden by etiquette)"
  - "Exposed config via a @guezzer/core/config subpath rather than the full barrel — config.ts has zero imports, so the one-time script loads two constants without pulling the entire core graph"
  - "fs-based asset-guard test typechecked in a dedicated node-context tsconfig; excluded from the DOM-typed browser tsconfig so app src never gains node globals"
  - "Per-album fetch failures skip+warn (placeholder fallback, A2); only an over-budget (>25 KB) output hard-fails (process.exit 1) — the accidental-full-res tripwire"

requirements-completed: [DEX-04]

# Metrics
duration: 13min
completed: 2026-07-15
---

# Phase 6 Plan 04: Album Cover Pipeline Summary

**A manual, paced MusicBrainz→Cover Art Archive→sharp pipeline fetched all 29 studio-discography card-album covers once at build time, re-encoded them to 160×160 WebP (largest 11.5 KB, ~195 KB total), and committed them with a provenance manifest and a five-assertion budget-guard test — the offline-first "album shelf's face" for the D-01 card grid.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-07-15T01:31:01Z
- **Completed:** 2026-07-15T01:43:47Z
- **Tasks:** 2
- **Files modified:** 38 (34 created incl. 29 covers, 4 modified)

## Accomplishments
- `packages/app/scripts/fetch-covers.ts`: a one-time, manual Node script (never CI/build/refresh) that queries MusicBrainz WS/2 release-group search with `config.userAgent`, strictly-sequential ≥`config.fetchDelayMs` (2s) pacing and `AbortSignal.timeout`, follows the top-scored MBID to Cover Art Archive `front-250`, re-encodes the bytes through `sharp().resize(160,160).webp({quality:70})`, and hard-fails (process.exit 1) if any output exceeds the 25 KB budget. Supports `--force` and idempotent skip of existing covers.
- All **29 card albums resolved** on the first run (KGLW is heavily documented on MusicBrainz) — 0 no-match, 0 no-art. Every cover is well under 25 KB (largest `made-in-timeland` at 11.5 KB); total committed weight ~195 KB, comfortably under the ~300 KB target and the 350 KB test ceiling.
- `covers-manifest.json`: key-sorted provenance mapping each slug → `{ title, sourceUrl (CAA URL), mbid, fetchedAt }`. Buckets (Covers/Miscellaneous) carry no covers by design and fall back to the UI initials placeholder.
- `coversManifest.test.ts`: five assertions over the committed assets — manifest↔asset parity, ≤25 KB per file, ≤350 KB total, every manifest slug is a `dex-albums.json` card album (no stray assets), and non-empty CAA provenance per entry.
- `sharp@0.35.3` added as an exact-pinned devDependency (slopcheck-verified [OK], build-time only, never shipped in the bundle).

## Task Commits

1. **Task 1: sharp devDep + fetch-covers pipeline** — `80d764e` (feat)
2. **Task 2: run pipeline, commit 29 covers + budget-guard test** — `3ee4c74` (feat)

## Files Created/Modified
- `packages/app/scripts/fetch-covers.ts` — MusicBrainz→CAA→sharp one-time pipeline (paced, UA'd, budget-guarded, provenance-writing, idempotent)
- `packages/app/src/assets/covers/*.webp` (29) + `covers-manifest.json` — committed thumbnails + provenance
- `packages/app/test/coversManifest.test.ts` — committed-asset budget/parity/provenance guard
- `packages/app/tsconfig.node.json` — node-context typecheck for the script + fs-based test (renamed from tsconfig.scripts.json)
- `packages/app/package.json` — `sharp: "0.35.3"` devDep + `fetch:covers` script
- `packages/core/package.json` — `./config` subpath export
- `packages/app/tsconfig.json` — excludes the fs-based node test from the browser project

## Decisions Made
- **Source = MusicBrainz/CAA (D-03 discretion).** albums.json has no image-URL field, so kglw.net covers would require HTML scraping (forbidden by etiquette). CAA is a real JSON/binary API with ready-made 250px thumbnails; documented in the script header.
- **`@guezzer/core/config` subpath.** See Deviations — config wasn't barrel-exported and pulling the full core graph into a one-time script for two constants was unnecessary.
- **Node-context tsconfig isolation.** See Deviations — kept browser src DOM-pure while typechecking the fs-based script and test with node types.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added a `@guezzer/core/config` package subpath export**
- **Found during:** Task 1
- **Issue:** The plan directs the script to `import ... config from @guezzer/core`, but `config` is not re-exported from core's barrel (`src/index.ts`). A bare `@guezzer/core` import would pull the entire barrel graph (fuse.js, zod, all model/eval/live code) into a one-time build script just to read `userAgent` and `fetchDelayMs`.
- **Fix:** Added `"./config": "./src/config.ts"` to core's `exports`. `config.ts` has zero imports, so the script loads exactly the two constants it needs. Honors the plan's intent (read the canonical core config) more surgically than a barrel export.
- **Files modified:** packages/core/package.json, packages/app/scripts/fetch-covers.ts
- **Verification:** `node -e import('@guezzer/core/config')` resolves; tsc green across all three projects.
- **Committed in:** `80d764e`

**2. [Rule 3 - Blocking] Added tsconfig.node.json and excluded the fs-test from the browser tsconfig**
- **Found during:** Tasks 1–2
- **Issue:** The plan's verify is `npx tsc --noEmit`, but the app's `tsconfig.json` is DOM-typed (`types: ["vite/client", "vite-plugin-pwa/react"]`) and its `include` omits `scripts/`. The Node script and the fs-based `coversManifest.test.ts` both need `@types/node`; without it, `node:fs`/`node:path` imports fail typecheck. Adding `node` to the app project would leak node globals (`process`, `Buffer`) into browser src.
- **Fix:** Created `packages/app/tsconfig.node.json` (node types, ES2023, erasable-only) covering `scripts/**` and `test/coversManifest.test.ts`; excluded that one test from the DOM-typed `tsconfig.json`. Browser src stays DOM-pure; the node-context files are genuinely typechecked.
- **Files modified:** packages/app/tsconfig.node.json (new, renamed from the Task-1 tsconfig.scripts.json), packages/app/tsconfig.json
- **Verification:** `tsc --noEmit -p` green for all of `tsconfig.node.json`, `tsconfig.json`, and `packages/core/tsconfig.json`; the covers test runs and passes under `--project @guezzer/app`.
- **Committed in:** `80d764e` (initial scripts config), `3ee4c74` (rename + test coverage + exclude)

---

**Total deviations:** 2 auto-fixed (both blocking, both build-config plumbing to satisfy the plan's own typecheck gate).
**Impact on plan:** No scope change. Every artifact-shape, etiquette, and budget contract in the plan is preserved; the deviations only made the referenced import and typecheck actually resolvable.

## Issues Encountered
- None. All 29 card albums resolved on the first paced run with no missing covers, so no placeholder-fallback gaps and no empty-manifest offline path was needed.

## User Setup Required
None — no external service configuration. `npm run fetch:covers --workspace packages/app` re-runs the pipeline (add `--force` to refetch existing covers) if the discography grows.

## Next Phase Readiness
- Committed covers + manifest are ready for plan 06-06 to render in the D-01 album card grid (`AlbumGrid`/`AlbumDetail`) via a standard Vite asset import; albums without a cover use the initials placeholder.
- No blockers.

## Known Stubs
None — the covers are real committed assets, not placeholders.

## Self-Check: PASSED

All claimed created files exist on disk (29 `.webp` + `covers-manifest.json` + `fetch-covers.ts` + `coversManifest.test.ts` + `tsconfig.node.json`); both task commits (`80d764e`, `3ee4c74`) exist in git history. Full suite green (47 files, 356 tests); tsc green across the browser, node-context, and core projects; the covers test passes all 5 assertions.

---
*Phase: 06-pok-dex-history-stats*
*Completed: 2026-07-15*

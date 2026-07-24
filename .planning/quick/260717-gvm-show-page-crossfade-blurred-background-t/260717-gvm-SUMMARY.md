---
status: complete
phase: quick-260717-gvm
plan: 01
subsystem: app/show
tags: [ui, background, crossfade, covers, reduced-motion, offline]
requires:
  - session.currentSongId (useShowSession)
  - dex-albums artifact + bundled cover WebPs (covers.ts / dex-albums-loader.ts)
provides:
  - buildSongCoverSlugMap (pure songId -> cover-slug derivation)
  - coverUrlForSong (app-bound song -> bundled cover URL resolver)
  - ShowBackground two-layer crossfade
affects:
  - Show page ambient background now reflects the selected next song's album
tech-stack:
  added: []
  patterns:
    - "Reduced-motion idiom: default = reduced state, @media (prefers-reduced-motion: no-preference) enables motion"
    - "Config-driven CSS duration via a --custom-property inline style"
    - "Two-layer base/incoming crossfade promoted on animationEnd + timeout fallback"
key-files:
  created:
    - packages/app/src/dex/song-cover.ts
    - packages/app/test/songCover.test.ts
  modified:
    - packages/app/src/config.ts
    - packages/app/src/show/ShowBackground.tsx
    - packages/app/src/styles.css
    - packages/app/src/show/ShowView.tsx
decisions:
  - "Crossfade duration (600ms) lives only in config.show.background.CROSSFADE_MS — no component magic numbers."
  - "coverUrlForSong maps only album-track songs; bucket (Covers/Miscellaneous) songs have no card album, so they resolve to no-art (null)."
  - "Art-less selections hold the last real cover rather than reverting to the random ambient cover."
metrics:
  duration: ~10m
  completed: 2026-07-17
---

# Phase quick-260717-gvm Plan 01: Show Page Crossfade Blurred Background Summary

JWT-free, offline-safe ambient polish: the Show page's blurred backdrop now crossfades to the album cover of the currently-selected next song, driven off the single `session.currentSongId` value so both selection paths (orb-tap and search-select) are covered with zero handler edits.

## What Was Built

- **`packages/app/src/dex/song-cover.ts`** — a pure `buildSongCoverSlugMap(artifact)` that turns a `DexAlbumsArtifact` into a `Map<songId, cover-slug>` (only songs inside `albums[].tracks`, non-null songIds; bucket songs excluded), plus the app-bound `coverUrlForSong(songId)` resolver that memoizes the map and resolves through `coverUrlFor` — returning `null` for songs with no committed art or on a dex-albums load failure. Never throws.
- **`packages/app/test/songCover.test.ts`** — a fixture-driven unit test pinning the four derivation behaviors (album-track mapping, null-songId skip, bucket exclusion, absent-songId lookup).
- **Config** — added `config.show.background.CROSSFADE_MS = 600` (single-config rule; no magic numbers in the component).
- **`styles.css`** — `@keyframes show-bg-fade-in` + `.show-bg-fade-layer` (default `opacity:1` so under reduced-motion the incoming cover appears instantly; animated only inside `@media (prefers-reduced-motion: no-preference)`), mirroring the existing orb-breathe/orb-float/orb-ripple idiom.
- **`ShowBackground.tsx`** — converted from a single static blurred layer to a two-layer `base` + `incoming` crossfade. Promotion happens on `onAnimationEnd` AND a `CROSSFADE_MS` timeout fallback (so reduced-motion still settles). Identical-URL re-renders are guarded no-ops (T-gvm-01). Preserves the full prior contract: aria-hidden, pointer-events-none, absolute inset-0, blur/dim, dark scrim on top, and "render nothing before any cover exists".
- **`ShowView.tsx`** — derives `selectedCover` from `session.currentSongId`, holds `lastSelectedCover` so an art-less selection keeps the current cover, and passes `targetCover = selectedCover ?? lastSelectedCover ?? bgCoverUrl` to `ShowBackground` (was the static random `bgCoverUrl`).

## Net Semantics

- Pre-opener (no song selected) → the existing random ambient cover.
- Select a song WITH committed art (orb-tap or search) → background crossfades to that album's cover.
- Select a song WITHOUT art → background holds whatever cover was showing (never reverts to random, never flashes empty).
- `prefers-reduced-motion` → the cover swaps instantly (no fade).
- Fully offline: only bundled covers are used; a dex-albums load failure degrades to no-art (background unchanged).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test suite must run from the repo root, not `packages/app`**
- **Found during:** Task 2 & Task 3 verification.
- **Issue:** The plan's verify command `cd packages/app && npx vitest run` runs Vitest without the root `vitest.config.ts` `test.projects` config, so the app project's `jsdom` environment and `@dexAlbums` alias never load — the DOM-dependent tests fail with "document is not defined". This is a verification-command issue, not a code defect.
- **Fix:** Ran the full suite from the repo root (`npx vitest run`) where the projects config applies. No code change. Individual node-friendly tests (songCover, configMirror) were also confirmed green in isolation.
- **Files modified:** none.

Otherwise the plan executed as written.

## Verification

- `packages/app` `npx tsc --noEmit` — clean, no type or core/UI purity regressions.
- `npx vitest run` (repo root) — 68 files / 496 tests pass, including the new `test/songCover.test.ts` and existing `configMirror.test.ts`.
- All logic is app-layer; `packages/core` untouched.

## Known Stubs

None. `coverUrlForSong` returning `null` is a designed no-art signal (documented behavior), not an unwired stub.

## Self-Check: PASSED
- FOUND: packages/app/src/dex/song-cover.ts
- FOUND: packages/app/test/songCover.test.ts
- FOUND: packages/app/src/show/ShowBackground.tsx
- FOUND: commit 78b32ce (Task 1)
- FOUND: commit 31f5eff (Task 2)
- FOUND: commit e6f4cb0 (Task 3)

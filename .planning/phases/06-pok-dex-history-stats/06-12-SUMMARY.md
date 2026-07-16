---
phase: 06-pok-dex-history-stats
plan: 12
subsystem: dex
tags: [pwa, workbox, precache, covers, musicbrainz, fallback, gap-closure]
requires:
  - "06-04: cover fetch pipeline + budget guards"
  - "06-05: coverUrlFor glob loader"
  - "06-06: AlbumGrid/AlbumDetail shelf + drill-in"
provides:
  - "webp in workbox globPatterns — cover assets precached for offline dex"
  - "CoverThumb shared cover-or-initials component with onError fallback"
  - "Album-preferring findReleaseGroupMbid (exported, regression-tested)"
  - "Corrected phantom-island.webp + manifest (2025 studio Album art)"
affects: []
tech-stack:
  added: []
  patterns:
    - "img onError → same-testid initials placeholder (no broken image ever)"
    - "dimClass passthrough carries both §B4 dimming and layout classes (shrink-0)"
key-files:
  created:
    - packages/app/src/dex/CoverThumb.tsx
    - packages/app/test/fetchCovers.test.ts
  modified:
    - packages/app/vite.config.ts
    - packages/app/src/dex/AlbumGrid.tsx
    - packages/app/src/dex/AlbumDetail.tsx
    - packages/app/test/dexView.test.tsx
    - packages/app/scripts/fetch-covers.ts
    - packages/app/src/assets/covers/phantom-island.webp
    - packages/app/src/assets/covers/covers-manifest.json
decisions:
  - "06-12: covers <4 KB (2 of 29) are Vite-inlined as data URLs in the JS bundle — already precached by the **/*.js glob; the other 27 ride the new webp glob"
  - "06-12: findReleaseGroupMbid prefers the first primary-type Album group, falling back to top-scored groups[0] so EP/Single-only titles stay fetchable"
metrics:
  duration: ~9min
  tasks: 2
  files: 9
  completed: 2026-07-16
---

# Phase 6 Plan 12: UAT Gap Closure — Offline Covers + Phantom Island Art Summary

Offline album covers via webp workbox precache + shared CoverThumb onError→initials fallback, and Album-preferring MusicBrainz release-group selection with the phantom-island cover re-fetched from the 2025 studio Album group.

## What Was Built

### Gap 1 (major, UAT test 2): covers break offline

- **vite.config.ts** — `globPatterns` now includes `webp`; 27 hashed cover
  assets appear in the sw.js precache manifest (verified by grep after build).
  The remaining 2 of 29 covers (float-along-fill-your-lungs, infest-the-rats-nest)
  are under Vite's 4 KB `assetsInlineLimit` and ship as data URLs inside the JS
  bundle — already precached by the existing `**/*.js` glob, so all 29 covers
  are offline-complete. `registerType: "prompt"` untouched; `json` still
  intentionally excluded.
- **CoverThumb.tsx (new)** — the single img-or-initials block, deduplicated
  out of AlbumGrid and AlbumDetail. `onError` flips a failed flag so a cover
  that 404s (offline before SW has the asset, eviction) re-renders the SAME
  `data-testid="album-cover"` as the initials placeholder — a broken-image "?"
  is never shown. `initialsFor` moved here; both duplicates deleted. Sizing
  still sourced from `config.dex.ALBUM_ART_DISPLAY_PX` at the call sites.
  AlbumDetail passes `shrink-0` via the dimClass passthrough (flex-row header
  compression guard); AlbumGrid passes the §B4 zero-catch dimming.

### Gap 2 (minor, UAT test 5): Phantom Island showed the 2024 Single art

- **fetch-covers.ts** — `MbReleaseGroup` gains optional `"primary-type"`;
  `findReleaseGroupMbid` (now exported) returns the first Album-typed group,
  falling back to top-scored `groups[0]` when none exists (EP-only titles like
  Willoughby's Beach stay fetchable). Pacing, D-07 no-auto-retry, 25 KB abort
  guard, and manifest format unchanged.
- **Single-cover re-fetch** — deleted only phantom-island.webp and ran
  `npm run fetch:covers` WITHOUT `--force`: 1 fetched, 28 skipped-existing —
  exactly 2 external requests (MB search + CAA thumbnail). The script resolved
  `716f0986-f131-4e3c-a140-55845bbded3c` (2025 studio Album), new webp is
  7.7 KB (within the 25 KB / 350 KB budgets).

## Task Commits

| Task | Phase | Commit | Message |
| ---- | ----- | ------ | ------- |
| 1 | RED | 0761a81 | test(06-12): add failing cover img→initials fallback tests |
| 1 | GREEN | d0f9fd3 | feat(06-12): precache webp covers + shared CoverThumb img->initials fallback |
| 2 | RED | 3cf35c6 | test(06-12): add failing findReleaseGroupMbid Album-preference tests |
| 2 | GREEN | 9f2055a | feat(06-12): prefer primary-type Album in cover release-group selection |
| 2 | fix | e795345 | fix(06-12): re-fetch phantom-island cover from the 2025 Album release group |

## Verification Evidence

- `npm test -- --run` → **470 passed** (465 existing + 2 fallback + 3
  release-group), including all five coversManifest budget/provenance guards
  against the re-fetched webp.
- `npm run build -w @guezzer/app` → PWA precache 39 entries; sw.js contains
  27 `.webp` asset URLs (`grep -c "\.webp" packages/app/dist/sw.js` ≥ 1).
- `grep -c "716f0986-f131-4e3c-a140-55845bbded3c" covers-manifest.json` → 2
  (mbid field + sourceUrl).
- No `initialsFor` duplication remains outside CoverThumb.

## Deviations from Plan

**1. [Rule 1 - Bug] Tightened RED test 2 that passed vacuously**
- **Found during:** Task 1 RED phase
- **Issue:** the dim-classes-on-fallback test passed before implementation
  because the unhandled img kept the dim classes (fail-fast rule tripped)
- **Fix:** added `expect(fallback.tagName).not.toBe("IMG")` so the test asserts
  the PLACEHOLDER carries the classes; test then failed correctly in RED
- **Files modified:** packages/app/test/dexView.test.tsx
- **Commit:** 0761a81 (part of the RED commit)

Otherwise executed exactly as written. Note (not a deviation): only 27 of 29
webp files appear in sw.js because 2 covers are <4 KB and Vite inlines them
into the JS bundle — offline-complete either way; documented in the vite
config comment and the deferred verification note below.

## TDD Gate Compliance

Both tasks: RED commit (failing tests verified) → GREEN commit (suite green).
No REFACTOR commits needed.

## Known Stubs

None.

## Threat Flags

None — no new trust-boundary surface. T-06-12-01/02/03 mitigations all held:
sharp re-encode preserved, provenance manifest greps to the exact expected
MBID, exactly 2 external requests without `--force`.

## Self-Check: PASSED

All created files exist on disk; all five task commits verified in git log.

## Next-Round UAT Notes

- Airplane-mode dex browse should now show all covers (re-install/refresh the
  PWA once online first so the new SW precache activates — registerType is
  "prompt").
- Phantom Island card should show the 2025 studio-album art.

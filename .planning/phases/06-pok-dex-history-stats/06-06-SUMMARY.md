---
phase: 06-pok-dex-history-stats
plan: 06
subsystem: app-dex-ui
tags: [pokedex, album-shelf, rarity, song-rows, whydetail, react, tdd]

# Dependency graph
requires:
  - phase: 06-pok-dex-history-stats
    plan: 03
    provides: deriveDex / DexStats (perAlbum, perSong, rarestCatch, completion), buildRarityIndex / SongRarity, RarityTier — the derived shapes these components render
  - phase: 06-pok-dex-history-stats
    plan: 05
    provides: useDexStats reactive hook, coverUrlFor(slug), loadArchive/loadDexAlbums guarded loaders, the dexView.test.tsx seed
  - phase: 04-show-mode
    provides: WhyDetail overlay (the STAT-01 extension point), PredictionOrb/OrbitCandidate, SearchSheet/SettingsView view idioms
provides:
  - "DexView — #/dex root: header + Albums|Shows segment + album drill-in (component state, no new hash route)"
  - "DexHeader — Display completion headline + rarest-catch tier pill + shows-attended (Share CTA deferred to 06-11)"
  - "AlbumGrid/AlbumCard — 2-col alpha shelf, Miscellaneous/Covers pinned last, covers or initials, green completion check, B4 dimming"
  - "AlbumDetail — track-ordered drill-in overlay with per-song SongRows"
  - "SongRow — 3 display-only states (caught/unseen/debut), honest sublines, zero toggle affordance (D-05)"
  - "TierBadge — word-always rarity/debut pill (color reinforcement only, B3)"
  - "WhyDetail STAT-01 corpus line + D-08 debut framing"
  - "rarityIndex (module-memoized) + formatMonYear shared helpers"
affects: [06-08 retro-mark writes recompute these live, 06-09 Shows list replaces the shows empty state, 06-11 DexHeader Share CTA, 07 constellation inherits the dimmed-silhouette language]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dex views are dumb components over useDexStats — Dexie is the single source of truth, no stored counts, a mark/unmark re-derives the whole shelf live"
    - "Album drill-in is component view-state within #/dex (openAlbumKey), never a new hash route (ROUTES allow-list untouched)"
    - "Rarity/debut tier color lives ONLY in TierBadge (data semantics, never chrome); the two new hues #60A5FA/#E879F9 appear nowhere else"
    - "Module-memoized rarity index (getRarityIndex) so WhyDetail never rescans the corpus per render — mirrors useDexStats' private cache"

key-files:
  created:
    - packages/app/src/dex/DexView.tsx
    - packages/app/src/dex/DexHeader.tsx
    - packages/app/src/dex/AlbumGrid.tsx
    - packages/app/src/dex/AlbumDetail.tsx
    - packages/app/src/dex/SongRow.tsx
    - packages/app/src/dex/TierBadge.tsx
    - packages/app/src/dex/rarityIndex.ts
    - packages/app/src/dex/formatMonYear.ts
    - packages/app/test/songRow.test.tsx
  modified:
    - packages/app/src/App.tsx
    - packages/app/src/config.ts
    - packages/app/src/show/WhyDetail.tsx
    - packages/app/test/dexView.test.tsx

key-decisions:
  - "TierBadge + tier vocabulary pulled into Task 1 (not Task 2 as planned): DexHeader's rarest-catch pill needs the shared tier badge to compile, so making it Task 1's first consumer keeps commits DRY and self-contained"
  - "Two shared helpers (formatMonYear, rarityIndex) added beyond the plan's file list to avoid duplicating UTC date-formatting and corpus-rescan logic across SongRow/AlbumDetail/WhyDetail"
  - "Album-cover slug is the album_url's last segment (verified: /albums/nonagon-infinity ↔ nonagon-infinity.webp) — coverUrlFor(slug) with null→initials placeholder, no separate slug field needed"

requirements-completed: [DEX-03, DEX-04, STAT-01, STAT-03, STAT-04]

# Metrics
duration: 12min
completed: 2026-07-15
---

# Phase 6 Plan 06: Dex Album Shelf & Per-Song Truth Summary

**The Dex tab becomes the album-shelf Pokédex: DexView (#/dex) with the Display completion headline, the Albums|Shows segment, the 2-column alphabetical album grid (covers or initials, green completion check, §B4 zero-catch dimming, Miscellaneous/Covers pinned last), the album drill-in with per-song SongRows (caught/unseen/debut states, honest personal-gap + all-time sublines, rarity/debut tier pills, and NO toggle affordance anywhere — D-05), and the Show-Mode WhyDetail extended with the STAT-01 corpus line + D-08 debut framing that replaces fake precision for zero-history songs. All rendered over the 06-05 data foundation; TDD RED→GREEN per task.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-15T02:06:00Z
- **Completed:** 2026-07-15T02:18:03Z
- **Tasks:** 2 (each TDD: failing test → implementation)
- **Files:** 13 (9 created, 4 modified)

## Accomplishments

- **DexView (#/dex, D-01/D-07):** replaces the PlaceholderView dex branch in App.tsx; a component-state Albums|Shows segment (active half accent-tinted, no new hash route) + component-state album drill-in (`openAlbumKey`); a calm handled loader-error state (T-06-12) and a loading hold-frame; the "No catches yet" empty state (Mark CTA deferred to 06-08) and the "No shows yet" segment empty state (list lands in 06-09).
- **DexHeader (D-07):** the first real Display-role use since Phase 3 — `{caught}/{total} · {pct}%` tabular-nums headline + "caught" caption, the "Rarest catch: {song}" subline with its tier pill, and "{n} shows attended". No Share CTA yet (06-11 — no dead buttons).
- **AlbumGrid/AlbumCard (D-01/D-02/D-06):** 2-col grid, alphabetical by title with Miscellaneous + Covers bucket pseudo-cards pinned last; 80px cover (`coverUrlFor(slug)`) or initials placeholder (no layout shift); `{caught}/{total}` tally with a hit-green Check when complete; §B4 zero-catch dimming (opacity-40 grayscale on the cover).
- **AlbumDetail + SongRow (D-05/D-08, STAT-03/04):** the track-ordered drill-in overlay (SearchSheet dialog idiom, back → grid); SongRow's three derived states — caught (green check + "Seen {n}× · last {Mon YYYY} · {g} of your shows ago", gap-0 → "· last show"), unseen-with-history (hollow circle + "Played {playCount}× all-time"), and debut candidate (hollow + "Debut candidate" pill + "Never played live — no odds to fake.", no tier, no %). No db import and no mutation handler anywhere (D-05, grep-verified).
- **TierBadge (D-15/B3):** the word-always rarity/debut pill; tier color on text + 40%-opacity border, transparent fill. The two new hues (#60A5FA Uncommon / #E879F9 Rare) live ONLY here — data semantics, never chrome.
- **WhyDetail (STAT-01/D-08):** a muted corpus-stat line ("Played {playCount}× · last {Mon YYYY} · gap {corpusGap}") from the module-memoized rarity index; for a song absent from the index (zero live history) it renders the Debut-candidate badge + honest copy instead — no fake precision.

## Task Commits

TDD RED (test) → GREEN (feat) per task:

1. **Task 1 RED:** failing DexView shelf render tests — `5137ba9` (test)
2. **Task 1 GREEN:** DexView/DexHeader/AlbumGrid/TierBadge + config + App mount — `ec7bfcf` (feat)
3. **Task 2 RED:** failing SongRow/TierBadge/WhyDetail tests — `86269ef` (test)
4. **Task 2 GREEN:** AlbumDetail/SongRow/WhyDetail corpus stats + helpers + drill-in wiring — `99c8cc9` (feat)

## Files Created/Modified

- `packages/app/src/dex/DexView.tsx` — #/dex root: header + segment + grid + drill-in
- `packages/app/src/dex/DexHeader.tsx` — Display completion headline + rarest catch + shows attended
- `packages/app/src/dex/AlbumGrid.tsx` — alpha shelf + AlbumCard (covers/initials, check, dimming)
- `packages/app/src/dex/AlbumDetail.tsx` — track-ordered drill-in overlay
- `packages/app/src/dex/SongRow.tsx` — 3 display-only per-song states
- `packages/app/src/dex/TierBadge.tsx` — word-always rarity/debut pill
- `packages/app/src/dex/rarityIndex.ts` — module-memoized corpus rarity index for non-hook consumers
- `packages/app/src/dex/formatMonYear.ts` — shared UTC "Mon YYYY" formatter
- `packages/app/src/App.tsx` — dex route → DexView
- `packages/app/src/config.ts` — config.dex.ALBUM_ART_DISPLAY_PX + config.copy.dex block
- `packages/app/src/show/WhyDetail.tsx` — STAT-01 corpus line + debut branch
- `packages/app/test/dexView.test.tsx` — extended with 6 DexView shelf tests
- `packages/app/test/songRow.test.tsx` — 11 SongRow/TierBadge/WhyDetail tests

## Decisions Made

- **TierBadge pulled into Task 1.** DexHeader's rarest-catch pill needs the shared tier badge to render and compile; making DexHeader its first consumer keeps the tier-rendering logic in one place rather than duplicating a 4-hue map. Task 2 then reuses it for SongRow + WhyDetail. The tier vocabulary (`tierLabels`, `debutBadge`) moved to Task 1's config addition accordingly.
- **Two shared helpers beyond the plan's file list.** `formatMonYear` (UTC "Mon YYYY") and `rarityIndex.getRarityIndex` (module-memoized corpus scan) prevent duplicating date-formatting across SongRow/AlbumDetail/WhyDetail and prevent WhyDetail from rebuilding the rarity index per render (the plan explicitly asked for "a tiny shared helper in dex/ — do NOT rebuild the index per render").
- **Cover slug = album_url last segment.** Verified all 29 album_url slugs match the committed `.webp` filenames exactly, so `coverUrlFor(albumUrl.split('/').pop())` needs no extra slug field; buckets pass `null` → initials placeholder.

## Deviations from Plan

### Auto-fixed / structural adjustments

**1. [Rule 3 — Blocking] TierBadge + tier vocabulary created in Task 1 instead of Task 2**
- **Found during:** Task 1 (DexHeader's rarest-catch subline "with tier badge")
- **Issue:** DexHeader (a Task 1 file) renders the rarest catch with a tier badge; TierBadge was assigned to Task 2, so Task 1 could not compile a faithful DexHeader without it.
- **Fix:** Created `TierBadge.tsx` (full `RarityTier | "debut"` support) and added `config.copy.dex.tierLabels` + `debutBadge` in Task 1. Task 2 consumes the existing TierBadge for SongRow/WhyDetail and adds its test coverage.
- **Files:** packages/app/src/dex/TierBadge.tsx, packages/app/src/config.ts
- **Commit:** `ec7bfcf`

**2. [Rule 3 — Blocking] DexView edited in Task 2 to wire the drill-in overlay**
- **Found during:** Task 2 (AlbumDetail "rendering the drill-in over DexView … keep within #/dex state")
- **Issue:** AlbumDetail must mount from DexView's component state; the plan implies DexView holds the state (Task 1) and Task 2 wires AlbumDetail in, but DexView is only in Task 1's file list.
- **Fix:** Task 1 shipped DexView with the segment + grid (card tap a no-op placeholder); Task 2 added the `openAlbumKey` state, the `resolveOpenAlbum` bucket/card resolver, and the AlbumDetail overlay render. This matches the plan's Task 2 action text ("rendering the drill-in over DexView").
- **Files:** packages/app/src/dex/DexView.tsx
- **Commit:** `99c8cc9`

No behavioral scope creep — both adjustments are structural sequencing to keep every commit compiling and DRY.

## Issues Encountered

- Root `npx tsc --noEmit` prints CLI help (no root tsconfig) — the project typechecks per-package; both `packages/app/tsconfig.json` and `packages/core/tsconfig.json` are clean. Same note as 06-03/06-05.
- CRLF/LF warnings on commit are the repo's normal line-ending normalization; no content impact.

## User Setup Required

None — app-only additions, no new dependencies or external services.

## Next Phase Readiness

- 06-08 (retro-mark) writes to `attendedShows`/`archiveShows`; because every dex number is `useDexStats`-derived, marking recomputes the shelf, album tallies, and per-song rows with no code change here. The `archiveShows` cache still joins `deriveDex` input in 06-08 (deliberate 06-05 deferral).
- 06-09 replaces the "No shows yet" segment empty state with the attended-shows list.
- 06-11 adds the DexHeader Share-card CTA (the header already reserves the block).
- No blockers.

## Known Stubs

None. The shows empty state, absent Mark CTA, and absent Share CTA are deliberate, documented deferrals to 06-08/06-09/06-11 (no dead buttons this plan), not stubs — the album shelf and drill-in are fully wired to live derived data.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes. All kglw-derived strings (song/album names, WhyDetail reason) render as React text only; grep confirms zero `dangerouslySetInnerHTML`/`innerHTML` in `dex/` and WhyDetail (matches are comments documenting the mitigation). SongRow has no db import and no mutation handler (T-06-13 / D-05 structural). No new dependencies (T-06-SC).

## TDD Gate Compliance

Each task followed RED (a committed failing `test(...)`) → GREEN (`feat(...)`). Gate commits present: Task 1 `5137ba9`→`ec7bfcf`; Task 2 `86269ef`→`99c8cc9`. No refactor commits needed.

## Verification

- `npx vitest run --project @guezzer/app test/dexView.test.tsx` — 9/9 green.
- `npx vitest run --project @guezzer/app test/songRow.test.tsx` — 11/11 green.
- `npx vitest run --project @guezzer/app` — 157 app tests green (27 files).
- `npx vitest run` (full repo) — 376 tests green (49 files); +17 over the 06-05 baseline (359).
- `npx tsc --noEmit -p packages/app/tsconfig.json` and `-p packages/core/tsconfig.json` — both clean.
- grep: no db import / mutation handler in `dex/SongRow.tsx`; no `dangerouslySetInnerHTML`/`innerHTML` in `dex/` or WhyDetail (comment matches only); "No catches yet" exists only in `config.ts`.

## Self-Check: PASSED

All 9 claimed created files exist on disk; all 4 task commits (`5137ba9`, `ec7bfcf`, `86269ef`, `99c8cc9`) exist in git history. App suite 157/157, full repo 376/376 green, both typechecks clean.

---
*Phase: 06-pok-dex-history-stats*
*Completed: 2026-07-15*

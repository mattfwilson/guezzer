---
phase: 19-shared-dex-progress
plan: 01
subsystem: core/dex
tags: [shared-progress, compare-reuse, zod-validation, pure-core]
requires:
  - compareDexes (packages/core/src/dex/compare.ts) — UNCHANGED live diff target
  - deriveDex / DexStats (packages/core/src/dex/derive-dex.ts)
  - RarityIndex / RarityTier (packages/core/src/dex/rarity.ts)
provides:
  - deriveSharedProgress — DexStats → SharedProgress Option-B payload (PROG-01)
  - reconstructDexStats — SharedProgress → minimal DexStats for compareDexes (PROG-06/07)
  - selectRarestCaught — top-N rarest catches (PROG-08)
  - parseSharedProgress / sharedProgressSchema — read-boundary zod validation (D-19)
  - type SharedProgress — the serializable synced payload shape
affects:
  - Phase 19 downstream app-wave sync + head-to-head compare UI (consumes @guezzer/core surface)
tech-stack:
  added: []
  patterns:
    - "Pure-core projector/inverse pair around an UNCHANGED shipped diff (reuse, not reinvent)"
    - "zod strictObject read-boundary safeParse → null on malformed (never throws)"
    - "Local rarity index reconstructs tiers (D-13) — tiers never shipped in the payload"
key-files:
  created:
    - packages/core/src/dex/shared-progress.ts
    - packages/core/test/dex/shared-progress.test.ts
  modified:
    - packages/core/src/index.ts
decisions:
  - "SharedProgress carries NO display_name — the app writes it as a first-class row column (RESEARCH A1/Open-Q1), keeping the projector a pure fn of DexStats alone"
  - "tierCounts uses exactly the 5 RarityTier keys (no debut — that is a share-card state, not a rarity)"
  - "caughtSongIds capped at MAX_CAUGHT_SONG_IDS=1000 (defensive ceiling; catalog ~260) to reject hostile oversized arrays"
  - "reconstructed sightings:1 is boolean-equivalent (caught/not-caught) — compareDexes only reads >0 (Pitfall 1 / T-19-02)"
  - "selectRarestCaught skips untiered ids (return type requires a real RarityTier), sorts rarest-first echoing compare.ts's sortByTierThenId"
metrics:
  duration: ~8min
  completed: 2026-07-23
  tasks: 2
  files: 3
---

# Phase 19 Plan 01: Shared Dex Progress (pure-core projector) Summary

Pure-core `shared-progress.ts` projects a `DexStats` into the lean serializable `SharedProgress` Option-B payload and reconstructs a minimal `DexStats` back through it so the live head-to-head reaches the byte-for-byte UNCHANGED `compareDexes`, with the round-trip fidelity invariant pinned by a deep-equality test.

## What Was Built

**Task 1 — `packages/core/src/dex/shared-progress.ts` (+ `index.ts` barrel):**
- `deriveSharedProgress(dex)` — mirrors `buildShareStats`: iterates `dex.perSong`, collects the `sightings>0` caught set (sorted ascending), tallies the 5-tier counts, passes `completion`/`showCount`/`rarestCatch` straight through, and serializes `perAlbum` Map → array (Pitfall 6). No wall-clock read, no I/O.
- `reconstructDexStats(summary, rarity)` — rebuilds the exact read-set `compareDexes` consumes: a `perSong` Map (`sightings:1` boolean-equivalent, tier from the LOCAL rarity index per D-13), `perAlbum` array → Map, `completion`/`showCount`/`rarest` passthrough, and stubs (`neverSeen:[]`, per-song `lastSeenDate`/`personalGap` null) for every field the diff never reads.
- `selectRarestCaught(caughtSongIds, rarity, limit)` — top-N rarest, rarest-tier-first with songId tie-break, echoing compare.ts's ordering.
- `sharedProgressSchema` + `parseSharedProgress(raw)` — zod `strictObject` read-boundary guard: `pct` bounded `[0,100]`, non-negative int counts, int ids, `caughtSongIds` length-capped; malformed → `null`, never throws (D-19, T-19-01).

**Task 2 — `packages/core/test/dex/shared-progress.test.ts`:**
Reuses the `share-stats.test.ts` fixture wiring (`baseArchive`/`buildRarityIndex`/`syntheticAlbums`/`derive`). 8 tests across the VALIDATION filters: `deriveSharedProgress`, `round-trip fidelity` (the load-bearing deep-equality against unchanged `compareDexes`), `reconstructDexStats`, `perAlbum`, `rarest showcase`, `parseSharedProgress`.

## Verification

- `npx vitest run packages/core/test/dex/shared-progress.test.ts` → 8/8 passed.
- `npx vitest run packages/core/test/purity.test.ts` → 2/2 passed (new module auto-scanned, no Supabase/DOM).
- `npx vitest run packages/core` full suite → 441/441 passed (47 files, no regression).
- `npx tsc -p packages/core --noEmit` → clean.
- `git diff --exit-code packages/core/src/dex/compare.ts` → unchanged (hard constraint held).
- Forbidden-pattern grep (`@supabase|createClient|document.|localStorage|navigator.|Date.now`) on the new module → empty.

## Deviations from Plan

None — plan executed exactly as written. (One minor mechanical adjustment: two comment mentions of the literal string `Date.now()` were reworded to "wall-clock read" so the acceptance-criterion grep returns strictly nothing — no behavioral change.)

## Known Stubs

None. `reconstructDexStats` intentionally stubs fields (`neverSeen:[]`, `lastSeenDate`/`personalGap` null, `sightings:1`) — these are the documented reconstruction contract for the fields `compareDexes` never reads, proven inert by the round-trip fidelity test, not placeholder data.

## Threat Flags

None. The plan's `<threat_model>` surface is fully addressed: T-19-01 (input validation) by `parseSharedProgress`/`sharedProgressSchema`, T-19-02 (reconstructed sightings) documented + pinned by the round-trip test. No new endpoints, auth paths, or trust boundaries introduced.

## Commits

- `b3b8d88` feat(19-01): pure-core shared-progress projector + reconstruction + zod
- `55ef539` test(19-01): round-trip fidelity + shared-progress unit tests

## Self-Check: PASSED

- FOUND: packages/core/src/dex/shared-progress.ts
- FOUND: packages/core/test/dex/shared-progress.test.ts
- FOUND (modified): packages/core/src/index.ts
- FOUND: commit b3b8d88
- FOUND: commit 55ef539

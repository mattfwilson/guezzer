---
phase: 15-gizz-bingo-persistence-lock-replay
plan: 03
subsystem: app-ui
tags: [gizz-bingo, replay, gizzgames-tab, recap, routing, bingo-07]

# Dependency graph
requires:
  - phase: 15-gizz-bingo-persistence-lock-replay
    plan: 02
    provides: "Dexie version(5) bingoCards table + BingoCardRow (frozen card + caughtSnapshot); config.copy.games / config.copy.recap bingo keys"
  - phase: 15-gizz-bingo-persistence-lock-replay
    plan: 01
    provides: "envelope v3 core: the pure bingo fold (deriveMarks/detectWins/buildBingoContext) consumed via @guezzer/core"
provides:
  - "replayCard app->core adapter (BingoCardRow + trail + artifacts -> { marked, wins, songNameByPosition })"
  - "GizzGames 4th bottom tab + 'games' route + GamesView (disabled Deal teaser + live replay list + honest empty state)"
  - "RecapView read-only Bingo replay section (4x4 board + win badges + Lit-by, absent when no card)"
affects: [16-gizz-bingo-build-live-marking, gizz-bingo-catchup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure app->core replay adapter: 0-based contiguous reindex of the gapped 1-based TrackedEntry.position + frozen caughtSnapshot -> the shared deriveMarks fold (live == replay == catch-up)"
    - "Read-only pure re-derivation over the persisted trail in a useMemo (marks never stored, D-23); the UI holds zero domain math"
    - "Per-surface top inset: an inside-AppShell tab view uses a plain top pad (SettingsView precedent), NOT a re-applied env(safe-area-inset-top) — the AppShell header already owns the notch"

key-files:
  created:
    - "packages/app/src/games/bingoReplay.ts"
    - "packages/app/src/games/GamesView.tsx"
    - "packages/app/test/bingoReplay.test.ts"
  modified:
    - "packages/app/src/routing/useHashRoute.ts"
    - "packages/app/src/components/BottomTabBar.tsx"
    - "packages/app/src/App.tsx"
    - "packages/app/src/dex/RecapView.tsx"
    - "packages/app/test/recapView.test.tsx"
    - "packages/app/test/route.test.ts"

key-decisions:
  - "replayCard returns an extra songNameByPosition map (superset of the planned { marked, wins }) built from the SAME 0-based reindex the fold consumed — the single source for the D-06 'Lit by {song}' caption, so RecapView never re-derives the reindex"
  - "GamesView (inside AppShell, below the already-inset header) uses a plain pt-8 top pad instead of the UI-SPEC's calc(env(safe-area-inset-top)+12px) — re-applying the inset there reproduces the documented doubled-top-inset bug (SettingsView is the in-repo precedent)"
  - "The free cell is identified structurally by def.kind === 'free' (FREE_SENTINEL is not exported from the core barrel) — no core change needed"

requirements-completed: [BINGO-07]

# Metrics
duration: ~12min
completed: 2026-07-20
---

# Phase 15 Plan 03: GizzGames Tab + Bingo Replay Summary

**Delivered BINGO-07 replay and the D-01/D-02 GizzGames surface entirely in the app tier: the pure `replayCard` adapter that re-derives a frozen card's final board over the persisted trail (0-based opener reindex + frozen caughtSnapshot), a read-only Bingo section inside `RecapView` (full 4x4 board + accent win badges + per-square "Lit by {song}"), and a 4th "GizzGames" bottom tab whose view lists replayable cards with an honest disabled "Deal — coming soon" teaser. Marks are never stored (D-23) — every read re-derives, so `live == replay == catch-up` holds. Both tsc clean; full suite 711 green.**

## Performance
- **Duration:** ~12 min
- **Tasks:** 3 (Task 1 TDD RED->GREEN)
- **Files:** 3 created, 6 modified
- **Tests:** 711 passing across both projects (was 704 after 15-02; +7 net: 5 replay + 2 D-05 recap, route assertion updated in place)

## Accomplishments
- **`replayCard` adapter (Task 1, TDD)** — the single pure app->core bridge: sorts a COPY of the session's `TrackedEntry[]` by stored 1-based gapped `position` and assigns fresh contiguous `0..N-1` indices (the reindex `mark.ts:84` hard-codes `opener = position 0` against), passes `new Set(row.caughtSnapshot)` as the FROZEN caught-set to `deriveMarks`, then `detectWins`. Only the `{songId, position, isPlaceholder}` subset crosses into core (D-22). Returns `{ marked, wins, songNameByPosition }`; the map is built from the same reindex so the "Lit by" caption always resolves to the song that lit the cell. Five fixtures pin: opener via reindex, neverCaught reads the frozen set (present vs absent), placeholder-skip, and the caption map.
- **GizzGames tab (Task 2)** — `"games"` added to the fixed `ROUTES` allow-list (T-03-02 hash stays SELECT-only); a 4th `BottomTabBar` entry with the lucide `Gamepad2` hub icon (D-01, generic games-hub — forward-compatible for Gizzle/Guezz League), `flex-1` keeps each of the four tabs >= 44px; `App.tsx` renders `<GamesView />` on `route === "games"` (a scrolling surface). `GamesView` composes the RecapView `useLiveQuery` idiom: a disabled "Coming soon" Deal teaser (reads as forthcoming, never broken) + a live `db.bingoCards` replay list + an honest "No cards yet" empty state (D-02) — never blank, never an error. Venue/city render as escaped React text (T-06-21).
- **RecapView Bingo section (Task 3)** — `loadMatrix()` added beside the existing loaders + a `useLiveQuery(() => db.bingoCards.toArray())` read; a new `useMemo` finds the card row for this `sessionId` and calls `replayCard` (returns null -> section absent, D-05). Renders a 4x4 read-only board applying the 15-UI-SPEC color contract (marked = caught-green `#22C55E`/near-black `#0C0C10`; unmarked = `#17171F`/`#F5F5F7`/`#2A2A34` hairline; free = marked treatment + "Free"), accent-gold `#F2C14E` win-badge chips (or the "No lines this show" line), and a per-square "Lit by {song}" caption on marked non-free cells. Read-only — no tap-to-mark (D-04), no celebration (Phase 16).

## Task Commits
1. **Task 1: replayCard adapter (TDD)**
   - `f751b80` (test — RED)
   - `35f1eea` (feat — GREEN)
2. **Task 2: GizzGames tab + route + GamesView** — `3d22ddc` (feat)
3. **Task 3: RecapView Bingo section + present/absent test** — `ff878c4` (feat)

**Post-task fix:** `4c01488` (test — stale ROUTES allow-list assertion updated for `games`).

## Files Created/Modified
- `packages/app/src/games/bingoReplay.ts` *(new)* — `replayCard` + `ReplayResult`.
- `packages/app/src/games/GamesView.tsx` *(new)* — the GizzGames view (teaser + live list + empty state).
- `packages/app/test/bingoReplay.test.ts` *(new)* — five adapter behaviors.
- `packages/app/src/routing/useHashRoute.ts` — `"games"` added to `ROUTES`.
- `packages/app/src/components/BottomTabBar.tsx` — 4th `Gamepad2` GizzGames tab.
- `packages/app/src/App.tsx` — `route === "games"` branch + `GamesView` import.
- `packages/app/src/dex/RecapView.tsx` — `loadMatrix`/`bingoCards` reads + `bingo` memo + the read-only Bingo section.
- `packages/app/test/recapView.test.tsx` — D-05 present-with-card / absent-without-card cases; `bingoCards` cleared per test.
- `packages/app/test/route.test.ts` — ROUTES assertion updated for `games`.

## Decisions Made
- **`replayCard` returns `songNameByPosition`** (a superset of the planned `{ marked, wins }`) — the D-06 "Lit by" caption needs the song that lit each cell, and building it from the SAME reindex the fold used keeps a single source of truth (no duplicated reindex in RecapView).
- **GamesView uses a plain `pt-8` top pad**, not the UI-SPEC's `calc(env(safe-area-inset-top)+12px)`. GamesView renders inside AppShell's `<main>`, below the "Guezzer" header that ALREADY consumes the notch inset; re-applying it reproduces the documented doubled-top-safe-area bug. SettingsView (the closest inside-AppShell tab view) sets the `pt-8` precedent.
- **The free cell is identified by `def.kind === "free"`** rather than the `FREE_SENTINEL` value, which is not exported from the core barrel — no core change required (this is a frontend-only plan).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stale ROUTES allow-list assertion**
- **Found during:** full-suite gate after Task 2.
- **Issue:** `route.test.ts` asserted the exact 4-entry `ROUTES` tuple; adding `"games"` (the plan's own instruction) failed it.
- **Fix:** Updated the assertion to include `"games"`.
- **Files modified:** packages/app/test/route.test.ts
- **Commit:** `4c01488`

### Deviations from the UI-SPEC design contract

**2. [Rule 1 - Bug avoidance] GamesView top inset**
- The UI-SPEC (§Spacing, D-02 acceptance) states GamesView "owns its own `calc(env(safe-area-inset-top)+12px)` header inset". That assumes a top-anchored/fixed surface; GamesView actually renders inside AppShell below the header that already applies the notch inset. Applying it again would double it on notched iPhones (the exact bug tracked in `2026-07-19-fix-doubled-top-safe-area-inset`). Used the SettingsView `pt-8` convention instead. Visual result matches the sibling tab views; the notch is honored once, by the shared header.

**3. [Superset, not a reduction] `replayCard` return shape**
- The plan's artifact table lists `replayCard -> { marked, wins }`. The implementation returns `{ marked, wins, songNameByPosition }` — a strict superset required to render the D-06 "Lit by {song}" caption from the same reindex. No consumer relies on the shape being exactly two keys.

## Known Stubs
None. The GamesView "Deal — Coming soon" affordance is an intentional, plan-mandated disabled teaser (D-02) whose live implementation is Phase 16 by design — it is documented copy, not a data stub, and never renders as broken/errored. The bingo card list and the RecapView board are wired to live `db.bingoCards` data (they render whatever real locked cards exist; empty until Phase 16 deals one, which is the honest, intended state this phase).

## Threat Flags
None. No new network endpoint, auth path, file-access, or schema surface introduced. The two trust boundaries in the plan's threat register (stored card/trail -> replay render; `location.hash` -> route) are mitigated as planned: all kglw-derived strings (square labels, song names, venue/city) render as escaped React text only (no `dangerouslySetInnerHTML`, T-15-07); `games` was added to the fixed `ROUTES` allow-list, hash stays SELECT-only (T-15-08); the 0-based reindex + frozen caughtSnapshot (both pinned by bingoReplay.test.ts) prevent replay divergence (T-15-09).

## Verification
- `npx vitest run packages/app/test/bingoReplay.test.ts` -> **5 passed**.
- `npx vitest run packages/app/test/recapView.test.tsx` -> **10 passed** (present/absent Bingo section + no regression).
- `npx vitest run` (both projects) -> **711 passed / 88 files**.
- `npx tsc --noEmit -p packages/app` -> **clean (exit 0)**.
- `npx tsc --noEmit -p packages/core` -> **clean (exit 0)**.

## TDD Gate Compliance
Task 1 shows the RED (`f751b80` test) -> GREEN (`35f1eea` feat) sequence; the test failed on the missing `replayCard` module before implementation (verified). Tasks 2 and 3 are UI-composition tasks (`type="auto"`, not `tdd="true"`); Task 3's mandated render assertion (the D-05 present/absent contract) was added and is green.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Replay is fully wired and read-only. Phase 16 will call `saveDraftCard`/`lockCard` (15-02) from the real Start-Show/deal trigger and add live marking + celebrations; `replayCard` is the shared derivation it should reuse so `live == replay` continues to hold.
- Plan 15-04 (catch-up) is independent of this plan; it consumes `config.copy.catchUp.*`.
- No blockers.

## Self-Check: PASSED
- FOUND: packages/app/src/games/bingoReplay.ts
- FOUND: packages/app/src/games/GamesView.tsx
- FOUND: packages/app/test/bingoReplay.test.ts
- FOUND: .planning/phases/15-gizz-bingo-persistence-lock-replay/15-03-SUMMARY.md
- FOUND commits: f751b80, 35f1eea, 3d22ddc, ff878c4, 4c01488

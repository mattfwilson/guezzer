---
phase: 19-shared-dex-progress
plan: 03
subsystem: app/dex-ui
tags: [friends-ui, head-to-head, compare-reuse, view-state, offline, phase-20-slots]
requires:
  - useFriendsProgress / buildFriendRows / FriendRowData (packages/app/src/sync, 19-02)
  - reconstructDexStats / selectRarestCaught / SharedProgress (@guezzer/core, 19-01)
  - compareDexes / CompareResult / DexStats / RarityIndex (@guezzer/core) — UNCHANGED diff
  - useDexStats (packages/app/src/dex/useDexStats.ts, Phase 6)
  - useAuthIdentity + identityColorIndex + config.auth.IDENTITY_COLORS (Phase 18)
  - Sheet variant=fullscreen (packages/app/src/components/Sheet.tsx, Phase 8)
  - TierBadge / rarityStyle / SyncDot (shipped primitives, echoed not imported)
  - config.copy.friends / config.copy.compare / config.friends.showcaseCount (19-02)
provides:
  - FriendRow — friend list row (identity glyph + pct + caught + rarest TierBadge + Phase-20 slots) + shared IdentityGlyph
  - SelfRow — pinned live "You" row from useDexStats/useAuthIdentity (D-02)
  - RarestShowcase — top-N rarest via selectRarestCaught, shared by FriendDetail + trophy case (PROG-08)
  - FriendDetail — full-screen live head-to-head overlay (reconstruct -> UNCHANGED compareDexes) (PROG-06/07)
  - FriendsList — pinned SelfRow + sorted FriendRows + offline chip + degraded-read + empty state (PROG-04)
  - DexView Friends segment + FriendDetail/trophy-case view-state overlays (D-01)
affects:
  - Phase 20 presence (PRES-07) fuses online dot + activity into FriendRow's reserved slots without a rebuild
tech-stack:
  added: []
  patterns:
    - "Echo a shipped component's layout in a NEW file (CompareView -> FriendDetail) — zero import/edit coupling (D-09)"
    - "Friends surface is a THIRD segment view-state inside DexView, never a hash route, never a bottom tab (D-01)"
    - "Pure read hook (useFriendsProgress) consumed read-only — no component owns the app-wide sync subscription (D-16)"
    - "Reserve empty structural slots in a row for a future phase's presence data (PRES-07)"
key-files:
  created:
    - packages/app/src/dex/FriendRow.tsx
    - packages/app/src/dex/SelfRow.tsx
    - packages/app/src/dex/RarestShowcase.tsx
    - packages/app/src/dex/FriendDetail.tsx
    - packages/app/test/friendDetail.test.tsx
    - packages/app/src/dex/FriendsList.tsx
  modified:
    - packages/app/src/dex/DexView.tsx
decisions:
  - "FriendDetail's By-rarity breakdown IS the CompareView-style diff lists (onlyMine/onlyTheirs/shared), each tier-sorted + TierBadge-tagged; By-album is a separate collapsible over the reconstructed theirs.perAlbum — satisfies 'diff lists render nameOf+TierBadge' AND the two named breakdown headings"
  - "Shared IdentityGlyph is exported from FriendRow (echo of IdentityAvatar's glyph) and reused by SelfRow — IdentityAvatar itself is NOT imported (it owns the header account sheet, not a list glyph)"
  - "Own trophy-case overlay lives inline in DexView as a fullscreen Sheet (header 'You' + RarestShowcase heading 'Your rarest catches'), NO compare columns (D-06)"
  - "Offline 'as of {time}' formats asOf via toLocaleTimeString (hour/minute) — the app's short-wall-time idiom"
metrics:
  duration: ~30min
  completed: 2026-07-23
  tasks: 3
  files: 7
---

# Phase 19 Plan 03: Friends UI (GizzDex head-to-head) Summary

The Friends surface ships as a third `Friends` segment inside GizzDex: a pinned live "You" row over friend rows read from the pure `useFriendsProgress()` hook, each friend tappable into a full-screen `FriendDetail` that reconstructs `theirs` and feeds the byte-for-byte UNCHANGED `compareDexes` for a live head-to-head — echoing `CompareView`'s layout in a new file without importing or altering it, and reserving the Phase-20 presence slots on every row.

## What Was Built

**Task 1 — leaf presentational components (commit `40c2ec9`):**
- `FriendRow.tsx`: a `min-h-11` row `<button>` echoing `ShowsList`'s skeleton — a reserved empty LEADING slot (Phase-20 online dot) + the shared `IdentityGlyph` (echo of `IdentityAvatar`'s `identityColorIndex` fill + `#0C0C10` initials) + a `min-w-0 flex-1` name/`{pct}% · {n} caught` column (`tabular-nums`) + a single rarest `TierBadge` (omitted for a 0-catch friend, D-05) + a reserved empty TRAILING slot (Phase-20 activity) + `ChevronRight`. `dimmed` mutes via opacity, never removes. Exports `IdentityGlyph` for reuse.
- `SelfRow.tsx`: the pinned "You" row echoing FriendRow's shape but sourced from LIVE `useDexStats()` + `useAuthIdentity()` (never the Supabase read, D-02); never dimmed; holds a calm frame until the live dex resolves.
- `RarestShowcase.tsx`: runs core `selectRarestCaught(caughtSongIds, rarity, config.friends.showcaseCount)` and renders up to 5 rarest catches (escaped song name + `TierBadge`); `heading` + data are props so it serves both FriendDetail and the "You" trophy case; empty → `No catches yet`.

**Task 2 — FriendDetail overlay + head-to-head regression pin (commit `d768562`):**
- `FriendDetail.tsx`: `FriendDetail({ friend, onClose })` in a NEW file — `useMemo` reads `useDexStats`, `reconstructDexStats(friend.summary, stats.rarity)` → `compareDexes(stats.dex, theirs)` (the UNCHANGED core diff), guarding null like CompareView. Rendered in `Sheet variant="fullscreen"` (shipped `config.ui.z.sheet` tier) with a safe-area header + ≥44px `ChevronLeft` back control (aria `Back`). Body order (D-08): (1) `You vs {name}` head-to-head with two local `StatColumn`s (echoing CompareView, reusing `config.copy.compare` strings), (2) an expandable `By rarity` block of the tier-sorted `onlyMine`/`onlyTheirs`/`shared` diff lists (local `DiffSection`, `nameOf` + `TierBadge`, songId-only) + an expandable `By album` block over the reconstructed `theirs.perAlbum` (titles via the `resolveOpenAlbum` idiom), (3) the friend's `RarestShowcase`.
- `packages/app/test/friendDetail.test.tsx`: the WARNING-2 jsdom regression pin — mocks `useDexStats`, renders `FriendDetail` with a fixture friend `SharedProgress`, and asserts the `You vs Ada` columns populate with the exact numbers `compareDexes(mine, reconstructDexStats(summary, rarity))` produces (a real render of the live path; shows 3 vs 5 proves the two columns bind two distinct dexes).

**Task 3 — FriendsList + DexView wiring (commit `e281d3e`):**
- `FriendsList.tsx`: reads ONLY `useFriendsProgress()`, always renders the pinned `<SelfRow>`, then `buildFriendRows(friends, myUserId)` as `<FriendRow>`s. `offline` → an `Offline · as of {time}` muted chip reusing the `SyncDot` hollow-ring vocabulary + `dimmed` friend rows (SelfRow stays live); `error` → the calm `degradedRead` copy; no rows → the `No friends yet` empty state below the SelfRow. Opens NO subscription/debounce of its own (D-16).
- `DexView.tsx` (EDIT): `Segment` type + a third `Friends` tab (active `bg-accent text-surface` — the single accent this phase adds); a `segment === "friends"` branch renders `FriendsList`; `useState` overlays (`openFriend: FriendRowData | null`, `selfCaseOpen`) render `FriendDetail` and a fullscreen trophy-case `Sheet` (RarestShowcase over the live own caught set, NO compare columns — D-06). All view-state within `#/dex`, no route string added.

## Verification

- `npx tsc -p packages/app --noEmit` → clean.
- `npx vitest run --project @guezzer/app` → 430/430 passed (71 files; +1 = the FriendDetail pin).
- `npx vitest run --project @guezzer/core` → 441/441 passed (no regression).
- `git diff --exit-code packages/app/src/dex/CompareView.tsx packages/core/src/dex/compare.ts` → BOTH unchanged (hard constraint held).
- `grep -n "CompareView" packages/app/src/dex/FriendDetail.tsx` → doc comments only, no import.
- `grep -nE "subscribeProgress|useProgressSync|channel" packages/app/src/dex/FriendsList.tsx` → doc comments only, no call (engine stays app-wide, D-16).
- `grep -nE "ROUTES|hash|route" packages/app/src/dex/DexView.tsx` → doc comments only, no new route string for Friends.
- `dangerouslySetInnerHTML` in the new files → only the "never dangerouslySetInnerHTML" doc-comment negation; no usage (T-19-xss gate).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Regression-pin test placed under `packages/app/test/`, not `src/dex/`**
- **Found during:** Task 2
- **Issue:** The plan artifact path is `packages/app/src/dex/FriendDetail.test.tsx` with verify `npx vitest run packages/app/src/dex/FriendDetail.test.tsx`. The root `vitest.config.ts` app project sets `root: "packages/app"` with `include: ["test/**/*.test.{ts,tsx}"]` — a co-located `src/dex/*.test.tsx` is NEVER collected, so the pin would silently never run (the identical constraint 19-02 hit and documented).
- **Fix:** Created the test at `packages/app/test/friendDetail.test.tsx` (the established flat convention — all app tests live under `test/`). The FriendDetail source stays exactly where the plan specifies (`src/dex/FriendDetail.tsx`). Verified with `npx vitest run --project @guezzer/app friendDetail` → 1/1.
- **Files:** `packages/app/test/friendDetail.test.tsx`
- **Commit:** `d768562`

## Authentication Gates

None — no auth interaction; `SelfRow`/`FriendsList` read the already-signed-in `useAuthIdentity()`, and the sync engine (Phase 19-02, RLS Phase 17) is not touched here.

## Known Stubs

None. The reserved FriendRow presence slots (`data-slot="presence-online"` / `presence-activity`) render nothing by DESIGN — they are the documented Phase-20 (PRES-07) fusion points, a hard-constraint structural requirement, not placeholder data. No component receives permanently-empty data: FriendsList feeds live sync state, SelfRow feeds the live local dex, FriendDetail feeds the live compare.

## Threat Flags

None beyond the plan's `<threat_model>`, which is fully addressed:
- **T-19-xss** — all friend `display_name` + resolved song/album names render as escaped React text, `truncate`/`min-w-0` clamped; the no-`dangerouslySetInnerHTML` gate is clean across all new files.
- **T-19-dupname** — every set operation (buildFriendRows, compareDexes inputs, RarestShowcase selection) is songId-only; names are resolved for display only via `archive.songs[String(id)]`.
- **T-19-privacy** (accept, D-14) and **T-19-SC** (accept — no npm installs; all primitives shipped) — unchanged by this plan.
No new network endpoints, auth paths, or trust boundaries were introduced — this plan is pure UI over the 19-01 core + 19-02 sync surfaces.

## Commits

- `40c2ec9` feat(19-03): FriendRow + SelfRow + RarestShowcase leaf components
- `d768562` feat(19-03): FriendDetail live head-to-head overlay + regression pin
- `e281d3e` feat(19-03): FriendsList + DexView Friends segment wiring

## Self-Check: PASSED

- FOUND: packages/app/src/dex/FriendRow.tsx
- FOUND: packages/app/src/dex/SelfRow.tsx
- FOUND: packages/app/src/dex/RarestShowcase.tsx
- FOUND: packages/app/src/dex/FriendDetail.tsx
- FOUND: packages/app/test/friendDetail.test.tsx
- FOUND: packages/app/src/dex/FriendsList.tsx
- FOUND (modified): packages/app/src/dex/DexView.tsx
- FOUND: commit 40c2ec9
- FOUND: commit d768562
- FOUND: commit e281d3e

---
phase: 20-presence-interactions
plan: 04
subsystem: ui
tags: [react, presence, friends, reactions, useSyncExternalStore, slot-fill, tdd]

# Dependency graph
requires:
  - phase: 20-presence-interactions
    plan: 01
    provides: "config.copy.presence (atShow/offline/waveEntry/waveAtFriend/reactionTitle/targetEveryone) + Activity/Tab types"
  - phase: 20-presence-interactions
    plan: 02
    provides: "ReactionPalette.tsx (open/onClose/initialTarget/friends) → the one shared sendWave path"
  - phase: 20-presence-interactions
    plan: 03
    provides: "usePresenceFor(userId) / useSelfPresence() pure readers (online-gated, D-16/D-17)"
  - phase: 19-shared-dex-progress
    provides: "FriendRow/SelfRow reserved presence slots + FriendsList/FriendDetail row + buildFriendRows + IdentityGlyph"
provides:
  - "FriendRow presence slot fillers (PresenceOnlineSlot/PresenceActivitySlot) — 8px #22C55E dot + coarse activity label (At-a-show emphasis)"
  - "SelfRow own live dot/activity via useSelfPresence; offline hides dot + reads `offline` (D-15/D-17)"
  - "FriendsList per-row presence via a PresenceFriendRow child + a `React`/wave header entry opening ReactionPalette (Everyone default)"
  - "FriendDetail pre-targeted `Wave at {name}` header button opening the shared palette (initialTarget=friend.userId)"
affects: [friends-screen, presence-dots, wave-send]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reserved-slot fusion: Phase-19 pre-scaffolded empty presence slots fill from pure props (dot + label) with zero row rebuild (D-13)"
    - "Per-row presence read extracted into a tiny PresenceFriendRow child so usePresenceFor is called once-per-row legally (rules of hooks)"
    - "Dot never conveys state by color alone — pairs with the visible text activity label (WCAG 1.4.1)"
    - "Both send entry points render the SAME ReactionPalette Sheet → the one sendWave path; no new hash route, no new z-tier"

key-files:
  created:
    - packages/app/test/dex/friendPresence.test.tsx
  modified:
    - packages/app/src/dex/FriendRow.tsx
    - packages/app/src/dex/SelfRow.tsx
    - packages/app/src/dex/FriendsList.tsx
    - packages/app/src/dex/FriendDetail.tsx

key-decisions:
  - "Shared PresenceOnlineSlot/PresenceActivitySlot fillers exported from FriendRow so FriendRow + SelfRow render byte-identical dots/labels; the self `offline` case uses an explicit label override rather than a synthetic Activity"
  - "The self-row presence hook is called before the calm-frame early-return to keep hook order stable across the loading→ready transition (rules of hooks)"
  - "FriendDetail places the pre-targeted Wave button in the always-rendered header (renders in both the loader frame and the loaded overlay); the palette element is rendered inside both Sheet returns"

patterns-established:
  - "TDD RED→GREEN: Task-1 slot-fill spec committed failing before implementation"

requirements-completed: [PRES-01, PRES-04, PRES-05, PRES-07]

# Metrics
duration: 7min
completed: 2026-07-24
---

# Phase 20 Plan 04: Presence Fusion into the Friends Screen Summary

**The visible payoff lands: the already-reserved `FriendRow`/`SelfRow` presence slots fill from the pure Phase-20 readers — an 8px `#22C55E` online dot + the coarse activity label (with the residency-defining `At a show 🎸` emphasis), the You row's own live dot/activity that honestly reads `offline` when disconnected, all friend dots going dark when the viewer is offline while dimmed cached PROG rows persist — plus the two send entry points (a `React` header affordance and a pre-targeted `Wave at {name}` button) both routing through the one shared `ReactionPalette` → `sendWave` path.**

## Performance

- **Duration:** ~7 min
- **Tasks:** 2 (Task 1 TDD RED→GREEN; Task 2 wiring with RED-first entry-point tests)
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- **`FriendRow.tsx`** — added `online: boolean` + `activity: Activity | null` props and two exported slot fillers:
  - `PresenceOnlineSlot` fills the leading `presence-online` slot with an 8px `h-2 w-2 rounded-full` dot in the shipped SyncDot online-green `#22C55E` (data-semantic, never routed through `--color-accent`), rendered ONLY when `online` — honest absence otherwise (D-16).
  - `PresenceActivitySlot` fills the trailing `presence-activity` slot: `null` → nothing; `atShow` → `config.copy.presence.atShow` (`At a show 🎸`) in `text-text-primary` emphasis; else the `activity.tab` brand token in muted `text-[13px]`. A present row shows BOTH the dot and the text label (WCAG 1.4.1). The row stays a PURE props consumer — no channel logic (D-13/D-19).
- **`SelfRow.tsx`** — consumes `useSelfPresence()` (called before the calm-frame early-return for stable hook order) to fill its own slots: dot + local activity when online, or the dot hidden + `config.copy.presence.offline` (muted) when offline (D-15/D-17). Stays local-sourced and never dimmed.
- **`FriendsList.tsx`** — extracted a `PresenceFriendRow` child that reads `usePresenceFor(friend.userId)` once per row (rules of hooks) and passes `online`/`activity` into `FriendRow`; because the reader already returns the offline shape when the viewer is offline (D-16), no extra offline branch was needed and the existing dimmed-rows + offline-marker path is untouched. Added a compact `React`/wave header control (`aria-label`, `min-h-11 min-w-11`, lucide `Hand`) that opens `<ReactionPalette initialTarget={null} friends={rows} />` (Everyone default). No online-only placeholder rows are ever added (D-13) — membership stays `buildFriendRows`-owned.
- **`FriendDetail.tsx`** — added a pre-targeted `Wave at {name}` button in the always-rendered header (escaped `friendName`, `min-h-11 min-w-11`) opening `<ReactionPalette initialTarget={friend.userId} friends={[friend]} />`; the palette element is rendered inside both the loader-frame Sheet and the loaded Sheet. Shares the one `sendWave` path (D-07); no new hash route, no new z-tier.
- **`friendPresence.test.tsx`** — 13 new assertions covering the full `<behavior>` table: FriendRow dot on/off + activity variants (incl. `At a show 🎸` emphasis + null) + dot-and-label WCAG pairing, SelfRow own dot / atShow / offline-reads-`offline`, FriendsList per-row store fill, the viewer-offline hide-all-dots-but-keep-dimmed-rows case (D-16), the no-placeholder-rows guarantee (D-13), and both send entry points opening the shared palette.

## Task Commits

1. **Task 1 (RED): PRES-07 slot-fill + offline-hide failing test** — `da9df39` (test)
2. **Task 1 (GREEN): fill FriendRow/SelfRow slots + wire per-row presence** — `e04414f` (feat)
3. **Task 2 (GREEN): wave send entry points + entry-point tests** — `b661217` (feat)

_No REFACTOR commits needed._

## Files Created/Modified

- `packages/app/test/dex/friendPresence.test.tsx` — the PRES-07 fusion behavior table + entry-point open tests.
- `packages/app/src/dex/FriendRow.tsx` — presence props + exported `PresenceOnlineSlot`/`PresenceActivitySlot` fillers.
- `packages/app/src/dex/SelfRow.tsx` — own dot/activity via `useSelfPresence`; offline hides dot + reads `offline`.
- `packages/app/src/dex/FriendsList.tsx` — `PresenceFriendRow` per-row reader child + `React`/wave header palette entry.
- `packages/app/src/dex/FriendDetail.tsx` — pre-targeted `Wave at {name}` header button + shared palette.

## Decisions Made

- **Shared slot fillers exported from FriendRow.** Rather than duplicate the dot/label markup in SelfRow, `PresenceOnlineSlot`/`PresenceActivitySlot` are exported and consumed by both rows so the dot hue/size and label styling are byte-identical. The self-row `offline` state uses an explicit `label` override on the activity slot rather than fabricating a synthetic `Activity`, keeping the `Tab` vocabulary closed.
- **Self presence hook before the early-return.** `useSelfPresence()` is called at the top of `SelfRow`, before the `identity == null || !stats.ready` calm-frame return, so hook order stays stable across the loading→ready transition (rules of hooks).
- **FriendDetail wave button in the header.** Placed in the shared `header` const (always rendered, including the loader-failure frame) so the send affordance is available even before the head-to-head reads resolve; the palette element is rendered in both Sheet returns.

## Deviations from Plan

None — plan executed as written. The plan's Task-2 `<files>` list is source-only, but I additionally appended two entry-point "opens the shared palette" assertions to `friendPresence.test.tsx` (written RED-first, verified failing before implementation) to give the wiring real coverage beyond the typecheck gate. This strengthens verification within the plan's intent (Task 2 is `tdd="true"`); no source-level departure.

## TDD Gate Compliance

- **Task 1** followed RED→GREEN in git order: `test(20-04)` (`da9df39`, slot-not-filled failures) preceded `feat(20-04)` (`e04414f`).
- **Task 2** entry-point tests were written RED-first (verified 2 failing before implementing the buttons) but — because the plan allocated no dedicated Task-2 test file (its `<files>` is source-only, verification is typecheck + existing dex tests) — the failing tests were committed together with the implementation in `b661217`, mirroring the 20-02 Task-2 typecheck-verified pattern. Not a gate violation.

## Threat Register Coverage

All `mitigate`-disposition threats assigned to this plan's files are honored:
- **T-20-06** (XSS) — activity labels come from the closed `Tab` set + `config.copy.presence` (no user text); friend names render as escaped React text, `truncate min-w-0` clamped; no `dangerouslySetInnerHTML`.
- **T-20-03** (info disclosure) — the label is the coarse tab token or `At a show 🎸` (a boolean), never a song/setlist position.
- **T-20-11** (stale-green lie) — the dot/label are gated by `usePresenceFor`/`useSelfPresence` on the viewer's online status; when offline NO green dot renders (unit-tested D-16/D-17 hide-all case).
- **T-20-12** (access control) — the FriendDetail targeted wave carries `to:friend.userId`; the receiver still enforces `to===null || to===me` (validateWave, 20-01), so a mis-target is ignored on receipt.
- **T-20-SC** (installs) — no new dependencies added.

## Verification

- `npx tsc -p packages/app --noEmit` → exits 0.
- `npm test -- --run packages/app/test/dex` → 3 files / 30 tests green (friendPresence 13 + friendDetail + compareView).
- `npm test -- --run` (full suite) → 124 files / 947 tests green (incl. `packages/core/test/purity.test.ts`, SETUP-04) — no regression.

## Known Stubs

None — every slot fills from a live reader and both entry points route to the shipped `sendWave`. The receive path (`WaveToast`) and the engine (`usePresence`) shipped in 20-02/20-03; this plan wires the visible send + display surface.

## Next Phase Readiness

- Presence is now visible end-to-end: friend rows show live dots + coarse activity (incl. `At a show 🎸`), the You row reads its own status honestly, and both send entry points are live. The full two-device live round-trip (dots + waves across real sessions) is the remaining device-UAT gate, not a code gap.

## Self-Check: PASSED

The created test file + all 4 modified source files exist on disk; all 3 task commits (`da9df39`, `e04414f`, `b661217`) are in git history.

---
*Phase: 20-presence-interactions*
*Completed: 2026-07-24*

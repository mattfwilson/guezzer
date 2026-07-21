---
phase: 15-gizz-bingo-persistence-lock-replay
reviewed: 2026-07-20T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - packages/core/src/data-safety/export-schema.ts
  - packages/core/src/data-safety/merge.ts
  - packages/core/src/data-safety/serialize.ts
  - packages/app/src/db/db.ts
  - packages/app/src/config.ts
  - packages/app/src/games/bingoReplay.ts
  - packages/app/src/games/GamesView.tsx
  - packages/app/src/games/CatchUpSheet.tsx
  - packages/app/src/dex/RecapView.tsx
  - packages/app/src/components/BottomTabBar.tsx
  - packages/app/src/routing/useHashRoute.ts
  - packages/app/src/show/ShowView.tsx
  - packages/app/src/show/FabMenu.tsx
  - packages/app/src/App.tsx
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues
---

# Phase 15: Code Review Report

**Reviewed:** 2026-07-20
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed the Gizz-Bingo persistence/lock/replay slice: the envelope-v3 core
(schema/merge/serialize), the Dexie `version(5)` app threading, the pure
`replayCard` adapter, the GizzGames tab, the RecapView bingo section, and the
BINGO-06 catch-up surface.

The core stays pure (no DOM/React imports in `export-schema.ts` / `merge.ts` /
`serialize.ts`), the `version(5)` migration is genuinely additive, marks are
never stored, and the single-device export/import roundtrip preserves
`bingoCards` with the locked-wins collision rule intact. Those stated invariants
hold.

Three real defects surfaced. The blocker is in catch-up: the confirm-list
re-checks every row the user unticked on each live feed poll, so the D-03 "human
is the honest arbiter" guarantee silently fails at exactly the live-venue
condition it exists for, and mis-scraped songs can be committed to the trail. Two
warnings concern the bingo-card persistence machinery interacting with the
existing same-show dedupe (orphaned locked cards) and replay surfaces not gating
on lock state (draft cards replay with a wrong `neverCaught`).

## Critical Issues

### CR-01: Catch-up confirm-list re-checks unticked rows on every live feed poll

**File:** `packages/app/src/games/CatchUpSheet.tsx:66-68` (driven by `packages/app/src/show/ShowView.tsx:229-237`)

**Issue:** `CatchUpSheet` seeds its `checked` set from the `candidates` prop and
re-seeds it in a `useEffect` keyed on `[candidates]`:

```ts
useEffect(() => {
  setChecked(new Set(candidates.map((c) => c.songId)));
}, [candidates]);
```

`candidates` is `ShowView`'s `catchUpCandidates` memo, whose deps are
`[guardedRows, session.entries]`. `guardedRows` is recomputed to a *new array
reference* on every `latest` poll (`setLatestRows(result.rows)` always stores a
fresh array), so `catchUpCandidates` gets a new identity every poll cycle even
when the sheet is open. Each new identity fires the effect and **resets every row
back to checked**, discarding the unticks the user just made.

While a show is active and online the poll runs on a fixed cadge, so a
late-joining user correcting a mis-scraped feed (the exact D-03 scenario:
"Untick anything wrong") has their corrections wiped mid-task. If a poll lands
between the untick and the "Add {n}" tap, `handleAdd` reads the reset `checked`
set and commits songs the user deliberately removed straight into the trail via
`adoptSuggestion` — silent setlist corruption, and it defeats catch-up's entire
safety premise (not a silent bulk auto-adopt).

**Fix:** Do not clobber in-progress user selections on a background data refresh.
Seed once when the sheet transitions to open, and only reconcile *new* candidates
as checked without un-setting existing user choices. For example:

```ts
// Re-seed only when the sheet opens; never on a background poll.
useEffect(() => {
  if (open) setChecked(new Set(candidates.map((c) => c.songId)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [open]);
```

If newly-arrived candidates must be reflected while open, merge them additively
(pre-check only ids not previously seen) instead of rebuilding the whole set, so
an untick sticks. Alternatively, pause polling / snapshot the candidate list
while `catchUpOpen` is true.

## Warnings

### WR-01: Same-show dedupe orphans a locked bingo card (replay lost for that night)

**File:** `packages/core/src/data-safety/merge.ts:163-173` (with `packages/app/src/db/db.ts:708-712`)

**Issue:** `bingoCards` are merged by `cardId`, and `cardId == sessionId`
(`db.ts` `saveDraftCard`). The D-11 same-show dedupe (`merge.ts` step 5) collapses
a night tracked on two devices into ONE canonical `sessionId`; the losing
session's `trackedShow` row is dropped from `finalShows` and its entries are
re-stamped onto the canonical session. The `bingoCards` merge runs independently
and does not re-point cards, so a card keyed to the dropped session survives
referencing a `sessionId` that no longer has a show or trail.

Result: `RecapView` looks up the card by the *canonical* `sessionId`
(`RecapView.tsx:123`) and finds none, so the night's replay section silently
disappears; `replayCard` over the (now empty) canonical-vs-orphan trail yields an
all-dark board. `GamesView` (which reads `db.bingoCards` directly) lists the
orphaned card as if replayable, but no RecapView will ever render it. Because
`importSnapshot` commits `bingoCards` union-only (never clears), the orphan
persists across future imports.

Not reachable until Phase 16 deals cards, and only in the two-device
same-night-both-dealt case, but the merge ships now and the machinery is what is
under review. Could escalate to Critical once deal UX lands.

**Fix:** When the dedupe re-stamps a losing session onto a canonical one, carry
its `bingoCards` row along: re-key the card's `cardId`/`sessionId` to the
canonical session (respecting the locked-wins rule if the canonical session
already has a card), or explicitly drop the orphan. Do this inside the same group
loop that adopts entries so cards and trails stay consistent.

### WR-02: Replay surfaces do not gate on `lockedAt`, so draft cards replay with an empty `caughtSnapshot`

**File:** `packages/app/src/games/GamesView.tsx:33-34` and `packages/app/src/dex/RecapView.tsx:120-133`

**Issue:** `saveDraftCard` persists an unlocked draft immediately with
`caughtSnapshot: []` and `lockedAt: null` (D-08). Neither the GizzGames replay
list (`db.bingoCards.toArray()`) nor the RecapView bingo memo filters on
`lockedAt != null`. Consequences once Phase 16 deals a draft on the current
(not-yet-locked, not-yet-played) show:

- `GamesView` immediately lists the in-progress show's draft as a "past card to
  relive," contradicting its own empty/relive framing.
- `replayCard` runs with `new Set(row.caughtSnapshot)` = empty set, so the
  `neverCaught` predicate (`mark.ts:94`) matches *every* played song and the
  `neverCaught` square lights on the first qualifier — a wrong board, because the
  frozen catch-set only becomes meaningful at lock (`lockCard`).

The `caughtSnapshot` freeze is the documented replay-drift guard (RESEARCH
Pitfall 1); replaying an unlocked draft bypasses it.

**Fix:** Treat only locked cards as replayable. Filter the GizzGames list and the
RecapView lookup on `lockedAt != null`, e.g.
`bingoCards.find((c) => c.sessionId === sessionId && c.lockedAt != null)` and
`db.bingoCards.filter((c) => c.lockedAt != null)`.

## Info

### IN-01: GizzGames list shows the show date twice when `venueName` is null

**File:** `packages/app/src/games/GamesView.tsx:25-28, 65-70`

**Issue:** The list item title is `card.venueName ?? card.showDate` and the
subline is `cardSubline` = `[showDate, city].join(" · ")`. For a card with no
bound venue (`venueName` null — the common pre-bind state), the title renders the
`showDate` and the subline leads with the same `showDate`, so the date appears
twice on one row.

**Fix:** Drop `showDate` from `cardSubline` when it is already the title, or build
the subline as venue-vs-date-aware (show `city` alone as the subline when the
title fell back to the date).

### IN-02: Fire-and-forget catch-up writes surface no failure to the user

**File:** `packages/app/src/games/CatchUpSheet.tsx:87-97`

**Issue:** `handleAdd` loops `void adoptSuggestion(...)` and immediately `close()`s.
This matches the established `void logSong(...)` project convention (ShowView
relies on Dexie `liveQuery` for reactive UI), so it is not a defect on its own,
but on this bulk path a rejected `adoptSuggestion` (e.g. the session was
finalized between open and Add) is an unhandled rejection with no user-visible
signal and no partial-failure feedback — the sheet reports success by closing.

**Fix:** Optional — `await` the adopts (or `Promise.allSettled`) and keep the
sheet open with a brief error line if any row fails, so a late finalize does not
silently drop songs.

---

_Reviewed: 2026-07-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

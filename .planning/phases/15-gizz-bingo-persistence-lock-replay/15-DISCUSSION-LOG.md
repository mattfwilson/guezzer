# Phase 15: Gizz Bingo — Persistence, Lock & Replay - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-20
**Phase:** 15-gizz-bingo-persistence-lock-replay
**Areas discussed:** GizzGames tab shape, Catch-up flow (BINGO-06), Replay presentation (BINGO-07), Lock timing & card lifecycle, GizzGames empty state, Locked-card reshuffle feedback, Backup inclusion & merge, Row shape

---

## GizzGames tab shape

| Option | Description | Selected |
|--------|-------------|----------|
| New 4th bottom tab | GizzGames alongside LiveGizz/GizzVerse/GizzDex; room for future games; 3→4 tabs | ✓ |
| Inside GizzDex | Bingo history under GizzDex; keeps 3 tabs; games ≠ dex conceptually | |
| Active card on LiveGizz | Live card on Show tab, replay in GizzDex, no games tab yet | |

**User's choice:** New 4th bottom tab.
**Notes:** Forward-compatible home for Gizzle / Guezz League / other future games.

### Phase-15 fill

| Option | Description | Selected |
|--------|-------------|----------|
| Replay/history only | Past cards read-only; Deal is a Phase-16 stub | ✓ |
| Minimal deal + replay | Bare-bones deal so create→lock→replay works end-to-end this phase | |
| You decide | — | |

**User's choice:** Replay/history only.
**Notes:** Lock/freeze/persist machinery still built + fixture-tested in Phase 15; user-facing deal deferred to Phase 16.

---

## Catch-up flow (BINGO-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm-list (checklist) | Pre-checked list of missed songs; untick wrong ones; Add N; per-row adoptSuggestion | ✓ |
| One-tap add-all + undo | Bulk-adopt instantly with Undo toast; trusts the feed | |
| You decide | — | |

**User's choice:** Confirm-list (checklist).
**Notes:** Keeps the human as the honest hit/miss denominator against a mis-scraped latest feed.

### Manual mark

| Option | Description | Selected |
|--------|-------------|----------|
| Search song → log it | Reuse fuse.js; log song to trail; deriveMarks lights the square | ✓ |
| Tap square → pick song | Square-first; only works for squares with knowable candidates | |
| Both | Global search + square shortcut pre-filter | |

**User's choice:** Search song → log it.
**Notes:** Consistent with D-23 (marks derived) — no direct square-tap marking.

---

## Replay presentation (BINGO-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Section in RecapView | Bingo section in the existing per-show recap; re-derives from same trail; absent w/o card | ✓ |
| Separate drill-in | Distinct full-screen board via a second navigation layer | |
| You decide | — | |

**User's choice:** Section in RecapView.
**Notes:** One-screen-per-show mental model; maximal reuse of the existing pure-derivation screen.

### Replay detail

| Option | Description | Selected |
|--------|-------------|----------|
| Full: board + win + what-lit | Grid + marks + win badges + per-square "which song lit this" | ✓ |
| Final board + win state | Grid + win badges only | |
| You decide | — | |

**User's choice:** Full: board + win + what-lit.
**Notes:** Replay is a "relive it" payoff, not a bare scoreline.

---

## Lock timing & card lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Opt-in, one card max | Card only if dealt; zero or one per show | ✓ |
| Auto-dealt every show | Every tracked show gets a card | |
| You decide | — | |

**User's choice:** Opt-in, one card max. Matches "casual +1 anchor"; avoids replay clutter.

### Draft lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Persist draft (unlocked row) | Written to Dexie immediately (lock ts null); Start Show flips to locked + freezes defs | ✓ |
| Ephemeral until lock | Draft in memory only until Start Show | |
| You decide | — | |

**User's choice:** Persist draft (unlocked row). Crash-proof like the setlist trail.

### Late deal

| Option | Description | Selected |
|--------|-------------|----------|
| Lock immediately on deal | Dealing during an active show locks now; catch-up back-fills | ✓ |
| Only Start Show locks | Lock strictly tied to Start Show; needs separate explicit lock mid-show | |
| You decide | — | |

**User's choice:** Lock immediately on deal. Cleanly handles the late-join BINGO-06 case.

---

## GizzGames empty state

| Option | Description | Selected |
|--------|-------------|----------|
| Replay list + coming-soon | Empty replay list + "Deal a card — coming soon" teaser | ✓ |
| Pure replay list | History list only, no teaser | |
| You decide | — | |

**User's choice:** Replay list + coming-soon. Must not read as broken pre-Phase-16.

---

## Locked-card reshuffle feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Control gone once locked | No reshuffle affordance on a locked card | |
| Disabled + explain | Greyed control + "Locked at Start Show" explainer | ✓ |
| You decide | — | |

**User's choice:** Disabled + explain (applies to the Phase-16 build surface; core still hard-rejects reshuffle on a non-active session in Phase 15).

---

## Backup inclusion & merge

| Option | Description | Selected |
|--------|-------------|----------|
| Always included; imported wins | Cards always exported; import = bulkPut by cardId, imported wins on collision | ✓ |
| Always included; keep local | Additive-only import; local kept on collision | |
| You decide | — | |

**User's choice:** Always included; imported wins. Matches the existing archiveShows/trackedShows merge convention.

---

## What the row stores

| Option | Description | Selected |
|--------|-------------|----------|
| Denormalize date + venue | Store showDate + venueName + city on the card row; no join needed; standalone export | ✓ |
| Just sessionId link | Store only sessionId; join to trackedShows at render | |
| You decide | — | |

**User's choice:** Denormalize date + venue. Simpler replay-list/RecapView reads; card carries its own context.

---

## Claude's Discretion

- Concrete `cardId` derivation/hash (subject to stable, merge-safe requirement).
- Exact zod schema for the `bingoCards` row + export-envelope migration wiring; `MIGRATIONS`/version-bump mechanics.
- GizzGames tab icon; exact copy/layout of the empty-state teaser and RecapView bingo section.
- Whether catch-up + manual-search surfaces are a shared component or attach to the live Show surface (subject to reusing `adoptSuggestion` + fuse.js).

## Deferred Ideas

- Phase 16: Deal/vibe/swap build UX, live auto-marking, "one away" tension, celebrations, share-card image (BINGO-01/02/04/05/08).
- Future games sharing the GizzGames tab: Gizzle, Guezz League, Couch Mode, Residency Mode, badges, My Stats/Want List — each its own future phase/seed.
- Shared-seed leaderboard / cross-friend comparable cards (GAME-V1.3-01) — post-v1, needs a backend.
- Segue square, pre-2020 replay cards (cover/encore/Set-2) — Phase-14 D-24 future scope.

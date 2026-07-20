# Phase 15: Gizz Bingo — Persistence, Lock & Replay - Context

**Gathered:** 2026-07-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Freeze the Phase-14 `BingoCard` artifact into Dexie, lock it on Start Show, round-trip
it through the JSON backup, and make past cards replayable from GizzDex history —
**before** Phase 16 builds the delight/build layer (Deal/vibe/swap UX, live marking,
celebrations, share card) on top. Delivers **BINGO-06** (catch-up) and **BINGO-07**
(replay).

**In scope:**
- Dexie `version(5)` — a new `bingoCards` table (ADDITIVE; preserves v1–v4 tables),
  the lock-on-Start-Show freeze of RESOLVED square defs, and reshuffle-rejection on a
  non-active session.
- Export/import round-trip for bingo cards — envelope `SCHEMA_VERSION` bump, `MIGRATIONS`
  entry, `bulkPut` by stable `cardId`.
- **Catch-up (BINGO-06):** a bulk-log surface reusing the shipped `adoptSuggestion` path +
  manual search-and-log.
- **Replay (BINGO-07):** a read-only frozen-card view derived from GizzDex history.
- A **new 4th bottom tab, "GizzGames"**, wired as the home for the replay surface (empty/
  replay-only this phase).

**Out of scope (Phase 16):** the Deal/vibe/swap **build UX** that produces a card, the
live auto-marking surface, "one away" tension, celebrations, the share-card image. Marks
are **DERIVED, never stored** — replay and catch-up are pure re-derivations over the trail
via the Phase-14 `deriveMarks` fold. No new dependencies, no new build-time data artifact.

**Sequencing note (important for the planner):** Because the user-facing **deal** UX is
Phase 16, Phase 15 builds and **fixture-tests** the full persistence/lock/freeze machinery
(schema, lock state-machine, freeze-resolved-defs, export/import merge) so it fires for real
once Phase 16 deals a card. The GizzGames tab is therefore a **replay shell + a Phase-16
"Deal — coming soon" stub** until Phase 16 lands. Design the schema and lock functions in
Phase 15 to satisfy every lifecycle decision below (draft persistence, Start-Show lock,
late-deal immediate lock) even though the UI that exercises them arrives next phase.

</domain>

<decisions>
## Implementation Decisions

### Navigation & Phase-15 surface
- **D-01:** Gizz Bingo lives in a **new 4th bottom tab, "GizzGames"** (alongside LiveGizz /
  GizzVerse / GizzDex in `BottomTabBar.tsx`). Room to grow — future games (Gizzle, Guezz
  League) share this tab. Accept the 3→4 tab tap-target tightening.
- **D-02:** The Phase-15 GizzGames surface is **replay/history only** — the Deal/build UX is
  Phase 16. It lists past shows that have a bingo card (replayable) and shows an honest
  **"Deal a card — coming soon" teaser** where the Phase-16 deal entry point will land.
  Empty at first; must not read as broken.

### Catch-up (BINGO-06)
- **D-03:** "Catch me up" on a late-joined show presents a **pre-checked confirm-list** of the
  songs the tracker missed (pulled from the live `latest` feed) — the user unticks any wrong
  rows, then taps **Add N**. Each added row commits via the shipped **`adoptSuggestion`** path
  (`packages/app/src/show/ShowView.tsx`), preserving the honest hit/miss denominator. Not a
  silent auto-adopt — the one-thumb-in-the-dark user stays the final arbiter against a
  mis-scraped feed.
- **D-04:** Manual marking of a square the feed missed = **search the song → log it to the
  trail** (reuse the existing fuse.js catalog search, same UX as the live editor). Per D-23,
  marks are derived: logging the song runs `deriveMarks` and lights whatever square it
  qualifies for. There is **no direct "tap a square to mark it"** — all marks flow through the
  trail.

### Replay (BINGO-07)
- **D-05:** A past show's frozen card surfaces as a **"Bingo" section inside the existing
  `RecapView`** (`packages/app/src/dex/RecapView.tsx`) — one screen per show (setlist recap +
  catches + bingo). Re-derives from the same persisted trail RecapView already reads. The
  section is **absent** for shows that have no card.
- **D-06:** Replay shows **full detail** — the final 4×4 board with marked squares, win badges
  (line / four-corners / X / blackout), **and** per-square "which song lit this" (the fold
  already carries it). Read-only. A "relive it" payoff, not just an outcome summary.

### Card lifecycle & lock (feeds the `bingoCards` schema)
- **D-07:** Bingo is **opt-in, one card max per show.** A tracked show has **zero or one**
  `bingoCards` row (matches the "casual +1 anchor" framing; avoids replay-list clutter and a
  forced default vibe on shows you didn't play).
- **D-08:** A dealt-but-unlocked card is **persisted immediately as an unlocked draft** (lock
  timestamp `null`), so it survives an iOS force-quit/relaunch like the setlist trail already
  does. **Start Show flips it to locked** — stamps `lockedAt` and freezes the RESOLVED square
  defs into the row (incl. the D-12 never-caught snapshot). A later corpus/config change can
  never silently re-deal a locked historical card.
- **D-09:** If a card is dealt **after** a show already started (late join), it **locks
  immediately on deal** (freeze defs now); "Catch me up" (D-03) then back-fills the trail. This
  is the common BINGO-06 scenario — the lock is not strictly bound to the Start-Show action.
- **D-10:** **Reshuffle is rejected on a locked / non-active session** (roadmap SC-1). Core
  hard-rejects reshuffle when the session is not active (the safety net, lands Phase 15). At the
  Phase-16 build surface, the reshuffle/swap control is shown **greyed with a "Locked at Start
  Show" explainer** rather than silently removed.

### Persistence, backup & row shape
- **D-11:** The `bingoCards` row persists: **stable `cardId`, `sessionId` link, `seed`, `vibe`,
  frozen `resolvedDefs`, `lockedAt` (nullable), and denormalized `showDate` + `venueName` +
  `city`.** Denormalizing show identity lets the GizzGames replay list and the RecapView section
  render without joining back to `trackedShows`, and lets an exported card carry its own context.
  **Marks are NOT stored** (D-23) — re-derived on every read.
- **D-12:** `cardId` MUST be a **stable, device-independent, merge-safe key** (NOT the volatile
  Dexie `++id`) so `bulkPut` merges cleanly across devices — mirrors the existing `archiveShows`
  `show_id` / `trackedShows` `sessionId` merge discipline (CR-01 / T-05-07 in `db.ts`). Exact
  derivation (e.g. hash of seed+session) is Claude's discretion.
- **D-13:** Bingo cards are **always included in the JSON backup export** (they're tiny). On
  import they merge via **`bulkPut` by `cardId` — the imported card wins on collision**,
  consistent with how `archiveShows` / `trackedShows` already merge. The backup stays the honest
  full-state snapshot (the iOS-eviction backstop).
- **D-14:** Dexie `version(5)` is **ADDITIVE** — v1–v4 tables untouched, no destructive rewrite,
  no data loss (mirrors the v3/v4 additive precedent in `db.ts`). A populated v4 DB upgrades in
  place. The export envelope's `SCHEMA_VERSION` bumps and a `MIGRATIONS` entry is added
  (roadmap SC-4).

### Claude's Discretion
- The concrete `cardId` derivation/hash (subject to D-12's stable-merge-safe requirement).
- The exact zod schema shape for the `bingoCards` row and the export envelope migration wiring.
- Precise `MIGRATIONS` entry / envelope-version bump mechanics.
- The GizzGames tab icon and the exact copy/layout of the empty-state teaser (D-02) and the
  RecapView bingo section (D-05/D-06).
- Whether the catch-up confirm-list and manual-search surfaces live on the live Show surface,
  the active-card view, or a shared component — subject to reusing `adoptSuggestion` (D-03) and
  the fuse.js search (D-04).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The frozen contract this phase persists (direct dependency — Phase 14)
- `.planning/phases/14-gizz-bingo-core-marking-generation/14-CONTEXT.md` — the locked Phase-14
  decisions: `BingoCard` serializable JSON contract, `deriveMarks` consume-once fold
  (`live == replay == catch-up`, D-07/D-11/D-23), specificity tie-break (D-08/D-09/D-10),
  freeze-resolved-defs + never-caught-at-lock (D-12), string-seed determinism (D-21), core-purity
  trail contract (D-22). **This phase must not re-litigate these.**
- `packages/core/src/bingo/` — the shipped core module (`types`, `context`, `generate`, `mark`,
  `wins`) + the `BingoCard` type + zod schema. Phase 15 persists and re-derives over these; it
  does NOT change the fold.
- `packages/core/src/config.ts` §bingo — the locked calibration constants (`freeIndex`, vibe
  targets, rosters). Frozen `resolvedDefs` snapshot these at lock so replay is drift-proof.

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §Gizz Bingo — **BINGO-06** (catch-up), **BINGO-07** (replay);
  the segue-exclusion + phase-gate notes.
- `.planning/ROADMAP.md` §"Phase 15" — goal + 4 success criteria (lock-freeze, catch-up, replay,
  Dexie v5 round-trip). §"Phase 16" for the downstream build/marking/celebration scope this phase
  must NOT pull forward.

### Feature research (v1.2 — context, not re-litigated here)
- `.planning/research/v1.2/PITFALLS.md` — freeze-resolved-defs, consume-once enforcement,
  non-deterministic marking, the export/backup round-trip (Pitfall 5), live-sync HARD dependency.
- `.planning/research/v1.2/ARCHITECTURE.md` — third-derivation-over-trail thesis; where the
  persistence layer sits relative to core.
- `.planning/research/v1.2/STACK.md` — zero-new-dependency reuse map (Dexie versioning, envelope).
- `.planning/notes/gizz-bingo-design-vetting.md` — empirical corpus source of truth (median 15
  songs, event fire-rates) underpinning the frozen defs.

### Persistence & data-safety code the schema must match
- `packages/app/src/db/db.ts` — the Dexie class: v1–v4 additive versioning precedent, the
  `DbSnapshot` shape, `bulkPut`-by-stable-key merge discipline (CR-01 / T-05-07), `importSnapshot`.
  Phase 15 adds `version(5)` + `bingoCards` here.
- `packages/core/src/data-safety/export-schema.ts` — the `SCHEMA_VERSION`-pinned envelope zod
  schema. Bump + `MIGRATIONS` entry lands here.
- `packages/app/src/settings/exportDownload.ts` / `importPicker.ts` — the export/import UI wiring
  the round-trip flows through.

### Reuse targets for the catch-up & replay UI
- `packages/app/src/show/ShowView.tsx` (`adoptSuggestion` / `handleAdopt`, ~line 362) — the
  shipped advisory→logged fast path catch-up reuses (D-03).
- `packages/app/src/dex/RecapView.tsx` — the per-show payoff screen the replay section attaches to
  (D-05/D-06); already a pure derivation over persisted `trackedEntries`.
- `packages/app/src/components/BottomTabBar.tsx` + `packages/app/src/routing/useHashRoute.ts`
  (`Route` union / `ROUTES`) — where the new GizzGames tab + route are added (D-01).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`adoptSuggestion` / `handleAdopt` (`show/ShowView.tsx`):** the exact advisory→logged fast
  path BINGO-06 catch-up reuses per-row (D-03) — stamps `source:"editor"`, preserves the honest
  hit/miss denominator.
- **fuse.js catalog search:** already wrapped for the live editor; the manual "search song → log"
  path (D-04) reuses it — no new search surface.
- **`RecapView` (`dex/RecapView.tsx`):** a pure per-show re-derivation over persisted
  `trackedEntries` (+ `attendedShows`/`archiveShows`) — the replay section (D-05/D-06) slots in as
  a sibling to the existing recap/catches sections, re-running `deriveMarks` over the same trail.
- **`deriveMarks` / `detectWins` (`packages/core/src/bingo/`):** the shipped fold + win detector —
  replay and catch-up both call these; nothing new in core this phase.
- **Dexie additive-version precedent (`db.ts` v3/v4):** the model for `version(5)` — additive
  `.stores`, optional `.upgrade`, no destructive rewrite.
- **`bulkPut`-by-stable-key merge (`importSnapshot`, `db.ts`):** the exact discipline `bingoCards`
  merge (D-12/D-13) follows — stable `cardId`, imported-wins-on-collision.

### Established Patterns
- **Marks derived, never stored (D-23):** hard constraint — the schema stores card def + resolved
  defs + seed + vibe + lock ts + identity, never marks. Every read re-derives.
- **Freeze-resolved-defs at lock (D-12 from Phase 14):** the never-caught set + all resolved event/
  album/song square defs snapshot into the row at lock so corpus/config drift never mutates a
  historical card.
- **Envelope `SCHEMA_VERSION` pinning + `MIGRATIONS` (`export-schema.ts`):** schema drift fails
  loudly at import; the v5 bump follows this precedent.
- **Strict core purity:** `bingoCards`/Dexie is APP-side only; `packages/core/bingo` stays DOM/DB
  free (D-22). The app adapts its `TrackedEntry` rows → the core trail contract.

### Integration Points
- **`BottomTabBar.tsx` + `useHashRoute.ts` `Route`/`ROUTES`:** add the `gizzgames` route + tab (D-01).
- **Start Show action (Show Mode loop, `db.ts` write helpers):** the trigger that flips the draft
  card to locked + freezes defs (D-08); late-deal locks on deal instead (D-09).
- **`trackedShows` / `TrackedEntry`:** the trail catch-up appends to and replay re-derives over;
  `sessionId` links a `bingoCards` row to its show (with date/venue denormalized, D-11).
- **`export-schema.ts` + `exportDownload.ts` / `importPicker.ts`:** the backup round-trip (D-13/D-14).

</code_context>

<specifics>
## Specific Ideas

- The GizzGames empty state must feel intentional, not broken, while the deal UX is still pending —
  a "Deal a card — coming soon" teaser over the (initially empty) replay list (D-02).
- Replay is a "relive it" moment, not a bare scoreline — the user explicitly wanted the full board
  + win badges + per-square "which song lit this" (D-06).
- Catch-up keeps the human as the honest denominator: a pre-checked list to glance-and-correct, not
  a silent bulk-adopt, because the `latest` feed can be mis-scraped in the venue (D-03).
- The user chose to denormalize date/venue onto the card row for simpler replay-list reads and
  standalone-export context, accepting the small duplication (D-11).

</specifics>

<deferred>
## Deferred Ideas

- **Deal / vibe / swap build UX, live auto-marking, "one away" tension, celebrations, share-card
  image** — all Phase 16 (BINGO-01/02/04/05/08). Phase 15 builds the persistence/lock/replay
  machinery they sit on.
- **Future games sharing the GizzGames tab** — Gizzle (daily puzzle), Guezz League (prediction
  game), Couch Mode, Residency Mode, badges, My Stats/Want List. Each is its own future
  phase/seed; the 4th tab (D-01) is the forward-compatible home. Not folded into Phase 15.
- **Shared-seed leaderboard / cross-friend comparable cards** — GAME-V1.3-01; blocked by the
  personal never-caught square + the refused backend. Post-v1.
- **Segue square, pre-2020 replay cards (cover/encore/Set-2)** — excluded from v1 per Phase-14
  D-24; explicit future scope.

### Reviewed Todos (not folded)
- The 15 phase-matched todos are separate future features (Couch Mode, Gizzle, Guezz League,
  Residency Mode, Shiny catches, Badge system, My Stats/Want List) or general UI polish (bottom-
  sheet animation, readable date format, standalone-PWA viewport gap, final-show share card).
  None are Phase-15 persistence tasks; the umbrella "Gizz Bingo live auto-marking" todo is the
  roadmap feature itself. All left deferred to their own phases.

</deferred>

---

*Phase: 15-gizz-bingo-persistence-lock-replay*
*Context gathered: 2026-07-20*

# Architecture Research — Gizz Bingo (v1.2)

**Domain:** Live-auto-marking setlist bingo, integrated into a shipped offline-first PWA with a strict pure-core / reactive-Dexie architecture
**Researched:** 2026-07-19
**Confidence:** HIGH (grounded in the real v1.0/v1.1 source — every integration point below is a concrete file/line reference, not a guess)

> **READ-FIRST basis:** `.planning/notes/gizz-bingo-design-vetting.md` (the vetted v1 design) + the shipped source. This doc resolves that design into concrete core signatures, a serializable card JSON shape, the deterministic marking algorithm, the Dexie migration, the app wiring, and a dependency-ordered build sequence.

---

## The one-sentence integration thesis

Gizz Bingo is **a third pure-core derivation over the existing tracked-show trail** — a sibling of `deriveTally` (`packages/app/src/show/scoring.ts`) and `deriveDex` (`packages/core/src/dex/derive-dex.ts`). Card generation and consume-once marking are pure functions; **marks are DERIVED, never stored** (only the card *definition* + seed + lock timestamp persist); and the live-marking view recomputes on every `logSong` through the **same `useLiveQuery` subscription** the Show view already uses. No new sync plumbing, no second data pipeline — it composes the already-bundled `transition-matrix.json`, `archive.json`, and `dex-albums.json` artifacts.

This mirrors the codebase's deepest invariant, stated verbatim in `useShowSession.ts` and `useDexStats.ts`: *"Dexie is the single source of truth … there is NO `useState` mirror … a write-through re-runs the live query, which re-derives everything."*

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│ packages/app  (React — imports core, never the reverse)                │
│                                                                        │
│  BottomTabBar ── #/show ── #/explore ── #/dex ── #/games  ◄── NEW 4th  │
│                                                     │                  │
│                                       ┌─────────────┴──────────────┐   │
│                                       │ GizzGamesView (NEW)         │   │
│                                       │  build UX · live marking ·  │   │
│                                       │  celebrations · history     │   │
│                                       └─────────────┬──────────────┘   │
│                                                     │                  │
│                        useBingoCard()  ◄── NEW hook, mirrors           │
│                        useShowSession / useDexStats                    │
│              ┌──────────────────────┼───────────────────────┐         │
│              │ useLiveQuery         │ guarded artifact       │         │
│              │  bingoCards (active) │  loaders (memoized):    │         │
│              │  trackedEntries      │  @matrix @archive       │         │
│              │  trackedShows        │  @dex-albums            │         │
│              └──────────┬───────────┴───────────┬────────────┘         │
│                         │ writes (rw txn)       │ static (once)        │
│                         ▼                       ▼                       │
│               ┌──────────────────┐    (Vite-aliased JSON, precached)    │
│               │ Dexie v5          │                                     │
│               │  + bingoCards ◄── NEW additive table (&cardId, sessionId)│
│               └──────────────────┘                                     │
└──────────────────────────────┬─────────────────────────────────────────┘
                               │ both derive from
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│ packages/core/src/bingo/  (NEW — pure TS, zero DOM, erasableSyntaxOnly)│
│   types.ts    BingoCard / BingoSquareDef / MarkedCard / Win  (JSON)    │
│   context.ts  buildBingoContext(matrix, archive, albums, rarity, cfg)  │
│   generate.ts generateCard(seed, vibe, ctx, cfg) -> BingoCard          │
│   mark.ts     markCard(card, trail, ctx) -> MarkedCard  (consume-once) │
│   wins.ts     detectWins(marked) -> Win[]                              │
│   cli/bingo-calibrate.ts  Monte-Carlo GATE (freezes mix weights)       │
│                                                                        │
│   composes EXISTING artifacts — no new build-time artifact required:   │
│     • MatrixNode.eraPlayCount   → song-square base rates (recent freq) │
│     • MatrixNode.tuningFamily   → "microtonal" event predicate         │
│     • RarityIndex.corpusGap     → "bust-out" event predicate           │
│     • dex-albums.json           → album-membership squares (variety)   │
│     • DexSnapshotInput sightings→ "song you've never caught" (personal)│
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | New / Modified |
|-----------|----------------|----------------|
| `core/bingo/types.ts` | Serializable `BingoCard` JSON + `BingoSquareDef` union + `MarkedCard`/`Win` result types | **NEW** |
| `core/bingo/context.ts` | `buildBingoContext(...)` — resolve the shipped artifacts into fast lookups (eraPlayCount base rates, album→songId sets, microtonal set, corpusGap map) that both generate + mark read | **NEW** |
| `core/bingo/generate.ts` | `generateCard(seed, vibe, ctx, cfg)` — deterministic seeded deal, calibrated mix (≈12–13 event / 2–3 song), 16 square defs incl. one `free` | **NEW** |
| `core/bingo/mark.ts` | `markCard(card, trail, ctx)` — **consume-once greedy** assignment over the position-ordered trail | **NEW** |
| `core/bingo/wins.ts` | `detectWins(marked)` — pure 4×4 geometry: line / four-corners / X / blackout | **NEW** |
| `core/cli/bingo-calibrate.ts` | Monte-Carlo simulation over the corpus that freezes the mix/threshold constants — **the pre-plan gate** (backtest analog) | **NEW** |
| `packages/app/src/games/useBingoCard.ts` | Reactive hook: `useLiveQuery` (active card + trail) + guarded loaders + `useMemo(markCard)` + `useMemo(detectWins)` | **NEW** |
| `packages/app/src/games/GizzGamesView.tsx` | Root of `#/games`: draft/build UX pre-show, live-marking surface during, history after | **NEW** |
| `packages/app/src/db/db.ts` | `version(5)` + `bingoCards` table + `saveDraftCard`/`reshuffleCard`/`lockBingoCard`/`clearDraftCard` write helpers + snapshot inclusion | **MODIFIED** |
| `packages/app/src/routing/useHashRoute.ts` | Add `"games"` to `ROUTES` | **MODIFIED** |
| `packages/app/src/components/BottomTabBar.tsx` | Add 4th `{ route: "games", label: "GizzGames", Icon }` to `TABS` | **MODIFIED** |
| `packages/app/src/App.tsx` | Add `route === "games" ? <GizzGamesView /> :` branch; leave it OUT of the `scroll={…}` exclusion (games scrolls) | **MODIFIED** |
| `packages/core/src/config.ts` + `packages/app/src/config.ts` | Bingo constants (event catalog, jam-vehicle list, bust-out gap, calibrated mix weights) core-side; UI geometry + copy app-side | **MODIFIED** |
| `packages/core/src/index.ts` | Export the bingo public API surface | **MODIFIED** |
| `core/data-safety/{export-schema,serialize,merge}.ts` | Include `bingoCards` in the export envelope + bump `SCHEMA_VERSION` 2→3 with a `MIGRATIONS` entry | **MODIFIED** (flag) |

---

## 1. Core module shape

### Directory

Co-locate under `packages/core/src/bingo/` — matching how `dex/` and `explore/` co-locate their own types + pure fns rather than centralizing everything in `domain/types.ts`. (`domain/types.ts` is the *cross-phase frozen vocabulary*; a self-contained feature like bingo owns its own module, exactly like `dex/rarity.ts` and `dex/archive-types.ts` do.)

### Serializable BingoCard JSON shape

Follows the project's "clean serializable plain-JSON" + frozen-header convention (`schemaVersion` literal + ISO timestamps), identical in spirit to `TransitionMatrix` and `ArchiveArtifact`. **String-literal unions, never enums** (`erasableSyntaxOnly`, per CLAUDE.md + the `TransitionKind`/`SetNumber` precedent).

```typescript
/** The four win shapes achievable on a 4×4 (design-vetting "Win conditions"). */
export type BingoWinKind = "line" | "corners" | "x" | "blackout";

/** Vibe selector — biases the deal toward safe fill vs. rare glory (design "Deal my card"). */
export type BingoVibe = "chill" | "balanced" | "glory";

/**
 * The trail-DERIVABLE event catalog (recent-era, per vetting). NOTE the
 * deliberate omissions: covers/encore/set-2 are DEAD squares (dropped), and
 * "segue" is NOT here — it is not derivable from the song-level trail (see §2
 * edge cases + Anti-Pattern 2). Everything below IS a pure function of a
 * trail entry's songId + position + the shipped artifacts.
 */
export type BingoEvent =
  | "opener"        // trail position === 1
  | "microtonal"    // MatrixNode.tuningFamily === "microtonal"
  | "marathonJam"   // songId ∈ config.bingo.jamVehicleSongIds
  | "bustOut"       // RarityIndex.corpusGap >= config.bingo.bustOutGapShows
  | "neverCaught";  // songId ∉ the user's prior dex sightings (personal glory)

/**
 * One square as a serializable PREDICATE DEFINITION (never a function — the
 * card is plain JSON). markCard() interprets these against the live context.
 */
export type BingoSquareDef =
  | { kind: "free" }                                         // the single free cell
  | { kind: "song"; songId: number; label: string }         // specific-song square
  | { kind: "album"; albumUrl: string; label: string }      // album-membership (variety engine)
  | { kind: "event"; event: BingoEvent; label: string };

/**
 * The PERSISTED artifact (design: "square defs + seed + lock timestamp tied to
 * the session"). Marks are NOT stored here — they are re-derived. `squares` is
 * length 16, row-major, with EXACTLY one `{ kind: "free" }` at `freeIndex`.
 */
export interface BingoCard {
  schemaVersion: 1;
  cardId: string;            // uuid.ts (insecure-context-safe, like sessionId)
  sessionId: string | null;  // null while an unlocked draft; set on lock (mirrors TrackedShow.showId)
  seed: number;              // deterministic deal seed; reshuffle = new seed
  vibe: BingoVibe;
  freeIndex: number;         // which 0..15 cell is the free space
  generatedAt: string;       // ISO
  lockedAt: string | null;   // ISO lock timestamp; null until Start Show freezes it
  squares: BingoSquareDef[]; // length 16
}

/** markCard output — one entry per square, marks derived, plus resolved wins. */
export interface MarkedSquare {
  def: BingoSquareDef;
  index: number;
  /** trail position of the entry that consumed this square, or null if unmarked. `free` is always marked. */
  markedByPosition: number | null;
}
export interface MarkedCard {
  cardId: string;
  squares: MarkedSquare[];   // length 16
  markedCount: number;       // incl. the free cell
}

/** detectWins output — the cells forming each achieved pattern (drives celebrations). */
export interface Win {
  kind: BingoWinKind;
  cells: number[];
}
```

### Public function signatures (exported from `core/index.ts`)

```typescript
// context.ts — resolve shipped artifacts into lookups (pure; no I/O)
export function buildBingoContext(
  matrix: TransitionMatrix,          // eraPlayCount base rates + tuningFamily
  archive: ArchiveArtifact,          // (via rarity) corpusGap + song names
  albums: DexAlbumsArtifact,         // album → songId sets
  rarity: RarityIndex,               // corpusGap / playCount (already module-memoized app-side)
  cfg = config,
): BingoContext;

// generate.ts — DETERMINISTIC given (seed, vibe, ctx). Seed supplied by caller
// (app owns Math.random/Date.now; core stays pure — mirrors deriveTopOpeners
// taking its recency anchor as a param).
export function generateCard(
  seed: number,
  vibe: BingoVibe,
  ctx: BingoContext,
  dexState: ReadonlySet<number>,     // caught songIds — for "neverCaught" candidacy + personalizing squares
  cfg = config,
): BingoCard;

// mark.ts — consume-once greedy over the position-ordered trail (see §2)
export function markCard(
  card: BingoCard,
  trail: ReadonlyArray<{ songId: number | null; position: number; isPlaceholder: boolean }>,
  ctx: BingoContext,
  dexPriorSightings: ReadonlySet<number>,  // for the "neverCaught" predicate
): MarkedCard;

// wins.ts — pure 4×4 geometry over the marked grid + free cell
export function detectWins(marked: MarkedCard): Win[];

// expected-fill / difficulty meter for the build UX (analytic or calibrated)
export function expectedFill(card: BingoCard, ctx: BingoContext, cfg = config): number;
```

`BingoContext`'s shape is co-located in `context.ts` (like `RarityIndex`/`DexStats`): `{ eraPlayRate: Map<number,number>; microtonalSongIds: Set<number>; corpusGap: Map<number,number>; albumSongIds: Map<string, Set<number>>; songName: Map<number,string>; jamVehicleSongIds: Set<number>; }`.

**No new build-time artifact is required.** This is the single biggest architecture finding: every input the generator/marker needs already ships. The only *new data* is **config**: the curated `jamVehicleSongIds` list (today a throwaway name-substring script in the vetting), the `bustOutGapShows` threshold, and the calibrated mix weights per vibe. Per CLAUDE.md single-config-file rule they all live in `packages/core/src/config.ts`.

---

## 2. Consume-once greedy marking — the deterministic algorithm

**Requirement:** replay over the same trail always yields identical marks (order-stable, zero randomness), consistent with the app-wide "derive, never store" philosophy that makes unmark/rename free in the dex.

### Algorithm (order-stable, pure)

```
markCard(card, trail, ctx, priorSightings):
  markedSquares = card.squares.map(def => ({ def, index, markedByPosition: null }))
  markedSquares[card.freeIndex].markedByPosition = FREE_SENTINEL   // free cell pre-marked

  for entry in trail SORTED BY position ASCENDING:          # (1) stable trail order
    if entry.isPlaceholder or entry.songId == null: continue   # (2) ??? cannot satisfy any predicate

    qualifying = [ sq for sq in markedSquares
                   if sq.markedByPosition == null
                   and squareMatches(sq.def, entry, ctx, priorSightings) ]
    if qualifying is empty: continue

    winner = argmin over qualifying of (specificityRank(sq.def), sq.index)   # (3) deterministic tiebreak
    winner.markedByPosition = entry.position                  # consume BOTH entry and square

  return { cardId, squares: markedSquares, markedCount: count(markedByPosition != null) }
```

Three determinism guarantees:

1. **Trail iterated in ascending `position`** — already the sort key everywhere (`sortBy("position")` in `useShowSession`, `deriveRecap`).
2. **Each entry marks AT MOST one square, each square marked by AT MOST one entry** ("consume-once"). This is what prevents *1 song = 3 marks* / instant false blackout (vetting's explicit requirement).
3. **`specificityRank`** breaks multi-match ties deterministically: a specific-song square beats an album/event square (so Gaia lights its own "Gaia" square, not an album square it also satisfies), rarer events beat broad events, and **final tiebreak is ascending square `index`** — never random, never insertion-order-dependent.

Recommended `specificityRank` (lower wins): `song(0) < bustOut/neverCaught(1) < marathonJam/microtonal(2) < album(3) < opener(4)`. Opener ranks last so a position-1 song that *also* fills a rarer square isn't wasted on the abundant opener square. Tune during calibration; the important property is that it's a total order, so ties are impossible.

### Edge cases (all flagged, all handled)

| Edge case | Behavior |
|-----------|----------|
| **A song qualifies for multiple squares** | `specificityRank` + consume-once → the single most-specific unmarked square lights, deterministically. |
| **`???` placeholder (null songId)** | Matches NO predicate (skipped). Occupies a trail position, contributes zero marks. |
| **Later rename retroactively marks** | Marks are DERIVED, not stored. `renameEntry` writes a real `songId` → the `trackedEntries` `useLiveQuery` re-fires → `markCard` re-runs over the whole trail → the square lights for free. No stored mark to reconcile (identical to dex "unmark is free"). |
| **Sandwich / reprise (same songId twice)** | Two entries, same songId. First occurrence consumes one qualifying square; the second consumes a *different* still-unmarked qualifying square (or none). Consume-once still caps it — a repeat can legitimately fill a second matching square without triple-marking. |
| **Marks are non-sticky under edits** | Because marking is a pure function of the *current* full trail, inserting/deleting/renaming a mid-trail entry can reassign which square an earlier entry marked. This is correct and intended (it always reflects the current trail); it is NOT a bug. Celebrations must fire off *transitions in derived win state*, not off a stored "already celebrated" flag being mutated — track "celebrated wins" in view-local state keyed by win kind, resettable per session. |
| **"segue" event is not trail-derivable** | `TrackedEntry` is song-level and carries **no transition metadata** (no `transitionKind`). A segue square therefore cannot auto-mark from the trail. See Anti-Pattern 2 — dropped from the v1 auto-mark catalog; the abundant reliable events (album membership × 6–10, microtonal, jam, opener, bust-out) already calibrate to ≈15 marks without it. |

---

## 3. Dexie persistence

### Migration (additive `version(5)`, following the established pattern)

`db.ts` versions 1→4 are strictly additive; v5 continues that. A new table needs **no `.upgrade()`** (no pre-existing rows to backfill — the v4 archiveShows precedent).

```typescript
// Version 5 (v1.2 Gizz Bingo): ADDITIVE only — v1–v4 untouched. One new table,
// bingoCards. `&cardId` = stable unique primary key (uuid); `sessionId` indexed
// for the "card for this active session" live lookup. A draft card has
// sessionId=null (mirrors TrackedShow.showId's provisional→bound seam); lock
// stamps sessionId + lockedAt. No .upgrade — a new table has no rows to backfill.
this.version(5).stores({
  bingoCards: "&cardId, sessionId",
});
```

**Key choice — `&cardId` (uuid), `sessionId` indexed (nullable), NOT `&sessionId`:** this is the exact provisional-then-bound idiom `TrackedShow` uses for `showId` (null until `bindShow`). A pre-show **draft** card is a real persisted row with `sessionId: null`; reshuffle overwrites that same `cardId` row; **lock** is a plain `update(cardId, { sessionId, lockedAt })`. Keying by `&sessionId` instead would force a delete-and-re-add to bind a draft (Dexie primary keys are immutable), which is the awkward path — avoid it.

### Write helpers (module-level `db.transaction("rw", …)`, mirroring `startShow`/`logSong`)

```typescript
export async function saveDraftCard(card: BingoCard): Promise<void>;         // upsert the unlocked draft (sessionId null)
export async function reshuffleCard(cardId: string, card: BingoCard): Promise<void>;  // overwrite defs+seed in place
export async function swapSquare(cardId: string, index: number, def: BingoSquareDef): Promise<void>; // tap-to-swap
export async function lockBingoCard(cardId: string, sessionId: string): Promise<void>; // set sessionId + lockedAt=ISO
export async function getDraftCard(): Promise<BingoCard | undefined>;        // sessionId == null
export async function getCardForSession(sessionId: string): Promise<BingoCard | undefined>;
```

### Replay (past shows in GizzDex — pure re-derivation)

A finalized show's card row (`sessionId` set, `lockedAt` set) + that session's `trackedEntries` → `markCard` + `detectWins` → renders the **frozen card + final marks + win state**. Nothing about the outcome is stored; it is recomputed exactly like `deriveRecap` recomputes the night's scorecard. This is why the square defs are *frozen into the row* (see Anti-Pattern 4): a later corpus refresh reshipping `archive.json` must never silently reshuffle a historical card.

### Export / import (flag — cross-boundary work)

`bingoCards` must join the backup envelope so a card survives device loss / friend-file round-trips like every other table. This touches three core files and bumps the envelope version:
- `core/data-safety/export-schema.ts` — add a `bingoCard` zod `strictObject` schema + array field.
- `core/data-safety/serialize.ts` — include cards in `ExportSnapshot`.
- `core/data-safety/merge.ts` — union-merge by `cardId` (stable key → `bulkPut`, like `attendedShows`); add a `MIGRATIONS[2]` entry.
- `packages/app/src/config.ts` `dataSafety.SCHEMA_VERSION` 2 → 3.
- `db.ts` `DbSnapshot` / `snapshot()` / `importSnapshot()` — add the table (stable key → `bulkPut`, not the clear-and-rewrite used for the volatile-keyed `trackedEntries`).

---

## 4. App wiring

### The 4th tab (three small, mechanical edits)

```typescript
// routing/useHashRoute.ts — add "games" to the security allow-list
export const ROUTES = ["show", "explore", "dex", "games", "settings"] as const;

// components/BottomTabBar.tsx — 4th entry (order: LiveGizz · GizzVerse · GizzDex · GizzGames)
import { Dices } from "lucide-react";   // or LayoutGrid / Grid3x3
{ route: "games", label: "GizzGames", Icon: Dices },

// App.tsx — new branch; games SCROLLS, so it stays out of the scroll-off set
route === "games" ? <GizzGamesView /> :
// (leave App.tsx `scroll={route !== "show" && route !== "explore"}` as-is —
//  do NOT add "games"; the card grid + build UX scroll like the dex.)
```

The 4-tab bar already uses `flex-1` per button, so a 4th tab reflows with zero layout work. `useHashRoute`'s SSR/initial default (`"show"`) is unaffected.

### The reactive hook — `useBingoCard()` (mirrors `useShowSession` + `useDexStats`)

The vetted "third derivation, no new sync plumbing" lands here. It subscribes to the **same** `trackedEntries` the Show view does; every `logSong` write-through re-fires it and re-derives the marks.

```typescript
export function useBingoCard() {
  // (a) the active show + its card, reactive (same active-show query as useShowSession)
  const active = useLiveQuery(() => db.trackedShows.where("status").equals("active").first());
  const card = useLiveQuery(
    () => active
      ? db.bingoCards.where("sessionId").equals(active.sessionId).first()
      : db.bingoCards.filter(c => c.sessionId == null).first(),   // the draft pre-show
    [active?.sessionId],
  );
  // (b) the trail — the SAME subscription ShowView uses; the marking driver
  const entries = useLiveQuery(
    () => active ? db.trackedEntries.where("sessionId").equals(active.sessionId).sortBy("position")
                 : Promise.resolve([]),
    [active?.sessionId],
  ) ?? [];
  // (c) guarded, memoized artifacts (matrix + archive + albums) + rarity (module-cached)
  //     — identical loader idiom to useDexStats
  // (d) the derivations — never hand-synced; recomputed only when entries/card change
  const ctx = useMemo(() => buildBingoContext(matrix, archive, albums, rarity), [...]);
  const marked = useMemo(() => card ? markCard(card, entries, ctx, priorSightings) : null, [card, entries, ctx]);
  const wins   = useMemo(() => marked ? detectWins(marked) : [], [marked]);
  return { card, marked, wins, active, /* ready/error sentinel */ };
}
```

### Lock-on-Start-Show semantics

Keep the lock **reactive and app-side** — do NOT couple it into core `startShow()` (that would entangle the show write path with an optional casual feature). Instead, mirror ShowView's existing **auto-bind-from-latest** effect (`if unbound && condition → bind, once`):

```typescript
// inside GizzGamesView (or useBingoCard): when a session goes active and a draft exists, lock once.
useEffect(() => {
  if (!active) return;
  if (card && card.sessionId == null) void lockBingoCard(card.cardId, active.sessionId);
}, [active?.sessionId, card?.cardId, card?.sessionId]);
```

Consequences (all per the vetting): unlocked & reshufflable until Start Show; frozen after. If the user never dealt a card pre-show, there's simply no card that night (bingo is optional). Dealing is a pre-show action; once `active`, the card is read-only and only *marks* update.

### "Catch me up" — reuses the adopt-suggestion flow

Late joiners get **no special mode**. Because marks derive from the trail, "catch me up" is literally "bulk-log the setlist so far," and that already exists: the live `latest` poll + `diffLatestAgainstTrail` (`core/live/suggest.ts`) already computes the un-logged editor songs, and `adoptSuggestion` (`db.ts`) already logs one with honest hit/miss classification. Wire a "Catch me up" button to iterate the diff and call `adoptSuggestion` per row (or add a thin `adoptMany` bulk variant in one rw txn). The bingo card auto-marks as a pure consequence — **no bingo-specific sync code**. Manual mark/search fallback = the same `SearchSheet` path the Show view uses.

---

## 5. Suggested build order (dependency-ordered)

**GATE (must precede the generator's weights being frozen):** Monte-Carlo calibration is the bingo equivalent of the backtest trust gate ("a non-negotiable trust gate before relying on it"). The generator must not ship un-calibrated, or cards under-fill (the vetting's real risk) and a line becomes unlikely.

0. **[PRE-PLAN GATE] `core/cli/bingo-calibrate.ts`** — a Node CLI (native `.ts` execution) that, over the real corpus (`data/normalized/*`), simulates `generateCard` + `markCard` across historical shows per vibe and reports the distribution of expected-fill, first-line rate, and blackout rate. It freezes `config.bingo` mix weights + `bustOutGapShows` so median expected marks ≈ 15, a line is likely, blackout is a rare crown. *Depends on steps 1–3 existing in draft form, then reruns to lock — treat as an iterate-with-3 gate, exactly as backtest iterates with the predictor.*

1. **`core/bingo/types.ts` + `config.bingo` constants + `core/index.ts` exports** — the `BingoCard` JSON contract + event catalog + jam-vehicle list. Everything depends on this. Freeze the JSON shape early (it's the persisted artifact + the export-envelope addition).

2. **`core/bingo/context.ts` + `mark.ts` + `wins.ts`** — the pure derivations, fixture-tested with hand-authored cards + trails with known marks/wins (the `deriveDex`/`deriveRecap` fixture idiom). **Testable without the generator** (feed a hand-built card), so consume-once determinism + all §2 edge cases get locked here first.

3. **`core/bingo/generate.ts` + `expectedFill`** — seeded deterministic deal; test "same seed → identical card." Consumes the calibration constants from step 0.

4. **Rerun step 0 with the real generator → lock final `config.bingo` weights** (closes the gate).

5. **Dexie `version(5)` + `bingoCards` + write helpers + export/import inclusion** — persistence + backup round-trip (envelope bump 2→3).

6. **`packages/app/src/games/useBingoCard.ts`** — the reactive hook (liveQuery + guarded loaders + memo derivations).

7. **Routing wiring** — `ROUTES` + `BottomTabBar` 4th tab + `App.tsx` branch + a `GizzGamesView` shell.

8. **Build UX** — "Deal my card" + vibe pick + reshuffle + tap-to-swap-square + live expected-fill/difficulty meter.

9. **Live-marking view + "Catch me up"** — the during-show surface; reuse `diffLatestAgainstTrail` + `adoptSuggestion`.

10. **Celebrations** — per-square orb "stamp" (reuse the orb renderer), first-line + blackout supernova (reuse the constellation galaxy backdrop), shareable result (reuse the share-card canvas). Reduced-motion aware via the already-threaded `useReducedMotion`. Post-core, like Explore shipped after show-#1.

11. **History replay in GizzDex** — a pure consumer: frozen card + `markCard`/`detectWins` over the finalized session's entries.

Steps 6–11 are app-side and can overlap once the step-1 JSON contract + step-5 table are frozen (the same "freeze the artifact, then UI + model proceed in parallel" pattern the v1.0 architecture used).

---

## Architectural Patterns

### Pattern 1: Third pure derivation over the trail (the load-bearing one)

**What:** Card marking is a pure `f(card, trail, context)` recomputed reactively, a sibling of `deriveTally` and `deriveDex`.
**When:** Always here — it's the vetted design and the app's core invariant.
**Trade-offs:** Recompute-on-every-`logSong` costs microseconds over a 15-entry trail and 16 squares; buys zero sync bugs, free rename/undo, and free replay.

```typescript
// The whole live-marking data path — no useState mirror, no stored marks:
const entries = useLiveQuery(() => db.trackedEntries.where("sessionId").equals(sid).sortBy("position"));
const marked  = useMemo(() => markCard(card, entries, ctx, sightings), [card, entries, ctx]);
```

### Pattern 2: Persist the resolved defs, derive the marks

**What:** The Dexie row stores square *definitions* + seed + lock timestamp; marks/wins are always recomputed.
**When:** Any derived-from-source-of-truth state in this codebase (dex counts, tally, recap).
**Trade-offs:** A tiny redundancy (defs could be regenerated from seed) bought deliberately — it *freezes* a locked card against future artifact/corpus changes (Anti-Pattern 4).

### Pattern 3: Provisional-then-bound row (draft card → session)

**What:** `bingoCards.sessionId` is null while a draft, set on lock — identical to `TrackedShow.showId` (null until `bindShow`).
**When:** Any entity that exists before its canonical binding is known.
**Trade-offs:** Requires keying by a stable local id (`cardId`), not by the eventual binding key.

### Pattern 4: Reuse shipped artifacts, add zero pipelines

**What:** Base rates (`MatrixNode.eraPlayCount`), tuning (`MatrixNode.tuningFamily`), bust-out (`RarityIndex.corpusGap`), album membership (`dex-albums.json`) all come from artifacts already bundled + precached.
**When:** The CLAUDE.md "single pipeline" constraint mandates it.
**Trade-offs:** None — it's strictly less work and less drift than a bingo-specific build artifact.

---

## Anti-Patterns

### Anti-Pattern 1: Storing marks / win state in Dexie
**Why wrong:** Marks drift the instant an entry is renamed/edited/deleted (the dex learned this — see its Anti-Pattern 6). **Instead:** store only defs+seed+lock; derive marks with `markCard` on read.

### Anti-Pattern 2: A "segue" square that auto-marks from the trail
**Why wrong:** `TrackedEntry` is song-level and carries no transition metadata, so nothing can pure-derive a segue from the trail. **Instead:** drop segue from the v1 auto-mark catalog (the reliable event set already calibrates to ≈15 marks). If segue is later wanted, the honest options are (a) enrich `TrackedEntry` with a captured `transitionKind` (schema + capture-at-log work), or (b) mark it opportunistically from the live `latest` feed — both are explicit future scope, not a silent assumption.

### Anti-Pattern 3: `Math.random()` / `Date.now()` inside `generateCard`
**Why wrong:** Breaks determinism/replay and violates core purity (the `rarity.ts`/`recap.ts` modules explicitly avoid `Date.now`). **Instead:** the app generates the seed (owns randomness/clock) and passes it in; core is a pure function of `(seed, vibe, ctx)` — mirrors `deriveTopOpeners` taking its recency anchor as a param.

### Anti-Pattern 4: Regenerating square defs from seed at read time
**Why wrong:** A corpus refresh reshipping `archive.json`/`transition-matrix.json` would silently reshuffle a *locked historical* card. **Instead:** freeze the resolved `squares` into the persisted row (frozen-artifact-as-contract).

### Anti-Pattern 5: Marking every square a song qualifies for
**Why wrong:** 1 song = 3 marks → instant false blackout, defeating the whole card. **Instead:** consume-once greedy with a deterministic specificity tiebreak (§2).

### Anti-Pattern 6: Coupling the bingo lock into core `startShow()`
**Why wrong:** Entangles the show write path with an optional casual feature. **Instead:** a reactive, idempotent app-side lock effect (mirrors ShowView's auto-bind-from-latest).

---

## Scaling Considerations

Not a scaling project (<10 users, static hosting). Relevant axes are all trivial:

| Axis | Reality | Adjustment |
|------|---------|------------|
| Marking cost | 16 squares × ≤32 trail entries, recomputed per `logSong` | Microseconds; no memo beyond the existing `useMemo` needed |
| Card storage | One ~2 KB JSON row per show | Negligible; joins the existing backup blob |
| Calibration | Node CLI over ~240 recent shows | Build-time only, never in the browser |

---

## Integration Points

### Internal Boundaries

| Boundary | Communication | Enforcement |
|----------|---------------|-------------|
| `core/bingo` ↔ app | app imports the bingo public API from `core/index.ts`; never reverse | core's DOM-free tsconfig + `erasableSyntaxOnly` (union types, no enums) |
| bingo derivation ↔ artifacts | reads `TransitionMatrix` / `ArchiveArtifact` / `DexAlbumsArtifact` / `RarityIndex` only | versioned `schemaVersion` guards already enforced by the app loaders |
| `useBingoCard` ↔ Dexie | `useLiveQuery` reads + module-level rw-txn write helpers | same single-source-of-truth discipline as `useShowSession`/`useDexStats` |
| bingo marks ↔ trail | one-directional derive from `trackedEntries`; bingo NEVER writes the trail (except via the shared `adoptSuggestion` for "catch me up") | marks are a pure function, not stored state |

### Files touched (concrete)

**NEW:** `core/bingo/{types,context,generate,mark,wins}.ts`, `core/cli/bingo-calibrate.ts`, `packages/app/src/games/{GizzGamesView.tsx,useBingoCard.ts,BingoGrid.tsx,DealControls.tsx,…}`
**MODIFIED:** `core/index.ts`, `core/config.ts`, `packages/app/src/config.ts`, `packages/app/src/db/db.ts`, `packages/app/src/routing/useHashRoute.ts`, `packages/app/src/components/BottomTabBar.tsx`, `packages/app/src/App.tsx`, `core/data-safety/{export-schema,serialize,merge}.ts` (export-envelope inclusion — flag)

---

## Open Items for Phase-Level Research

1. **The `free` cell on an even 4×4.** A 4×4 has no true center; `freeIndex` must pick one of the four middle cells (5/6/9/10). This affects which win patterns get a free boost (the two diagonals pass through {0,5,10,15} and {3,6,9,12} — a free cell on a diagonal changes X/line difficulty). Decide `freeIndex` in the calibration step and hold it constant. MEDIUM.
2. **`specificityRank` exact ordering + the calibrated mix weights** are the calibration script's output — [ASSUMED] until step 0/4 run. The vetting's numbers were ad-hoc scripts; rerun before locking (its own "Reproducing the numbers" note says so).
3. **`jamVehicleSongIds`** must be promoted from the vetting's throwaway name-substring script to a curated, committed `config.bingo` id list (name-substring matching is fragile; resolve to song ids at authoring time).
4. **"neverCaught" personalization + replay.** The predicate reads the user's *prior* sightings; for live marking that's "sightings before this show" (use the `deriveRecap` reduced-snapshot trick — derive dex excluding the active session). Confirm the exact prior-set semantics so a replayed historical card reproduces the same marks. MEDIUM.
5. **Celebrations & non-sticky marks.** Since an edit can reassign an earlier mark, first-line/blackout celebrations must fire on derived-win-state *transitions* tracked in view-local state (reset per session), not on any stored "celebrated" flag. Confirm the trigger design in the celebrations plan.

## Sources

- Shipped source (HIGH, empirical — read 2026-07-19): `packages/core/src/dex/{derive-dex,rarity,recap,archive-types}.ts`, `packages/core/src/{index,config}.ts`, `packages/core/src/domain/types.ts`, `packages/core/src/ingest/tuning-tags.ts`, `packages/app/src/db/db.ts`, `packages/app/src/show/{useShowSession,ShowView,scoring,matrix}.ts`, `packages/app/src/dex/{useDexStats,archive-loader}.ts`, `packages/app/src/{App,config}.tsx/ts`, `packages/app/src/routing/useHashRoute.ts`, `packages/app/src/components/BottomTabBar.tsx`
- `.planning/notes/gizz-bingo-design-vetting.md` (HIGH — the vetted design + empirical corpus findings)
- `.planning/research/ARCHITECTURE.md` (v1.0 — core/app boundary, artifact-as-contract, derive-never-store patterns)

---
*Architecture research for: Guezzer v1.2 — Gizz Bingo live auto-marking*
*Researched: 2026-07-19*

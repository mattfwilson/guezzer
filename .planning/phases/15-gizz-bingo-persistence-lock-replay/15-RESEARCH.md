# Phase 15: Gizz Bingo — Persistence, Lock & Replay - Research

**Researched:** 2026-07-20
**Domain:** Client-side persistence (Dexie/IndexedDB additive migration), versioned JSON backup round-trip, pure re-derivation over a persisted trail (bingo replay/catch-up)
**Confidence:** HIGH (all findings are grounded in the actual shipped code this phase touches; zero new dependencies)

## Summary

This is a **code-archaeology phase, not a research phase.** Every mechanism Phase 15 needs already exists in the codebase and was verified by reading the real files: the Dexie additive-versioning idiom (`db.ts` v1→v4), the versioned export envelope + `MIGRATIONS` chain (`export-schema.ts` + `merge.ts`), the pure bingo fold (`packages/core/src/bingo/`), and the reuse targets (`adoptSuggestion`, `RecapView`, `BottomTabBar`, `useHashRoute`). The job is to extend these patterns exactly, adding a `bingoCards` table + `version(5)`, bumping the envelope to `SCHEMA_VERSION = 3`, and wiring a replay/catch-up UI that re-runs the already-shipped `deriveMarks`/`detectWins` over the persisted trail. **No new libraries, no new build-time artifact, no core-fold changes.**

Two findings dominate the plan and are easy to get wrong. **(1) The `caughtSnapshot` (never-caught set) MUST be frozen into the row at lock** — D-08/D-12 call for it, but the D-11 field list in CONTEXT.md does not name it explicitly; without it, a `neverCaught` square re-derives against the *current* dex on replay and drifts. **(2) The app→core trail adapter must re-index to 0-based contiguous play order**, because `mark.ts` hard-codes `opener = position === 0` while the app's `TrackedEntry.position` is 1-based and gapped. Miss either and replay silently diverges from live — breaking the phase's core `live == replay == catch-up` property.

**Primary recommendation:** Model `version(5)` on the `version(4)` precedent (a single new table, `bingoCards: "&cardId, sessionId"`, **no `.upgrade` block** — a new table has no rows to backfill). Store a row that embeds a complete `BingoCard` (so replay reconstructs it verbatim) plus `cardId`, `caughtSnapshot`, `lockedAt`, and denormalized show identity. Derive `cardId` from the show's `sessionId` (not the seed) so pre-lock reshuffles update in place. Bump the envelope to v3 with a `.default([])` `bingoCards` field and a `MIGRATIONS[2]` entry so pre-v3 backups still import.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Gizz Bingo lives in a **new 4th bottom tab, "GizzGames"** (alongside LiveGizz / GizzVerse / GizzDex). Accept the 3→4 tab tap-target tightening.
- **D-02:** The Phase-15 GizzGames surface is **replay/history only** — lists past shows that have a bingo card (replayable) and shows an honest **"Deal a card — coming soon" teaser**. Empty at first; must not read as broken.
- **D-03:** "Catch me up" presents a **pre-checked confirm-list** of songs the tracker missed (from the live `latest` feed); user unticks wrong rows, taps **Add N**. Each added row commits via the shipped **`adoptSuggestion`** path. Not a silent auto-adopt.
- **D-04:** Manual marking = **search the song → log it to the trail** (reuse existing fuse.js search). Marks are derived: logging runs `deriveMarks`. **No direct "tap a square to mark it."**
- **D-05:** Replay surfaces as a **"Bingo" section inside the existing `RecapView`**. Re-derives from the persisted trail RecapView already reads. Section is **absent** for shows with no card.
- **D-06:** Replay shows **full detail** — 4×4 board with marked squares, win badges (line / four-corners / X / blackout), **and** per-square "which song lit this". Read-only.
- **D-07:** Bingo is **opt-in, one card max per show.** A tracked show has **zero or one** `bingoCards` row.
- **D-08:** A dealt-but-unlocked card is **persisted immediately as an unlocked draft** (`lockedAt` null). **Start Show flips it to locked** — stamps `lockedAt` and freezes the RESOLVED square defs into the row (incl. the D-12 never-caught snapshot).
- **D-09:** A card dealt **after** a show started **locks immediately on deal** (freeze defs now); "Catch me up" then back-fills the trail. Lock is not strictly bound to Start-Show.
- **D-10:** **Reshuffle is rejected on a locked / non-active session** (roadmap SC-1). Core hard-rejects reshuffle when the session is not active. At the Phase-16 build surface, the reshuffle control is shown **greyed with a "Locked at Start Show" explainer**.
- **D-11:** The `bingoCards` row persists: **stable `cardId`, `sessionId` link, `seed`, `vibe`, frozen `resolvedDefs`, `lockedAt` (nullable), and denormalized `showDate` + `venueName` + `city`.** **Marks are NOT stored** (D-23) — re-derived on every read.
- **D-12:** `cardId` MUST be a **stable, device-independent, merge-safe key** (NOT the volatile Dexie `++id`). Mirrors the existing `archiveShows` `show_id` / `trackedShows` `sessionId` merge discipline. Exact derivation is Claude's discretion.
- **D-13:** Bingo cards are **always included in the JSON backup export**. On import they merge via **`bulkPut` by `cardId` — the imported card wins on collision**.
- **D-14:** Dexie `version(5)` is **ADDITIVE** — v1–v4 tables untouched, no destructive rewrite. A populated v4 DB upgrades in place. Envelope `SCHEMA_VERSION` bumps and a `MIGRATIONS` entry is added (roadmap SC-4).

### Claude's Discretion

- The concrete `cardId` derivation/hash (subject to D-12's stable-merge-safe requirement).
- The exact zod schema shape for the `bingoCards` row and the export envelope migration wiring.
- Precise `MIGRATIONS` entry / envelope-version bump mechanics.
- The GizzGames tab icon and the exact copy/layout of the empty-state teaser (D-02) and the RecapView bingo section (D-05/D-06).
- Whether the catch-up confirm-list and manual-search surfaces live on the live Show surface, the active-card view, or a shared component — subject to reusing `adoptSuggestion` (D-03) and the fuse.js search (D-04).

### Deferred Ideas (OUT OF SCOPE)

- **Deal / vibe / swap build UX, live auto-marking, "one away" tension, celebrations, share-card image** — all Phase 16 (BINGO-01/02/04/05/08).
- **Future games sharing the GizzGames tab** — Gizzle, Guezz League, Couch Mode, Residency Mode, badges, My Stats/Want List.
- **Shared-seed leaderboard / cross-friend comparable cards** — GAME-V1.3-01; post-v1.
- **Segue square, pre-2020 replay cards (cover/encore/Set-2)** — excluded per Phase-14 D-24.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BINGO-06 | User can "Catch me up" on a late-joined show (bulk-mark from live `latest`) and manually mark/search squares the tracker missed | `adoptSuggestion` (db.ts:414) is the per-row commit path (D-03); fuse.js catalog search + `logSong` (miss) is the manual path (D-04). Both grow the trail; `deriveMarks` re-lights squares. See §Architecture Pattern 3. |
| BINGO-07 | User can view any past show's frozen card with final marks and win state from GizzDex history | Reconstruct `BingoCard` from the frozen row, adapt `trackedEntries`→`MarkTrailEntry[]` (0-based reindex), run `deriveMarks` + `detectWins`. Attaches to `RecapView` (D-05/D-06). See §Architecture Pattern 4. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Marking fold / win geometry | Core (`packages/core/src/bingo/`) | — | Pure, shipped Phase 14. Phase 15 does NOT touch it (D-22). |
| Card schema / freeze / lock state | App persistence (`db.ts`) | — | Dexie table + write helpers. Core mints no ids, holds no DB state. |
| Export envelope schema + row validation | Core (`export-schema.ts`) | — | Zod row schema re-declared core-side (app-free), inferred type stays assignable to the app `Table<>`. |
| Migration chain (v2→v3 envelope) | Core (`merge.ts` `MIGRATIONS`) | — | Pure forward-migration, Node-testable. |
| Import merge (union by `cardId`) | Core (`merge.ts`) | App (`importSnapshot` commit) | Merge is pure/in-memory; commit is one Dexie transaction. |
| BingoContext assembly for replay | App (artifact loaders) → Core (`buildBingoContext`) | — | App loads the bundled matrix/archive/rarity/albums; core resolves them to lookups. |
| Trail adapter (`TrackedEntry` → `MarkTrailEntry`) | App | — | The app owns row shape; core defines the minimal contract (D-22). **0-based reindex lives here.** |
| Replay UI / catch-up UI / GizzGames tab | App UI (React) | — | RecapView section, tab bar, hash route, catch-up surface. |

## Standard Stack

**Zero new dependencies (hard constraint — confirmed).** Everything below is already installed and in use.

### Core (reused as-is)
| Library / Module | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Dexie | 4.4.4 | `version(5)` additive migration + `bingoCards` table | The established persistence layer; v1–v4 precedent in `db.ts`. [VERIFIED: db.ts] |
| dexie-react-hooks (`useLiveQuery`) | 4.4.0 | Reactive reads for the replay list + RecapView section | RecapView already reads `db.*.toArray()` via `useLiveQuery`. [VERIFIED: RecapView.tsx:57-60] |
| zod | 4.4.3 | `bingoCardRow` strict schema at the import trust boundary | Every export row is a `z.strictObject`; bingo card def already has a `z.discriminatedUnion` (`types.ts`). [VERIFIED: export-schema.ts, types.ts] |
| `@guezzer/core` bingo barrel | Phase 14 | `deriveMarks`, `detectWins`, `expectedFill`, `buildBingoContext`, `deal`, `BingoCard`/`BingoSquareDef`/`BingoVibe` types | Shipped and barrel-exported. [VERIFIED: index.ts:329-342] |
| lucide-react | (installed) | GizzGames tab icon | BottomTabBar already imports `Music`/`Compass`/`BookOpen`. Pick a 4th (e.g. `Gamepad2`, `Dices`, `Grid3x3`). [VERIFIED: BottomTabBar.tsx:1] |

### Alternatives Considered
None. The zero-new-dependency constraint is explicit in CONTEXT.md and CLAUDE.md; no alternative is in scope.

## Package Legitimacy Audit

**Not applicable — this phase installs zero external packages.** All code reuses already-installed, already-audited dependencies (Dexie, zod, dexie-react-hooks, lucide-react, `@guezzer/core`). No `npm install` occurs. The slopcheck / registry-verification gate is skipped because there is nothing new to verify.

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────────┐
   Bundled static         │  @matrix  archive.json  rarity  dex-albums   │
   artifacts (offline) ──▶│         (already shipped, versioned)         │
                          └───────────────────┬─────────────────────────┘
                                              │ loadMatrix()/loadArchive()/…
                                              ▼
                                   buildBingoContext(...)  ──┐  (core, pure)
                                                             │
  ┌──────────────┐   deal (Phase 16 UI)   ┌─────────────────▼───────────────┐
  │  Start Show  │──────lock──────────────▶│      bingoCards  (Dexie v5)     │
  │   action     │   stamp lockedAt +      │  cardId, sessionId, seed, vibe, │
  └──────────────┘   freeze caughtSnapshot │  corpusVersion, freeIndex,      │
                                           │  resolvedDefs[16], caughtSnapshot,│
                                           │  lockedAt?, showDate/venue/city │
                                           └───────────┬─────────────────────┘
                                                       │ read (useLiveQuery)
   trackedEntries (the trail) ──┐                      │
        │  adapt: sort by pos,  │                      ▼
        │  reindex 0-based ─────▶│  MarkTrailEntry[]  ─▶ deriveMarks(card, trail,
        │                        │                        ctx, caughtSnapshot)
   catch-up (D-03/D-04)          │                             │
   adoptSuggestion / logSong ────┘                             ▼
        (appends to trail)                              detectWins(marked)
                                                               │
                                                               ▼
                              ┌──────────────────────────────────────────────┐
                              │ RecapView "Bingo" section (D-05/D-06):        │
                              │  4×4 board · win badges · which-song-lit-each │
                              └──────────────────────────────────────────────┘

   Export/import round-trip:
   snapshot() ─▶ serializeExport(…, SCHEMA_VERSION=3) ─▶ envelope{ …, bingoCards }
   file ─▶ exportEnvelope.parse (bingoCards default []) ─▶ MIGRATIONS[2] ─▶
        parseAndMergeImport (union by cardId, imported wins) ─▶ importSnapshot (bulkPut)
```

### Recommended Structure (files this phase adds/edits)
```
packages/app/src/
├── db/db.ts                      # + BingoCardRow iface, version(5), write helpers, snapshot/importSnapshot/DbSnapshot
├── games/                        # NEW — GizzGames tab home (Claude's discretion on exact folder name)
│   ├── GamesView.tsx             #   replay list + "Deal — coming soon" teaser (D-02)
│   └── bingoReplay.ts            #   app→core adapter: row + trail → MarkedCard/Win[]
├── dex/RecapView.tsx             # + Bingo section (D-05/D-06), absent when no card
├── show/ShowView.tsx             # catch-up surface OR shared component (D-03/D-04) — discretion
├── components/BottomTabBar.tsx   # + 4th tab
├── routing/useHashRoute.ts       # + "games" route
└── config.ts                     # + SCHEMA_VERSION 2→3, + copy.games.*, + bingo replay/copy constants
packages/core/src/
├── data-safety/export-schema.ts  # + bingoCardRow, + bingoCards on exportEnvelope (default [])
├── data-safety/serialize.ts      # + bingoCards on ExportSnapshot + serializeExport passthrough
└── data-safety/merge.ts          # + MIGRATIONS[2], + bingoCards union merge (imported wins)
```

### Pattern 1: Additive `version(5)` + `bingoCards` table (D-14)

**What:** Exactly mirror the `version(4)` precedent, which added `archiveShows` as a single new table with **no `.upgrade` block** (a brand-new table has no pre-existing rows to backfill).

**Verified precedent** (`db.ts:233-235`):
```ts
// Version 4 (Phase 6 Pokédex): ADDITIVE only … Adds a SINGLE new table …
// No `.upgrade` is needed: a new table has no pre-existing rows to backfill.
this.version(4).stores({
  archiveShows: "&show_id",
});
```

**Do this** (append after v4, do NOT touch v1–v4):
```ts
// Version 5 (Phase 15 Gizz Bingo): ADDITIVE only — v1–v4 untouched, no data loss.
// Single new table. `&cardId` = unique stable inbound PK (never the volatile ++id, D-12);
// `sessionId` indexed for the RecapView/replay-list lookup by show. No `.upgrade`.
this.version(5).stores({
  bingoCards: "&cardId, sessionId",
});
```

The class needs `bingoCards!: Table<BingoCardRow, string>;` (keyed by the string `cardId`, like `trackedShows` is keyed by `sessionId`).

### Pattern 2: The `bingoCards` row shape (D-11 + the D-08/D-12 freeze)

**What:** The row **embeds a complete `BingoCard`** (so replay reconstructs it verbatim with no lossy re-mapping) plus persistence + freeze + denormalized-identity fields.

**Recommended interface** (app-side, `db.ts`):
```ts
export interface BingoCardRow {
  /** D-12 stable, device-independent, merge-safe PK (NOT ++id). See Pattern 6. */
  cardId: string;
  /** FK → TrackedShow.sessionId (indexed) — the show this card belongs to. */
  sessionId: string;

  // ── The embedded BingoCard (frozen resolvedDefs, D-08) ──
  bingoSchemaVersion: 1;          // mirrors BingoCard.schemaVersion (renamed to avoid clash w/ envelope)
  seed: string;                   // D-21 string seed (changes on reshuffle while draft)
  vibe: BingoVibe;                // "chill" | "balanced" | "glory"
  corpusVersion: string;          // scopes BingoContext reconstruction on replay
  freeIndex: number;              // 0..15
  resolvedDefs: BingoSquareDef[]; // == BingoCard.squares, length 16 (the frozen defs)

  // ── The D-08/D-12 freeze snapshot (see §Pitfall 1) ──
  caughtSnapshot: number[];       // caught songIds at lock; drives neverCaught predicate drift-free

  // ── Lock state ──
  lockedAt: number | null;        // null = unlocked draft (D-08); Date.now() at lock

  // ── Denormalized show identity (D-11) ──
  showDate: string;               // ISO YYYY-MM-DD
  venueName: string | null;
  city: string | null;
}
```

**Reconstructing the `BingoCard`** for `deriveMarks` is then trivial:
```ts
const card: BingoCard = {
  schemaVersion: 1, seed: row.seed, vibe: row.vibe,
  corpusVersion: row.corpusVersion, freeIndex: row.freeIndex, squares: row.resolvedDefs,
};
```

> **Note the field-name clash:** the envelope has a top-level `schemaVersion` (envelope version) and `BingoCard` also has `schemaVersion: 1`. Inside the row, name the card's version distinctly (e.g. `bingoSchemaVersion`) OR nest the whole card under a `card:` key (`{ card: BingoCard, cardId, sessionId, caughtSnapshot, lockedAt, showDate, venueName, city }`). **Nesting under `card:` is cleaner** — it lets you reuse `bingoCardSchema` verbatim in the row zod schema (see Pattern 5). Claude's discretion; the nested form is recommended.

### Pattern 3: Catch-up via `adoptSuggestion` + search-log (BINGO-06, D-03/D-04)

**What:** Catch-up never touches squares directly — it grows the trail, and `deriveMarks` re-lights squares as a pure consequence.

- **Bulk from `latest` (D-03):** build a pre-checked confirm-list of `latest` rows the tracker missed; on **Add N**, call `adoptSuggestion(sessionId, { songId, songName, shownFanSongIds })` per checked row. This is the *exact* shipped path (`db.ts:414`, `ShowView.handleAdopt:362`). It stamps `source:"editor"`, classifies hit/miss via `classifyOutcome`, and appends at `maxPosition + 1`.
- **Manual (D-04):** reuse the fuse.js catalog search → `logSong(sessionId, {…, outcome:"miss", isPlaceholder:false})`, identical to `ShowView.handleSearchSelect` (`ShowView.tsx:337`).

**Honest-denominator decision (flag for planner):** `adoptSuggestion` classifies hit/miss against `shownFanSongIds`. A bulk catch-up backfill was never predicted by an on-screen fan, so its honest `shownFanSongIds` is `[]` → every catch-up add classifies as a **miss** (consistent with `handleSearchSelect`, which logs a miss with the current fan). Confirm this is the intended denominator behavior; it keeps the hit/miss tally honest (you didn't call these).

### Pattern 4: Replay as pure re-derivation (BINGO-07, D-05/D-06)

**What:** `RecapView` already re-derives everything from `trackedEntries` + the bundled loaders (`loadArchive`, `loadDexAlbums`, `getRarityIndex`). The bingo section adds one more input — `loadMatrix` (needed by `buildBingoContext`) — and the frozen row.

**Verified inputs already present in RecapView** (`RecapView.tsx:24-26, 57-65`): `loadArchive()`, `loadDexAlbums()`, `getRarityIndex()`, `db.trackedEntries`. **Add:** `loadMatrix()` (`show/matrix.ts` — guarded, memoized) and `db.bingoCards.where("sessionId").equals(sessionId).first()`.

**Derivation** (app adapter, pure over inputs):
```ts
// 1. no row for this session → render nothing (D-05: section absent)
// 2. rebuild the context from the SAME versioned bundle the card was dealt against
const ctx = buildBingoContext(matrix, archive, rarity, albums);
// 3. adapt the trail — CRITICAL 0-based reindex (see §Pitfall 2)
const trail: MarkTrailEntry[] = [...entries]
  .sort((a, b) => a.position - b.position)
  .map((e, i) => ({ songId: e.songId, position: i, isPlaceholder: e.isPlaceholder }));
// 4. reconstruct the card + use the FROZEN caughtSnapshot (never the live dex)
const marked = deriveMarks(card, trail, ctx, new Set(row.caughtSnapshot));
const wins = detectWins(marked);
```

**Render (D-06):** `marked.squares` gives each cell its `def` + `markedByPosition`. Map `markedByPosition` (a 0-based play-order index) back to the trail entry to show "which song lit this" (the `FREE_SENTINEL = -1` cell is the pre-marked free center). `wins` gives the badge set. Read-only.

### Pattern 5: Envelope v3 bump + `MIGRATIONS[2]` (D-13/D-14, roadmap SC-4)

**Current state (verified):** `config.dataSafety.SCHEMA_VERSION = 2` (`app/config.ts:294`); `MIGRATIONS[1]` is the only entry (`merge.ts:52`); the envelope has 8 keys (`export-schema.ts:122`). `owner` and `archiveShows` use `.default(...)` so older backups still parse.

**Do this (five coordinated edits):**
1. **`export-schema.ts`** — add a `bingoCardRow` `z.strictObject` (reuse `bingoCardSchema` from `bingo/types.ts` for the nested card, or re-declare the discriminated union app-free per the `SetNumber` re-declaration idiom). Add to the envelope with a default so pre-v3 files parse:
   ```ts
   bingoCards: z.array(bingoCardRow).default([]),
   ```
2. **`app/config.ts`** — `SCHEMA_VERSION: 2` → `3`.
3. **`merge.ts`** — register `MIGRATIONS[2]` (defensive normalization; `.default([])` already fills it at parse, but the loop *errors* if `MIGRATIONS[v]` is missing for a step it must take — verified `merge.ts:107-116`):
   ```ts
   MIGRATIONS[2] = (e) => ({ ...e, bingoCards: e.bingoCards ?? [] });
   ```
4. **`merge.ts`** — add a `bingoCards` union merge. **This is the D-13 exception:** unlike `meta`/`attendedShows`/`archiveShows`/`trackedShows` (which set incoming *then* local → **local wins**), D-13 wants **imported wins on collision**, so set **local first, then incoming**:
   ```ts
   const cardsById = new Map<string, ExportSnapshot["bingoCards"][number]>();
   for (const row of local.bingoCards) cardsById.set(row.cardId, row);
   for (const row of incoming.bingoCards) cardsById.set(row.cardId, row); // imported wins (D-13)
   const mergedBingoCards = [...cardsById.values()];
   ```
5. **`serialize.ts`** (`ExportSnapshot` + `serializeExport` passthrough) and **`db.ts`** (`DbSnapshot`, `snapshot()`, `importSnapshot()`) — thread `bingoCards` through. In `importSnapshot`, commit like `archiveShows`: a stable-key `bulkPut` (NOT the clear-and-rewrite path used for `trackedShows`/`trackedEntries`).

> **⚠ CONTEXT.md ambiguity (flag for planner/discuss):** D-13 says "imported card wins on collision, **consistent with how `archiveShows` / `trackedShows` already merge**." But the shipped code merges those **local-wins** (`merge.ts:129-145`). The two halves of D-13 contradict each other. Because a **locked** card's `resolvedDefs` are immutable, a same-`cardId` collision only differs meaningfully in **lock state** (draft vs locked). Safest resolution: **prefer the locked row** (or fall back to "imported wins" as D-13's explicit first clause states). See Open Question 1.

### Pattern 6: `cardId` derivation (D-12) — derive from `sessionId`, not the seed

**What:** `cardId` must be stable, device-independent, and merge-safe (D-12), and it must survive **pre-lock reshuffles** (Phase 16 changes the seed repeatedly before Start Show). If `cardId` includes the seed, every reshuffle mints a new `cardId` and orphans the old draft row.

**Recommendation:** Because there is **exactly one card per show** (D-07) and the show's `sessionId` is already the canonical stable/merge-safe key (it survives export/import unchanged and drives same-show dedupe), derive `cardId` **from `sessionId` alone** — either:
- `cardId = sessionId` (simplest; inherently merge-consistent with `trackedShows`), or
- `cardId = hash(sessionId)` for an opaque compact key (a stable string hash — `xmur3` already exists in `packages/core/src/bingo/prng.ts` if you want to reuse it; do NOT add a hashing dependency).

Both keep reshuffles as in-place updates (the seed lives *in* the row and changes freely). D-12's floated "hash of seed+session" also satisfies stability but requires **deleting the old draft on each reshuffle** — avoid unless there's a reason to. **Recommend `cardId = sessionId`** (or its hash); note this in the plan so Phase 16's reshuffle just overwrites the row.

### Anti-Patterns to Avoid
- **Storing marks in the row.** Marks are DERIVED (D-23). Store only card def + resolvedDefs + seed + vibe + caughtSnapshot + lock ts + identity.
- **Re-deriving `caughtSnapshot` on replay.** It MUST be the frozen set (§Pitfall 1).
- **Passing 1-based `TrackedEntry.position` into `deriveMarks`.** Opener never fires (§Pitfall 2).
- **A destructive `version(5)` rewrite.** Additive only (D-14); a new table needs no `.upgrade`.
- **`.innerHTML` for square labels.** `resolvedDefs[].label` is kglw-derived — render as escaped React text only (§Security).
- **A second data pipeline.** Reuse `buildBingoContext` over the already-shipped bundled artifacts; no new build-time artifact (CONTEXT.md).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Card marking / win detection | A replay-specific marker | `deriveMarks` + `detectWins` (core) | Shipped, property-tested; guarantees `live == replay == catch-up`. |
| Trail catch-up commit | A bespoke bulk-adopt writer | `adoptSuggestion` per row (db.ts:414) | Keeps `source`/position/hit-miss discipline identical to live (D-03). |
| Import validation | Hand-checked JSON | `exportEnvelope` + `bingoCardRow` zod (strictObject) | Prototype-pollution + drift defense at the trust boundary (existing idiom). |
| Version migration | Ad-hoc if/else on version | `MIGRATIONS[]` forward chain (merge.ts) | The registered-chain pattern already errors loudly on unhandled versions. |
| Reactive replay-list reads | Manual IndexedDB reads + state sync | `useLiveQuery` (RecapView idiom) | Auto-updates the list/section when a card locks or a song logs. |
| BingoContext lookups | Re-scanning artifacts | `buildBingoContext` (core) | Resolves matrix/archive/rarity/albums to O(1) Maps in one pass. |

**Key insight:** Phase 15 writes almost no new *logic* — it writes *plumbing* (a table, a schema field, a migration entry, an adapter, three UI surfaces) around logic that already shipped and is tested. The risk is in the seams (freeze completeness, position reindex, merge-collision direction), not in any algorithm.

## Runtime State Inventory

> This is a schema-migration phase. The migration is **purely additive** (a new table), so the classic "old string cached in a running service" risks are minimal — but the export/backup surface and stored-data compatibility must be checked.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | IndexedDB `guezzer` DB at `version(4)` on every existing install (owner + <10 friends). Adding `version(5)` upgrades it in place on next load. No existing `bingoCards` rows exist anywhere yet (table is brand new). | Additive `version(5)`; **no `.upgrade`** (verified: v4 needed none). Populated v4 DBs upgrade losslessly. Must be covered by a migration test (§Validation). |
| Live service config | None — no backend, no external service holds bingo state. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None — no keys reference bingo. | None. |
| Build artifacts | The bundled `@matrix` / archive / rarity / dex-albums artifacts are consumed read-only to rebuild `BingoContext`. `corpusVersion` on the row scopes which corpus a card was dealt against. A future corpus rebuild changes `corpusGap`/`bustOut` resolution — a drift vector for `bustOut` squares on replay (see Open Question 2). | Store `corpusVersion` in the row (done in Pattern 2). Flag corpus-refresh drift as a known limitation. |
| Backup file compatibility | Existing user backups are **envelope v2** (no `bingoCards` key). After the v3 bump they must still import. | `bingoCards: z.array(...).default([])` + `MIGRATIONS[2]` (verified pattern from the v1→v2 precedent). Covered by a round-trip test. |

**The canonical question — "after every file is updated, what runtime systems still have old state?":** Only two, both handled: (1) existing v4 IndexedDB databases (→ additive `version(5)`, no data touched); (2) existing v2 backup files on users' devices (→ `.default([])` + `MIGRATIONS[2]`). Nothing else persists bingo state.

## Common Pitfalls

### Pitfall 1: Not freezing the never-caught `caughtSnapshot` into the row
**What goes wrong:** The `neverCaught` event square's predicate is `!caughtSnapshot.has(songId)` (`mark.ts:94`). If replay rebuilds the caught set from the *current* dex instead of a frozen snapshot, a song caught in a *later* show retroactively un-marks a historical `neverCaught` square — the replayed card silently differs from what the user saw live.
**Why it happens:** CONTEXT.md's D-11 field list names `resolvedDefs` but does **not** explicitly list `caughtSnapshot`; D-08/D-12 do ("freezes the RESOLVED square defs … incl. the D-12 never-caught snapshot"). Easy to miss when reading D-11 alone.
**How to avoid:** Add `caughtSnapshot: number[]` to the row; populate it at **lock** (Start Show, or immediately on late-deal per D-09) from the user's caught-songId set (derivable from the dex — `deriveDex`/`derive-dex.ts` produces per-song caught state; exact caught-set extraction is Claude's discretion). Replay passes `new Set(row.caughtSnapshot)` to `deriveMarks`, never the live dex.
**Warning signs:** A `neverCaught` square that lights during live but is dark on replay (or vice versa) after attending a later show.

### Pitfall 2: 1-based / gapped `TrackedEntry.position` breaks the opener predicate
**What goes wrong:** `mark.ts` resolves `opener` as `position === 0` (`mark.ts:84`, D-22). But `TrackedEntry.position` starts at **1** and is **gapped** after deletes (`db.ts:334` — `maxPosition + 1`, deletes leave holes by design). Pass those positions straight into `deriveMarks` and the opener square **never marks**, and any position-sensitive logic diverges.
**Why it happens:** The core `MarkTrailEntry.position` is a **0-based contiguous play-order index**, a different contract from the app's storage position. The types are structurally compatible (both `number`), so TypeScript won't catch the mismatch.
**How to avoid:** In the app→core adapter, sort entries by stored `position` ascending, then assign fresh contiguous indices `0..N-1`:
```ts
[...entries].sort((a, b) => a.position - b.position)
            .map((e, i) => ({ songId: e.songId, position: i, isPlaceholder: e.isPlaceholder }));
```
Do this once, in a single shared adapter used by replay, catch-up preview, and (Phase 16) live marking — so all three feed `deriveMarks` identically and `live == replay == catch-up` actually holds.
**Warning signs:** The opener square is dark on a card whose show clearly opened with a matching song; a placeholder as the first entry.

### Pitfall 3: Merge-collision direction wrong (or contradictory with CONTEXT)
**What goes wrong:** If `bingoCards` merges "local wins" (copy-paste from the `archiveShows` block) but D-13 wants "imported wins," re-importing a corrected/locked card from another device silently keeps the stale local draft.
**Why it happens:** All four existing table merges in `merge.ts` are local-wins; D-13 both says "imported wins" *and* claims consistency with those local-wins merges (a genuine contradiction in the source doc).
**How to avoid:** Decide explicitly (Open Question 1). Recommended: prefer the **locked** row on collision (lock state is the only meaningful difference for an immutable card), or follow D-13's literal "imported wins" (set incoming last). Add a round-trip test asserting the chosen behavior.
**Warning signs:** A locked card reverting to a draft after import, or an import not reflecting a card locked on another device.

### Pitfall 4: Freezing at deal instead of at lock (or double-freezing)
**What goes wrong:** If `caughtSnapshot`/`lockedAt` are stamped at deal time, a draft that sits through several songs before Start Show captures a stale/incorrect never-caught baseline; if the late-deal path (D-09) forgets to lock immediately, the card stays an unlocked draft during a show it should be locked for.
**How to avoid:** Two write helpers — `saveDraftCard(...)` (writes row, `lockedAt: null`, `caughtSnapshot: []`) and `lockCard(sessionId)` (stamps `lockedAt = Date.now()`, freezes `caughtSnapshot`). Start Show calls `lockCard`; the late-deal path (session already active) locks on the same deal action (D-08/D-09). `saveDraftCard` on a card dealt into an already-active show should lock in the same transaction.
**Warning signs:** A finalized show whose `bingoCards.lockedAt` is null.

### Pitfall 5: Reshuffle-rejection guard placed in `packages/core`
**What goes wrong:** D-10 says "Core hard-rejects reshuffle when the session is not active." Reading "core" as `packages/core` would put a Dexie-`status` check in the pure module — violating strict core purity (D-22). The active/locked state lives in `trackedShows.status` + `bingoCards.lockedAt`, both app-side.
**How to avoid:** Implement the guard as an **app-side write-helper invariant** (mirroring `startShow`'s single-active assertion, `db.ts:281`): a `reshuffle`/`saveDraftCard` helper throws if the target session is `finalized` or the card's `lockedAt != null`. "Core" in D-10 means the domain-logic layer, not the `packages/core` package.
**Warning signs:** A React or Dexie import creeping into `packages/core/src/bingo/`.

## Code Examples

### Reconstructing + re-deriving a frozen card (app adapter)
```ts
// Source: composed from packages/core/src/bingo/{mark,wins,context}.ts + RecapView.tsx idiom
import { buildBingoContext, deriveMarks, detectWins,
         type BingoCard, type MarkTrailEntry } from "@guezzer/core";

export function replayCard(
  row: BingoCardRow,
  entries: TrackedEntry[],
  matrix, archive, rarity, albums,          // from loadMatrix()/loadArchive()/getRarityIndex()/loadDexAlbums()
) {
  const card: BingoCard = {
    schemaVersion: 1, seed: row.seed, vibe: row.vibe,
    corpusVersion: row.corpusVersion, freeIndex: row.freeIndex, squares: row.resolvedDefs,
  };
  const ctx = buildBingoContext(matrix, archive, rarity, albums);
  const trail: MarkTrailEntry[] = [...entries]
    .sort((a, b) => a.position - b.position)
    .map((e, i) => ({ songId: e.songId, position: i, isPlaceholder: e.isPlaceholder }));
  const marked = deriveMarks(card, trail, ctx, new Set(row.caughtSnapshot));
  return { marked, wins: detectWins(marked) };
}
```

### Lock write helper (freeze at Start Show / late-deal)
```ts
// Source: mirrors db.ts startShow single-active assertion + update idiom
export async function lockCard(sessionId: string, caughtSongIds: number[]): Promise<void> {
  await db.transaction("rw", db.trackedShows, db.bingoCards, async () => {
    const card = await db.bingoCards.where("sessionId").equals(sessionId).first();
    if (!card) throw new Error(`No bingo card for session ${sessionId}.`);
    if (card.lockedAt != null) return; // already locked — idempotent (D-10)
    await db.bingoCards.update(card.cardId, {
      lockedAt: Date.now(),
      caughtSnapshot: caughtSongIds, // D-08/D-12 freeze
    });
  });
}
```

## State of the Art

Not applicable — this phase uses in-repo patterns exclusively; there is no external "state of the art" to track. All versions are pinned in CLAUDE.md and verified against the shipped code (Dexie 4.4.4, zod 4.4.3, dexie-react-hooks 4.4.0). No deprecations affect this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The caught-songId set for `caughtSnapshot` is derivable from the dex at lock time (via `deriveDex`/`derive-dex.ts` or a lighter helper) | Pitfall 1 | If no clean caught-set accessor exists, the plan needs a small core helper to extract caught songIds; low risk (dex already computes this). [ASSUMED] |
| A2 | Catch-up adds should carry `shownFanSongIds: []` → classified as misses | Pattern 3 | Wrong denominator semantics; user-facing tally could over/under-count hits. Confirm in discuss. [ASSUMED] |
| A3 | `cardId = sessionId` (or its hash) best satisfies D-12 given one-card-per-show + pre-lock reshuffles | Pattern 6 | If a future multi-card-per-show need emerges, key must change; not in v1 scope (D-07). [ASSUMED] |
| A4 | "Core hard-rejects reshuffle" (D-10) means the app domain-logic layer, not `packages/core` | Pitfall 5 | Misplacement would violate core purity; low risk (purity is a hard constraint elsewhere). [ASSUMED] |
| A5 | RecapView is reachable for every show that can have a card (tracked shows), so attaching the bingo section there covers BINGO-07's "any past show" | Pattern 4 | If some card-bearing shows aren't RecapView-reachable, replay coverage gaps; RecapView is documented as reachable "forever from Dex Shows history" (RecapView.tsx:6). [ASSUMED] |

## Open Questions

1. **Merge-collision direction for `bingoCards`.**
   - What we know: D-13 says "imported wins"; the cited precedent (`archiveShows`/`trackedShows`) is actually "local wins" (`merge.ts`). Cards are immutable once locked, so the only meaningful collision is draft-vs-locked.
   - What's unclear: whether to follow D-13's literal "imported wins" or the safer "locked wins."
   - Recommendation: **prefer the locked row on collision**; if both same lock-state, imported wins (D-13 literal). Surface in discuss/plan-check.

2. **Corpus-refresh drift for `bustOut` squares on replay.**
   - What we know: `resolvedDefs` and `caughtSnapshot` are frozen, but `bustOut` matching depends on live `corpusGap` from `buildBingoContext` (`mark.ts:90`). A corpus rebuild changes `corpusGap`.
   - What's unclear: whether `bustOut` replay drift is acceptable, or whether the resolved `corpusGap`/context inputs must also freeze.
   - Recommendation: for the summer-2026 residency the corpus is effectively fixed, so accept the drift and document it (store `corpusVersion` to detect a mismatch). Do NOT expand the freeze scope in Phase 15 unless discuss decides otherwise — it risks re-litigating the Phase-14 freeze contract.

3. **Where the catch-up surface lives** (Claude's discretion per CONTEXT).
   - Recommendation: a shared component invoked from the active-card view, so the same confirm-list + search-log wiring serves both the live catch-up and (Phase 16) the active card. Keep the trail-write path (`adoptSuggestion`/`logSong`) identical to live.

## Environment Availability

Not applicable — this phase is entirely code/config within the existing repo. No external tools, services, runtimes, or CLIs are introduced. All data is bundled static (offline-complete) or in local IndexedDB. Node ≥24.12 (already required) runs the core tests; Vitest (already configured) runs both projects.

## Validation Architecture

> `nyquist_validation: true` in config.json → this section is required. CLAUDE.md mandates unit tests for the scoring pipeline AND dex derivation with fixture setlists — Phase 15 extends that mandate to the freeze/lock/merge/round-trip machinery, which it builds and fixture-tests *before* Phase 16's deal UI exercises it.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (root `vitest.config.ts` with `test.projects: ['packages/*']`) |
| Config file | `vitest.config.ts` (root) + `test/setup.ts` (`fake-indexeddb/auto` for app IDB tests) |
| Quick run command | `npx vitest run packages/app/test/<file>.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-4 (D-14) | Populated v4 DB upgrades to `version(5)`; v1–v4 tables preserved; `bingoCards` present | app (migration) | `npx vitest run packages/app/test/migrationV5.test.ts` | ❌ Wave 0 (model on `migrationV3.test.ts`) |
| SC-1 (D-10) | Reshuffle/draft-write rejected on finalized/locked session | app (db helper) | `npx vitest run packages/app/test/bingoLock.test.ts` | ❌ Wave 0 |
| D-08/D-12 | `lockCard` stamps `lockedAt` + freezes `caughtSnapshot`; late-deal locks on deal | app (db helper) | `npx vitest run packages/app/test/bingoLock.test.ts` | ❌ Wave 0 |
| SC-4 (D-13) | v2 backup imports (bingoCards default []); v3 backup round-trips; merge by `cardId` (chosen collision direction); `MIGRATIONS[2]` fills field | app + core | `npx vitest run packages/app/test/exportImportRoundtrip.test.ts` (extend) + `packages/core/test/merge.test.ts` (extend) | ⚠ Extend existing |
| BINGO-07 | Frozen row + trail → `deriveMarks`/`detectWins` yields expected board + wins; replay == live over same trail | core/app (fixture) | `npx vitest run packages/app/test/bingoReplay.test.ts` | ❌ Wave 0 |
| BINGO-06 | Catch-up adds (adoptSuggestion + search-log) grow the trail → squares re-light deterministically | app (fixture) | `npx vitest run packages/app/test/bingoCatchup.test.ts` | ❌ Wave 0 |
| D-22 adapter | 0-based reindex makes opener fire on the first real entry; placeholder/gap handling | core/app (fixture) | part of `bingoReplay.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the single new/edited test file for that task (`npx vitest run packages/app/test/<file>`).
- **Per wave merge:** both projects (`npx vitest run`).
- **Phase gate:** full suite green + `tsc --noEmit` (the cross-boundary contract: inferred `bingoCardRow` type must stay assignable to `Table<BingoCardRow>`) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `packages/app/test/migrationV5.test.ts` — v4→v5 additive upgrade preserves all tables (model on `migrationV3.test.ts`).
- [ ] `packages/app/test/bingoLock.test.ts` — draft persist, `lockCard` freeze + timestamp, reshuffle/draft rejection on finalized/locked session (D-08/D-09/D-10).
- [ ] `packages/app/test/bingoReplay.test.ts` — fixture setlist with a known board/wins; asserts frozen `caughtSnapshot` drives `neverCaught` and 0-based reindex fires `opener`.
- [ ] `packages/app/test/bingoCatchup.test.ts` — catch-up appends via `adoptSuggestion`/`logSong` re-light squares.
- [ ] Extend `packages/app/test/exportImportRoundtrip.test.ts` — seed a `bingoCards` row, assert round-trip + a v2 (no-bingoCards) backup still imports.
- [ ] Extend `packages/core/test/merge.test.ts` — `MIGRATIONS[2]` + `bingoCards` collision direction.
- [ ] Shared fixtures: a locked `BingoCardRow` + matching `TrackedEntry[]` trail with pre-computed expected `MarkedCard`/`Win[]` (reuse the fixture idiom from `packages/core/test/bingo/mark.test.ts`).

## Security Domain

> `security_enforcement: true`, ASVS level 1, `security_block_on: high`. The only new attack surface is the **import trust boundary** extension for `bingoCards`; everything else reuses hardened existing paths.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts/backend (project constraint). |
| V3 Session Management | no | No server sessions. |
| V4 Access Control | no | Single-user local app. |
| V5 Input Validation | **yes** | `bingoCardRow` as `z.strictObject` + `z.discriminatedUnion` on square kind (reuse `bingoCardSchema`); rejects unexpected keys / `__proto__` at the import boundary, exactly like the four existing rows (`export-schema.ts`). |
| V6 Cryptography | no | No secrets; `cardId` hashing (if used) is for key stability, not security — never hand-roll crypto, but none is needed here. |
| V7 Error Handling / Schema Version | **yes** | Envelope `schemaVersion` guard + `MIGRATIONS` chain already refuses newer/older files loudly (`merge.ts:98-116`); v3 bump extends it. Dexie `version(5)` schema guard mirrors the matrix `schemaVersion` guard idiom. |
| V11/V5 Output Encoding (XSS) | **yes** | `resolvedDefs[].label` and denormalized `venueName`/`city` are kglw-derived untrusted strings; render as **escaped React text only** (never `innerHTML`), matching the existing T-06-21 discipline in RecapView. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious backup file (prototype pollution, extra keys) | Tampering | `z.strictObject` on `bingoCardRow` + top-level envelope (existing idiom); whole-file reject before any DB write (`merge.ts`, Pitfall-5 atomicity). |
| XSS via crafted square `label` / venue string on replay | Tampering / Injection | React text nodes only; no `dangerouslySetInnerHTML`. |
| Version-confusion import (newer/older envelope) | Tampering | `schemaVersion > current` → reject; missing `MIGRATIONS[v]` → "too old" reject (verified). |
| Corrupt/incompatible IndexedDB artifact after upgrade | DoS (bricked view) | Additive `version(5)` (no rewrite) + guarded loaders return handled error sentinels, never unguarded throws (`matrix.ts` idiom). |

## Sources

### Primary (HIGH confidence — the actual shipped code this phase extends)
- `packages/app/src/db/db.ts` — Dexie class, v1–v4 additive versioning, `startShow` single-active assertion, `DbSnapshot`, `snapshot`, `importSnapshot`, `adoptSuggestion`, `logSong`, `markShowAttended` (bulkPut stable-key idiom).
- `packages/core/src/data-safety/export-schema.ts` — envelope zod schema, `.default(...)` back-compat idiom, strictObject discipline, re-declared-mirror pattern.
- `packages/core/src/data-safety/merge.ts` — `MIGRATIONS` forward chain, union-merge (local-wins) idiom, version-guard rejection.
- `packages/core/src/data-safety/serialize.ts` — `ExportSnapshot` + `serializeExport` passthrough.
- `packages/core/src/bingo/{types,mark,wins,context,generate}.ts` — `BingoCard`/`BingoSquareDef`/`bingoCardSchema`, `deriveMarks` (opener=`position===0`, neverCaught=frozen snapshot), `detectWins`, `buildBingoContext`, `MarkTrailEntry` contract.
- `packages/core/src/index.ts` (329-342) — bingo barrel exports.
- `packages/app/src/config.ts` (294) — `SCHEMA_VERSION = 2`; `packages/core/src/config.ts` §bingo (freeIndex 5, specificityRank, jamVehicleSongIds, bustOutGapShows).
- `packages/app/src/dex/RecapView.tsx` — pure re-derivation over `trackedEntries` + loaders; the replay attachment point.
- `packages/app/src/show/ShowView.tsx` (337-368) — `handleAdopt`/`handleSearchSelect` reuse targets.
- `packages/app/src/components/BottomTabBar.tsx`, `packages/app/src/routing/useHashRoute.ts` — tab + route wiring (`ROUTES` union).
- `packages/app/src/settings/{exportDownload,importPicker}.ts`, `packages/app/src/show/matrix.ts` — round-trip wiring + guarded artifact-loader idiom.
- `packages/app/test/{migrationV3,exportImportRoundtrip}.test.ts`, `packages/core/test/bingo/*` — test-fixture precedents.

### Secondary
- `.planning/phases/15-.../15-CONTEXT.md` — locked decisions D-01…D-14 (upstream constraint).
- `.planning/REQUIREMENTS.md` §Gizz Bingo — BINGO-06/07.
- `CLAUDE.md` — stack versions, core-purity constraint, single-config-file rule, test mandate.

### Tertiary (LOW confidence)
- None — every claim in this document is grounded in a read file. Items needing user confirmation are in the Assumptions Log and Open Questions, not asserted as fact.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new deps; every reused module verified in-repo against CLAUDE.md pins.
- Architecture / persistence patterns: HIGH — direct extension of the verified v1–v4 + envelope-v1→v2 precedents.
- Freeze/adapter pitfalls: HIGH — grounded in the exact `mark.ts` predicates (`position===0`, frozen `caughtSnapshot`).
- Merge-collision direction: MEDIUM — CONTEXT.md D-13 is internally contradictory; flagged as Open Question 1.
- Corpus-refresh drift: MEDIUM — a real but low-impact edge for a fixed-corpus residency; Open Question 2.

**Research date:** 2026-07-20
**Valid until:** Stable — bounded entirely by in-repo code, not external ecosystem churn. Re-verify only if `db.ts` version count, `SCHEMA_VERSION`, or the `packages/core/src/bingo` fold contract changes before planning.

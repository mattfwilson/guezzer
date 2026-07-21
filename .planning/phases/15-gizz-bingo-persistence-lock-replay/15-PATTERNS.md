# Phase 15: Gizz Bingo — Persistence, Lock & Replay - Pattern Map

**Mapped:** 2026-07-20
**Files analyzed:** 11 modified + 6 new = 17
**Analogs found:** 15 / 17 (2 new files have partial/composed analogs)

> This is a **code-archaeology phase**: almost every file has an exact in-repo analog to copy from. The two "no exact analog" files (`GamesView.tsx`, `bingoReplay.ts`) are new *shapes* but compose from verified idioms (RecapView derivation + the bingo fold). Nothing new in `packages/core/src/bingo/` — that fold is shipped and frozen (D-22).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/app/src/db/db.ts` *(mod)* | model / persistence | CRUD | itself — v4 `archiveShows` block (db.ts:228-235) + `markShowAttended` (db.ts:466) | exact (self-precedent) |
| `packages/core/src/data-safety/export-schema.ts` *(mod)* | config / schema | transform | itself — `archiveShowRow` (export-schema.ts:46-62) + envelope `.default([])` (line 128) | exact (self-precedent) |
| `packages/core/src/data-safety/serialize.ts` *(mod)* | transform | transform | itself — `ExportSnapshot` + passthrough (serialize.ts:33-65) | exact (self-precedent) |
| `packages/core/src/data-safety/merge.ts` *(mod)* | service | transform | itself — `MIGRATIONS[1]` (merge.ts:52) + `archiveShows` union (merge.ts:137-140) | exact (self-precedent, INVERTED collision dir) |
| `packages/app/src/dex/RecapView.tsx` *(mod)* | component | request-response | itself — the `useMemo` derivation over loaders + `useLiveQuery` (RecapView.tsx:56-94) | exact (self-precedent) |
| `packages/app/src/show/ShowView.tsx` *(mod)* | component | event-driven | itself — `handleAdopt` (ShowView.tsx:362) + `handleSearchSelect` (ShowView.tsx:337) | exact (self-precedent) |
| `packages/app/src/components/BottomTabBar.tsx` *(mod)* | component | request-response | itself — `TABS` array (BottomTabBar.tsx:4-8) | exact (self-precedent) |
| `packages/app/src/routing/useHashRoute.ts` *(mod)* | route | request-response | itself — `ROUTES` union (useHashRoute.ts:9) | exact (self-precedent) |
| `packages/app/src/config.ts` *(mod)* | config | — | itself — `dataSafety.SCHEMA_VERSION` (config.ts:294) | exact (self-precedent) |
| `packages/app/src/games/GamesView.tsx` *(new)* | component | request-response | `dex/RecapView.tsx` (list + `useLiveQuery`) | role-match (composed) |
| `packages/app/src/games/bingoReplay.ts` *(new)* | utility / adapter | transform | `bingo/mark.ts` + `bingo/context.ts` consumers; RESEARCH §Code Examples | partial (composed, no direct analog) |
| `packages/app/test/migrationV5.test.ts` *(new)* | test | — | `packages/app/test/migrationV3.test.ts` | exact (self-precedent) |
| `packages/app/test/bingoLock.test.ts` *(new)* | test | — | `migrationV3.test.ts` §write-helpers (line 104-209) | role-match |
| `packages/app/test/bingoReplay.test.ts` *(new)* | test | — | `packages/core/test/bingo/mark.test.ts` (fixture idiom) | role-match |
| `packages/app/test/bingoCatchup.test.ts` *(new)* | test | — | `migrationV3.test.ts` §adoptSuggestion (line 111-143) | role-match |
| `packages/app/test/exportImportRoundtrip.test.ts` *(extend)* | test | — | itself | exact |
| `packages/core/test/merge.test.ts` *(extend)* | test | — | itself | exact |

## Pattern Assignments

### `packages/app/src/db/db.ts` (model, CRUD) — the largest edit

**Analog:** itself. Four separate self-precedents apply.

**(a) Additive `version(5)` — copy the v4 shape verbatim** (db.ts:228-236). A brand-new table needs NO `.upgrade`:
```ts
// Version 4 (Phase 6 Pokédex): ADDITIVE only … Adds a SINGLE new table,
// `archiveShows` … keyed by the stable 10-digit `&show_id`. No `.upgrade` is
// needed: a new table has no pre-existing rows to backfill.
this.version(4).stores({
  archiveShows: "&show_id",
});
```
New block to append (do NOT touch v1-v4):
```ts
this.version(5).stores({
  bingoCards: "&cardId, sessionId",   // &cardId = stable inbound PK (D-12, NOT ++id); sessionId indexed for replay lookup
});
```
Add the table field beside the others (db.ts:174-178): `bingoCards!: Table<BingoCardRow, string>;` — string-keyed like `trackedShows` (db.ts:177).

**(b) Row interface — mirror the `TrackedShow`/`ArchiveShowRow` doc-comment discipline** (db.ts:69-88, 133-139). RESEARCH Pattern 2 recommends **nesting the pure `BingoCard` under a `card:` key** so `bingoCardSchema` (types.ts:129) is reusable verbatim in the zod row. Fields: `cardId`, `sessionId`, `card: BingoCard`, `caughtSnapshot: number[]`, `lockedAt: number | null`, `showDate`, `venueName: string | null`, `city: string | null`. **CRITICAL (RESEARCH Pitfall 1):** `caughtSnapshot` is REQUIRED even though CONTEXT D-11's field list omits it — without the frozen set, `neverCaught` squares drift on replay.

**(c) Write helpers — mirror the `startShow` single-active assertion + `update` idiom** (db.ts:275-303, 358-360). Two helpers per RESEARCH Pitfall 4:
- `saveDraftCard(...)` — writes row with `lockedAt: null, caughtSnapshot: []` (mirrors `startShow`'s row-build + `db.trackedShows.add`).
- `lockCard(sessionId, caughtSongIds)` — stamps `lockedAt = Date.now()`, freezes `caughtSnapshot`; idempotent if already locked. Copy the transaction+guard shape:
```ts
// Analog: startShow single-active assertion (db.ts:275-285)
export async function lockCard(sessionId: string, caughtSongIds: number[]): Promise<void> {
  await db.transaction("rw", db.trackedShows, db.bingoCards, async () => {
    const card = await db.bingoCards.where("sessionId").equals(sessionId).first();
    if (!card) throw new Error(`No bingo card for session ${sessionId}.`);
    if (card.lockedAt != null) return; // idempotent (D-10)
    await db.bingoCards.update(card.cardId, { lockedAt: Date.now(), caughtSnapshot: caughtSongIds });
  });
}
```
The **reshuffle-rejection guard (D-10)** is an app-side invariant (RESEARCH Pitfall 5 — NOT `packages/core`): the draft-write/reshuffle helper throws if the session is `finalized` or `lockedAt != null`, mirroring `startShow`'s throw (db.ts:281-284).

**(d) `DbSnapshot` + `snapshot()` + `importSnapshot()` — thread `bingoCards` through** (db.ts:162-171, 501-556). `snapshot()` adds `db.bingoCards.toArray()` to the `Promise.all` (db.ts:502-509). **`importSnapshot` commits `bingoCards` like `archiveShows` — a stable-key `bulkPut`, NOT the clear-and-rewrite path used for `trackedShows`/`trackedEntries`** (db.ts:549 is the exact model):
```ts
// Analog db.ts:549 — stable &show_id key, union-only, bulkPut upsert (NOT clear+rewrite)
await db.archiveShows.bulkPut(snapshot.archiveShows);
// → add:
await db.bingoCards.bulkPut(snapshot.bingoCards);
```

---

### `packages/core/src/data-safety/export-schema.ts` (schema, transform)

**Analog:** itself — `archiveShowRow` (lines 46-62) and the envelope `.default([])` back-compat idiom (line 128).

**Row schema** — copy the `z.strictObject` discipline (line 46). Reuse `bingoCardSchema` from `bingo/types.ts:129` for the nested `card` field (it is already a `z.discriminatedUnion` on `kind` — types.ts:104):
```ts
// Analog: archiveShowRow (export-schema.ts:46) strictObject discipline
export const bingoCardRow = z.strictObject({
  cardId: z.string(),
  sessionId: z.string(),
  card: bingoCardSchema,            // reused verbatim from bingo/types.ts:129
  caughtSnapshot: z.array(z.number().int()),
  lockedAt: z.number().nullable(),
  showDate: z.string(),
  venueName: z.string().nullable(),
  city: z.string().nullable(),
});
```
**Envelope field — copy the `.default([])` back-compat pattern** (export-schema.ts:128) so pre-v3 backups still parse:
```ts
// Analog: archiveShows: z.array(archiveShowRow).default([]),  (line 128)
bingoCards: z.array(bingoCardRow).default([]),
```
**Cross-boundary contract (export-schema.ts:16-24):** the inferred `bingoCardRow` type must stay assignable to `Table<BingoCardRow, string>` at `db.importSnapshot`, or the app's `tsc --noEmit` gate fails. Keep enums pinned, do not widen.

---

### `packages/core/src/data-safety/merge.ts` (service, transform) — the one INVERTED pattern

**Analog:** itself — `MIGRATIONS[1]` (line 52) + the `archiveShows` union block (lines 137-140).

**Migration entry — copy `MIGRATIONS[1]`** (merge.ts:52-56). The `.default([])` fills the field at parse, but the loop (merge.ts:107-116) ERRORS if `MIGRATIONS[v]` is missing for a step it must take:
```ts
MIGRATIONS[2] = (e) => ({ ...e, bingoCards: e.bingoCards ?? [] });
```

**Union merge — copy the `archiveShows` block BUT INVERT the loop order** (merge.ts:137-140). The four existing merges are **local-wins** (incoming first, then local):
```ts
// EXISTING (local wins) — merge.ts:137-140
const archiveById = new Map<number, ...>();
for (const row of incoming.archiveShows) archiveById.set(row.show_id, row);
for (const row of local.archiveShows) archiveById.set(row.show_id, row);  // local last → local wins
```
D-13 wants **imported wins**, so set **local first, then incoming** (INVERTED):
```ts
const cardsById = new Map<string, ExportSnapshot["bingoCards"][number]>();
for (const row of local.bingoCards) cardsById.set(row.cardId, row);
for (const row of incoming.bingoCards) cardsById.set(row.cardId, row);  // incoming last → imported wins (D-13)
const mergedBingoCards = [...cardsById.values()];
```
Add `bingoCards: mergedBingoCards` to the `merged` object (merge.ts:273-284). **⚠ FLAG FOR PLANNER (RESEARCH Open Q1 / Pitfall 3):** D-13 is internally contradictory (says "imported wins" AND "consistent with archiveShows", which is local-wins). RESEARCH recommends **prefer the locked row on collision** as the safest resolution. This is a discuss/plan-check decision — do not silently copy-paste local-wins.

---

### `packages/core/src/data-safety/serialize.ts` (transform)

**Analog:** itself (serialize.ts:33-65). Add `bingoCards: z.infer<typeof bingoCardRow>[]` to `ExportSnapshot` (line 33-40), and pass it through verbatim in `serializeExport` (line 55-64) — no mapping (unlike `trackedEntries` which strips `id`; `bingoCards` has no volatile key to strip since `cardId` is stable):
```ts
// verbatim passthrough, like archiveShows (serialize.ts:60)
bingoCards: snapshot.bingoCards,
```

---

### `packages/app/src/config.ts` (config)

**Analog:** itself (config.ts:294). Single-line bump, following the documented 1→2 precedent:
```ts
SCHEMA_VERSION: 2,   // → 3  (v3 envelope adds bingoCards; pre-v3 backups migrate via core MIGRATIONS[2])
```
Also add `copy.games.*` (empty-state teaser, D-02) + any bingo replay copy — mirror the `copy.recap`/`copy.dex` blocks RecapView reads (RecapView.tsx:51-53). All model/copy constants live in this single config file (CLAUDE.md hard rule — no scattered magic numbers).

---

### `packages/app/src/dex/RecapView.tsx` (component, request-response)

**Analog:** itself — the `useLiveQuery` reads + `useMemo` pure-derivation block (RecapView.tsx:56-94).

**Add one live read** (copy the RecapView.tsx:57-60 idiom) for the card:
```ts
const bingoCards = useLiveQuery(() => db.bingoCards.toArray());
```
**Add one loader** — `loadMatrix()` (show/matrix.ts:35, guarded+memoized `{ ok, matrix }` sentinel) beside the existing `loadArchive()`/`loadDexAlbums()`/`getRarityIndex()` (RecapView.tsx:63-65). Guard it in the `useMemo` exactly like `archiveResult.ok` (RecapView.tsx:68).

**Derive the bingo section** by calling the new `bingoReplay.ts` adapter inside a `useMemo` (mirroring the `deriveRecap` call, RecapView.tsx:67-94). **Render rule (D-05):** the section is **absent** when no card row matches this `sessionId` — early-return `null` for that block, do not render an empty shell. **Security (RESEARCH §Security V11):** `resolvedDefs[].label` + `venueName`/`city` are kglw-derived — render as escaped React text only (RecapView.tsx:16 documents this T-06-21 discipline), never `dangerouslySetInnerHTML`.

---

### `packages/app/src/show/ShowView.tsx` (component, event-driven) — catch-up (BINGO-06)

**Analog:** itself — `handleAdopt` (ShowView.tsx:362-368) and `handleSearchSelect` (ShowView.tsx:337-347).

**Bulk catch-up (D-03)** reuses `adoptSuggestion` per checked row, EXACTLY as `handleAdopt`:
```ts
// Analog ShowView.tsx:362-368 — the advisory→logged fast path, per row
void adoptSuggestion(sessionId, {
  songId: suggestion.songId,
  songName: suggestion.songName,
  shownFanSongIds: session.shownFanSongIds,   // catch-up backfill → [] → classifies as miss (honest denominator)
});
```
**Manual mark (D-04)** reuses the fuse.js search → `logSong` miss path, EXACTLY as `handleSearchSelect` (ShowView.tsx:337-347):
```ts
void logSong(sessionId, { songId, songName, outcome: "miss", shownFanSongIds: [], isPlaceholder: false, loggedAt: Date.now() });
```
Neither path touches a square — `deriveMarks` re-lights on the trail write (D-04/D-23). **FLAG (RESEARCH A2 / Pattern 3):** catch-up adds carry `shownFanSongIds: []` → every add classifies as a **miss**. Confirm this denominator is intended (it is consistent with `handleSearchSelect`). **Discretion (RESEARCH Open Q3):** the catch-up confirm-list may live on ShowView, the active-card view, or a shared component — RESEARCH recommends a shared component so the same wiring serves live + (Phase 16) active card.

---

### `packages/app/src/components/BottomTabBar.tsx` (component)

**Analog:** itself — the `TABS` array (BottomTabBar.tsx:4-8). Add a 4th entry with a lucide-react icon (import beside `BookOpen, Compass, Music` on line 1 — RESEARCH suggests `Gamepad2`/`Dices`/`Grid3x3`):
```ts
const TABS: { route: Route; label: string; Icon: typeof Music }[] = [
  { route: "show", label: "LiveGizz", Icon: Music },
  { route: "explore", label: "GizzVerse", Icon: Compass },
  { route: "dex", label: "GizzDex", Icon: BookOpen },
  { route: "games", label: "GizzGames", Icon: Gamepad2 },   // NEW (D-01) — accept 3→4 tap-target tightening
];
```
The `min-h-11 min-w-11` 44px tap target (line 31) already flexes to 4 tabs via `flex-1` — no layout math needed.

---

### `packages/app/src/routing/useHashRoute.ts` (route)

**Analog:** itself — the `ROUTES` allow-list (useHashRoute.ts:9). This is the phase's live security control (T-03-02, useHashRoute.ts:3-8): the hash is validated against this fixed allow-list and only ever SELECTs a view. Add `"games"`:
```ts
export const ROUTES = ["show", "explore", "dex", "games", "settings"] as const;
```

---

### `packages/app/src/games/GamesView.tsx` (component, NEW)

**Analog (composed):** `dex/RecapView.tsx` list + `useLiveQuery` idiom (RecapView.tsx:57). No exact analog — this is a new surface. Build it as:
- `useLiveQuery(() => db.bingoCards.toArray())` for the replayable-card list (D-02).
- A "Deal a card — coming soon" teaser (D-02) — copy from `config.copy.games.*` (must feel intentional, not broken, even when the list is empty).
- Route rendered by the app shell's route switch on `route === "games"`.
Read-only this phase; the Deal entry point is a Phase-16 stub.

---

### `packages/app/src/games/bingoReplay.ts` (utility/adapter, NEW, transform)

**Analog (composed):** RESEARCH §Code Examples + `bingo/mark.ts`/`bingo/context.ts` contracts. No direct in-repo analog — it is the app→core adapter. Two CRITICAL correctness points:

**(1) 0-based contiguous reindex (RESEARCH Pitfall 2).** `mark.ts:84` hard-codes `opener = position === 0`, but `TrackedEntry.position` is 1-based and gapped (db.ts:334, deleteEntry leaves holes). The adapter MUST re-index:
```ts
const trail: MarkTrailEntry[] = [...entries]
  .sort((a, b) => a.position - b.position)
  .map((e, i) => ({ songId: e.songId, position: i, isPlaceholder: e.isPlaceholder }));
```
`MarkTrailEntry` is the minimal contract (mark.ts:33-37): `{ songId, position, isPlaceholder }` — never pass the raw app row (D-22).

**(2) Frozen `caughtSnapshot`, never the live dex (RESEARCH Pitfall 1).** Pass `new Set(row.caughtSnapshot)` (mark.ts:91-94 reads it for `neverCaught`).

Full derivation (reconstruct card → build context → mark → detect wins), from the barrel (`@guezzer/core`, index.ts:329-342):
```ts
import { buildBingoContext, deriveMarks, detectWins, type BingoCard, type MarkTrailEntry } from "@guezzer/core";
const card: BingoCard = row.card;                         // nested per Pattern 2 (or reconstruct from flat fields)
const ctx = buildBingoContext(matrix, archive, rarity, albums);   // context.ts:92 — same shipped artifacts
const marked = deriveMarks(card, trail, ctx, new Set(row.caughtSnapshot));  // mark.ts:111
const wins = detectWins(marked);                          // wins.ts:49
```
Render (D-06): `marked.squares[i].markedByPosition` gives "which song lit this" (FREE_SENTINEL = -1 is the pre-marked center, types.ts:74); `wins` gives the badge set (line/corners/x/blackout). This same adapter should be shared by replay AND catch-up preview so `live == replay == catch-up` holds.

---

## Shared Patterns

### Additive Dexie versioning (never a destructive rewrite)
**Source:** `packages/app/src/db/db.ts:228-236` (v4 block).
**Apply to:** `db.ts` version(5).
A new table needs no `.upgrade`. v1-v4 blocks are untouched. `&` = unique inbound PK. Populated v4 DBs upgrade in place, losslessly. This is roadmap SC-4 and D-14.

### Stable-key `bulkPut` merge discipline (never the volatile `++id`)
**Source:** `db.ts:466-480` (`markShowAttended` / `archiveShows`) + `db.ts:549` (import commit) + `merge.ts:137-140` (union).
**Apply to:** `bingoCards` everywhere it is written or merged.
The key (`cardId`) must be stable + device-independent + merge-safe (D-12), mirroring `archiveShows.show_id` / `trackedShows.sessionId`. **RESEARCH Pattern 6 recommends `cardId = sessionId`** (one card per show, D-07) so pre-lock reshuffles are in-place overwrites (the seed lives IN the row and changes freely). `xmur3` (bingo/prng.ts:19) is available if an opaque hash is preferred — do NOT add a hashing dependency.

### Versioned envelope: `.default([])` + `MIGRATIONS[n]` back-compat
**Source:** `export-schema.ts:122-131` (`.default(...)` fields) + `merge.ts:51-56` (`MIGRATIONS[1]`) + `config.ts:294` (SCHEMA_VERSION).
**Apply to:** all five coordinated envelope-v3 edits (export-schema, config, merge migration, merge union, serialize+db threading).
Schema drift fails loudly at the import trust boundary; `.default([])` keeps existing v2 backups importable; the `MIGRATIONS` loop (merge.ts:107-116) errors if an entry is missing for a step it must take — so `MIGRATIONS[2]` is mandatory even though `.default` fills the field.

### Import trust boundary (strict zod, whole-file reject, atomic commit)
**Source:** `merge.ts:74-116` (parse→gate→migrate) + `importPicker.ts:88-112` (commit only on `{ok:true}`) + `db.ts:534-556` (one rw transaction).
**Apply to:** the `bingoCardRow` schema (V5 input validation) + round-trip tests.
Every row is a `z.strictObject` (rejects `__proto__`/extra keys); a rejected file writes NOTHING (Pitfall 5). `bingoCardRow` reuses `bingoCardSchema`'s `z.discriminatedUnion("kind", …)` (types.ts:104) — an unknown square `kind` hard-fails.

### Pure re-derivation over the persisted trail (`useLiveQuery` + `useMemo`)
**Source:** `RecapView.tsx:56-94`.
**Apply to:** RecapView bingo section + GamesView list + bingoReplay adapter.
The component holds ZERO domain math — it reads Dexie via `useLiveQuery`, guards loader sentinels, and calls a pure core/adapter function in `useMemo`. Re-opening a past show re-derives an identical result (T-06-22). This is why replay stores no marks (D-23).

### Escaped-React-text-only output (XSS)
**Source:** `RecapView.tsx:16` (T-06-21 discipline).
**Apply to:** RecapView bingo section + GamesView.
`resolvedDefs[].label`, `venueName`, `city` are kglw-derived untrusted strings — render as React text nodes, never `dangerouslySetInnerHTML`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/app/src/games/GamesView.tsx` | component | request-response | First tab-home surface of its kind; composes RecapView's `useLiveQuery`-list idiom but no 1:1 analog exists. Planner should copy the list+empty-state shape from RecapView and the tab render-switch from the app shell. |
| `packages/app/src/games/bingoReplay.ts` | utility/adapter | transform | The app→core trail adapter is genuinely new (Phase 14 shipped the fold but no app caller). Use RESEARCH §Code Examples verbatim; the load-bearing details are the two Pitfalls (0-based reindex, frozen caughtSnapshot). |

> Note: `caughtSnapshot` extraction at lock time has **no clean exported helper** (RESEARCH Assumption A1). `deriveDex` computes caught ids internally (`caughtIds`, derive-dex.ts:208) but does not export a caught-set accessor. The planner must either add a small core caught-set helper or extract from the dex derivation — Claude's discretion, flagged in RESEARCH.

## Test Patterns

| New/Extended Test | Analog | Copy From |
|-------------------|--------|-----------|
| `migrationV5.test.ts` | `migrationV3.test.ts` | The `resetDb` + seed-old-version + `db.open()` + `expect(db.verno)` shape (migrationV3.test.ts:28-101). Seed a v4 DB, assert v5 upgrade preserves v1-v4 tables + `bingoCards` present. |
| `bingoLock.test.ts` | `migrationV3.test.ts` §write-helpers (line 104-209) | The `startShow()` + helper-call + `db.*.get()` assertion shape. Assert `lockCard` stamps `lockedAt` + freezes `caughtSnapshot`; draft/reshuffle rejected on finalized/locked session (D-08/D-09/D-10). |
| `bingoReplay.test.ts` | `packages/core/test/bingo/mark.test.ts` (fixture idiom) | A locked `BingoCardRow` + matching `TrackedEntry[]` trail with pre-computed expected `MarkedCard`/`Win[]`. Assert 0-based reindex fires `opener`; frozen `caughtSnapshot` drives `neverCaught`. |
| `bingoCatchup.test.ts` | `migrationV3.test.ts` §adoptSuggestion (line 111-143) | Catch-up adds via `adoptSuggestion`/`logSong` grow the trail → squares re-light deterministically. |
| `exportImportRoundtrip.test.ts` *(extend)* | itself | Seed a `bingoCards` row; assert v3 round-trip + a v2 (no-bingoCards) backup still imports (`.default([])`). |
| `merge.test.ts` *(extend)* | itself | `MIGRATIONS[2]` fills the field + `bingoCards` collision direction (the chosen resolution of Open Q1). |

**Framework:** Vitest 4.1.10, `npx vitest run packages/app/test/<file>.test.ts`. App IDB tests use `fake-indexeddb/auto` (test/setup.ts). Phase gate: full suite green + `tsc --noEmit` (the inferred `bingoCardRow` type must stay assignable to `Table<BingoCardRow>`).

## Metadata

**Analog search scope:** `packages/app/src/{db,dex,show,components,routing,settings,games}`, `packages/core/src/{data-safety,bingo,dex}`, `packages/app/test/`, `packages/core/test/`.
**Files scanned:** 18 (13 read in full/targeted, 5 confirmed via Glob/Grep).
**Pattern extraction date:** 2026-07-20

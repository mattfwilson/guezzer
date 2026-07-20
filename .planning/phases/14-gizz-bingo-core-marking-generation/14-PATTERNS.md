# Phase 14: Gizz Bingo — Core Marking & Generation - Pattern Map

**Mapped:** 2026-07-19
**Files analyzed:** 15 (9 source create/modify + 6 test create/modify)
**Analogs found:** 15 / 15 (every file has a strong in-repo analog — this is an internal-domain phase)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/core/src/bingo/types.ts` | model/schema | transform | `packages/core/src/ingest/tuning-tags.ts` (zod strict union + string-literal types) | exact (role) |
| `packages/core/src/bingo/prng.ts` | utility | transform | `packages/core/src/model/decay.ts` (tiny pure numeric helper module) | role-match |
| `packages/core/src/bingo/context.ts` | service/index-build | transform | `packages/core/src/dex/rarity.ts` (`buildRarityIndex`: artifacts → Maps) | exact |
| `packages/core/src/bingo/generate.ts` | service | transform (seeded generation) | `packages/core/src/dex/derive-dex.ts` + `dex/albums.ts` (`deriveDexAlbums`) | role-match |
| `packages/core/src/bingo/mark.ts` | service | event-driven fold (consume-once) | `packages/core/src/dex/derive-dex.ts` (`deriveDex` pure trail fold) | exact |
| `packages/core/src/bingo/wins.ts` | utility | transform (grid math) | `packages/app/src/show/scoring.ts` (`deriveTally`: small pure derive) | role-match |
| `packages/core/src/cli/bingo-calibrate.ts` | cli | batch + report-response (gate) | `packages/core/src/cli/run-backtest.ts` | exact |
| `packages/core/src/config.ts` (modify) | config | — | existing `dex` / `explore` sections in same file | exact |
| `packages/core/src/index.ts` (modify) | barrel | — | existing Phase-6/7 export blocks in same file | exact |
| `packages/core/test/bingo/mark.test.ts` | test | — | `packages/core/test/dex/derive-dex.test.ts` | exact |
| `packages/core/test/bingo/generate.test.ts` | test | — | `packages/core/test/dex/derive-dex.test.ts` | exact |
| `packages/core/test/bingo/wins.test.ts` | test | — | `packages/core/test/dex/rarity.test.ts` | role-match |
| `packages/core/test/bingo/context.test.ts` | test | — | `packages/core/test/dex/derive-dex.test.ts` | exact |
| `packages/core/test/fixtures/bingo/synthetic.ts` | test fixture | — | `packages/core/test/fixtures/dex/synthetic.ts` | exact |
| `packages/core/test/config.test.ts` (add/create) | test | — | `packages/core/test/eval/backtest.test.ts` (config-assert idiom) | role-match |

> All source files live under `packages/core/src/` (strict-purity package: `"lib": ["ES2023"]`, no React, `erasableSyntaxOnly`). All tests live under `packages/core/test/` (NOT `src/`) — verified: `vitest.config.ts` `include: ["test/**/*.test.ts"]`, `@guezzer/core` project runs `environment: "node"`.

---

## Pattern Assignments

### `packages/core/src/bingo/mark.ts` (service, consume-once fold) — THE load-bearing file

**Analog:** `packages/core/src/dex/derive-dex.ts` (`deriveDex`)

This is the closest core-side analog and the sibling third-derivation-over-the-trail. Copy its module discipline exactly: JSDoc header stating "Zero I/O, no Dexie types", `import { config } from "../config.ts"`, ONE exported top-level fn, `cfg: typeof config = config` default param, `Map`-keyed accumulation, explicit sort comparators, ascending-order timeline walk.

**Module-header + import + signature pattern** (derive-dex.ts lines 1-16, 86-92) — note the `.ts` extension on imports (Node native TS), config default param, and "no Dexie" purity note:
```typescript
// derive-dex.ts:1-16 (header) + :13-16 (imports)
import { config } from "../config.ts";
import { attendanceKey } from "../data-safety/attendance-key.ts";
import type { ArchiveArtifact } from "./archive-types.ts";
import type { RarityIndex, RarityTier } from "./rarity.ts";

// derive-dex.ts:86-92 (signature discipline to mirror)
export function deriveDex(
  snapshot: DexSnapshotInput,
  archive: ArchiveArtifact,
  albums: AlbumsInput,
  rarity: RarityIndex,
  cfg: typeof config = config,
): DexStats {
```
`deriveMarks` mirrors this discipline exactly (RESEARCH §"consume-once marking fold"):
```typescript
export function deriveMarks(
  card: BingoCard,
  trail: ReadonlyArray<{ songId: number | null; position: number; isPlaceholder: boolean }>,
  ctx: BingoContext,
  caughtSnapshot: ReadonlySet<number>,   // D-12/D-22 frozen prior sightings
  cfg: typeof config = config,
): MarkedCard { ... }
```

**Ascending-order timeline walk + skip-placeholder pattern** (derive-dex.ts lines 111-120, 175-186). This is exactly the consume-once ordering + null-songId skip the marking fold needs (D-07, D-11, placeholder policy A2):
```typescript
// derive-dex.ts:112-120 — skip placeholder / null songId (matches D-22 skip policy)
for (const entry of snapshot.trackedEntries) {
  if (entry.isPlaceholder || entry.songId == null) continue;
  ...
}
// derive-dex.ts:175-186 — forEach with ascending index, newest-wins accumulation
timeline.forEach((night, index) => {
  for (const songId of night.songIds) { ... }
});
```

**Deterministic tie-break pattern** — copy the `< / > / secondary-key` comparator idiom used throughout derive-dex.ts (lines 149-151) and rarity.ts (line 59) for the D-08→D-10 total order (`specificityRank` then lowest board index):
```typescript
// derive-dex.ts:149-151 — stable multi-key sort (date, then key) — the idiom to reuse
const groupKeysSorted = [...groups.entries()].sort((a, b) =>
  a[1].date < b[1].date ? -1 : a[1].date > b[1].date ? 1 : a[0] < b[0] ? -1 : 1,
);
```
Apply as `argmin over qualifying of (cfg.bingo.specificityRank[kind], sq.index)`. Read `specificityRank` from config (never inline literals) — see config section below.

---

### `packages/core/src/bingo/context.ts` (service, artifacts → Maps)

**Analog:** `packages/core/src/dex/rarity.ts` (`buildRarityIndex`)

Same shape: "pure module, one top-level fn, Map-keyed accumulation, config injected with a default; zero I/O, no `Date.now()`". `buildBingoContext` resolves the shipped `matrix` / `archive` / `rarity` / `dex-albums` artifacts into fast lookup Maps (`microtonalSongIds`, `corpusGap`, `albumSongIds`, `jamVehicleSongIds`, `eraPlayRate`).

**Build-Map-from-artifact pattern** (rarity.ts lines 51-107):
```typescript
// rarity.ts:51-54 — signature + config default
export function buildRarityIndex(
  archive: ArchiveArtifact,
  cfg: typeof config = config,
): RarityIndex {
// rarity.ts:63-80 — single pass, Map accumulator
const acc = new Map<number, RarityAccumulator>();
for (let i = 0; i < shows.length; i++) { ... acc.set(songId, entry); }
// rarity.ts:94-104 — emit sorted-by-key for determinism
const entries = [...acc.entries()].sort((a, b) => a[0] - b[0]);
```

**Sources to resolve (all already ship — add zero pipelines, RESEARCH Pattern 4):**
| Bingo need | Source field | Verified |
|------------|--------------|----------|
| song base-rate (D-25) | `MatrixNode.eraPlayCount` | domain/types.ts:117 |
| microtonal predicate | `MatrixNode.tuningFamily === "microtonal"` | domain/types.ts:118 |
| bust-out predicate | `SongRarity.corpusGap >= cfg.bingo.bustOutGapShows` | rarity.ts:20-29 |
| album→song membership | `DexAlbumsArtifact.albums[].tracks[].songId` (build `albumUrl → Set<songId>`) | dex/albums.ts:161-186 |
| never-caught | `songId ∉ caughtSnapshot` (frozen set param, not resolved in ctx) | derive-dex.ts:208 |

---

### `packages/core/src/bingo/generate.ts` (service, seeded generation)

**Analog:** `packages/core/src/dex/albums.ts` (`deriveDexAlbums`) for the config-driven selection + build shape; `derive-dex.ts` for module discipline.

`deal(seed, vibe, ctx, dexSnapshot, corpusVersion, cfg = config) -> BingoCard` is a pure function. Draw all randomness from the injected PRNG stream (never `Math.random()`/`Date.now()` — Anti-Pattern 3). Compose the seed per D-21/RESEARCH:
```typescript
const seedStr = `${seed} ${vibe} ${corpusVersion}`;
const rand = mulberry32(xmur3(seedStr)());   // rand() -> [0,1)
```

**Config-allowlist-driven selection pattern** (albums.ts lines 84-118): `deriveDexAlbums` reads `cfg.dex.cardAlbumUrls` into a `Set`, then filters/selects. `deal` mirrors this — read `cfg.bingo.albumSquarePool` / `cfg.bingo.jamVehicleSongIds` / per-vibe `mix` weights and select squares:
```typescript
// albums.ts:85-87 — config allowlist → Set, then drive selection off it
const sentinelIds = new Set<number>(cfg.sentinelSongIds);
const cardUrls = new Set<string>(cfg.dex.cardAlbumUrls);
```

**Zod-validate-before-return pattern** (albums.ts lines 208-216) — `deal` should return a schema-validated `BingoCard` so a shape drift fails loudly:
```typescript
// albums.ts:215-216
// Validate through the strict schema before returning (T-06-02).
return dexAlbumsArtifact.parse(artifact);   // → bingoCard.parse(card) here
```

---

### `packages/core/src/bingo/types.ts` (model/schema)

**Analog:** `packages/core/src/ingest/tuning-tags.ts`

Copy the paired-declaration idiom: a `const values = [...] as const` tuple + a derived string-literal union type + a `z.strictObject` schema + a `z.infer` type. This is the erasable-syntax-only way to get unions (never `enum`). Mirror also `dex/archive-types.ts` for the `schemaVersion: 1` frozen-header discipline (referenced in derive-dex/albums).

**String-literal union + closed-vocabulary pattern** (tuning-tags.ts lines 24-39):
```typescript
// tuning-tags.ts:24-37
export const tuningFamilyValues = ["standard", "cs-standard", "microtonal", "other"] as const;
export type TuningFamily = (typeof tuningFamilyValues)[number];

export const tuningTagEntrySchema = z.strictObject({
  songId: z.number().int(),
  name: z.string(),
  family: z.enum(tuningFamilyValues, { error: (issue) => `...` }),
  needsReview: z.boolean(),
  source: z.enum(["album-default", "hand-tagged"]),
});
export type TuningTagEntry = z.infer<typeof tuningTagEntrySchema>;
```
Apply to `BingoVibe` / `BingoEvent` / `BingoWinKind` unions and a `bingoCard` `z.strictObject` (RESEARCH `BingoCard` shape — note `seed: string` not number, D-21). `import { z } from "zod"` (tuning-tags.ts:20). Discriminated-union `BingoSquareDef` on `kind` — use `z.discriminatedUnion("kind", [...])`.

**Superrefine-for-invariant pattern** (tuning-tags.ts lines 46-61) — reuse for card-level invariants (exactly 16 squares, exactly one `free` at `freeIndex`) if enforced in the schema:
```typescript
// tuning-tags.ts:48-60 — array superRefine that fails loudly on a structural violation
entries: z.array(tuningTagEntrySchema).superRefine((entries, ctx) => { ... ctx.addIssue({ code: "custom", ... }); })
```

---

### `packages/core/src/bingo/prng.ts` (utility)

**Analog:** `packages/core/src/model/decay.ts` (tiny pure numeric helper — same "one small pure export, no config, no I/O" footprint).

Copy the xmur3 + mulberry32 snippet **verbatim** from RESEARCH §Standard Stack (lines 118-158) with the public-domain source comment. Uses only `Math.imul` + bit ops — ES2023-lib safe, fully erasable (no class/enum). Never call `Math.random()`/`Date.now()`.

---

### `packages/core/src/bingo/wins.ts` (utility, grid math)

**Analog:** `packages/app/src/show/scoring.ts` (`deriveTally`) — smallest pure-derive footprint (a tiny pure fn taking data, returning a computed summary).

`detectWins(markedCard) -> Win[]` is pure 4×4 grid math (rows/cols/diagonals/corners/blackout), free cell counts as marked (D-06). Keep it literal-free where geometry constants belong in config (`freeIndex`). Mirror `deriveTally`'s minimalism (scoring.ts:38-48) — no I/O, no config unless a constant is needed. NOTE: model the *module purity* on scoring.ts but keep the file in `core/` (scoring.ts is app-side and imports `TrackedEntry` — do NOT copy that import; core must not import `TrackedEntry`, D-22).

---

### `packages/core/src/cli/bingo-calibrate.ts` (cli, report + hard-assert gate)

**Analog:** `packages/core/src/cli/run-backtest.ts` — copy nearly cell-for-cell.

**Node-native-TS CLI scaffold** (run-backtest.ts lines 14-19, 155-171):
```typescript
// run-backtest.ts:14-17 — node: imports, config
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "../config.ts";
// run-backtest.ts:155-171 — isMain guard + exit(1) in catch (the gate)
const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    ...
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}
```
For the D-19b gate, extend the `if (isMain)` block: after the report prints, if `failures.length > 0` print each and `process.exit(1)` (RESEARCH Code Examples "CLI gate skeleton").

**`--out` / `--json-out` flag parser** (run-backtest.ts lines 140-153) — copy verbatim, add `--candidates` mode flag for the D-20 roster-candidate emit:
```typescript
// run-backtest.ts:140-153
function parseArgs(argv: string[]): RunBacktestCliOptions {
  const options: RunBacktestCliOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out") options.reportOutPath = argv[++i];
    else if (arg === "--json-out") options.jsonOutPath = argv[++i];
    else throw new Error(`Unknown flag: ${arg}`);
  }
  return options;
}
```

**Byte-stable write pattern** (run-backtest.ts lines 123-137) — mkdir + `JSON.stringify(result, null, 2)` + trailing `\n`, and `console.log(report)` to stdout. `generatedAt` MUST come from `corpus.generatedAt`, never wall-clock (Pitfall 4):
```typescript
// run-backtest.ts:127-135
await mkdir(dirname(jsonOutPath), { recursive: true });
await writeFile(jsonOutPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await mkdir(dirname(reportOutPath), { recursive: true });
await writeFile(reportOutPath, report, "utf8");
console.log(report);
```

**Report builder pattern** (run-backtest.ts lines 92-112) — `sections: string[]` joined with `\n\n` + trailing `\n`:
```typescript
// run-backtest.ts:92-111
export function formatBacktestReport(result: BacktestResult): string {
  const sections: string[] = [];
  sections.push(`# Backtest Report ...`);
  sections.push(`## Top-k hit rates\n\n${formatTopKTable(result)}`);
  return `${sections.join("\n\n")}\n`;
}
```

**Corpus read + filter** — read `config.corpusArtifactPath`, `JSON.parse`, filter `year >= 2022` → 241 shows; flatten `sets[].performances[].{songId,position}` into a single ascending play-order (opener = index 0). Performance shape verified: domain/types.ts:19-31 (`songId`, `position`, `isPlaceholder`).

---

### `packages/core/src/config.ts` (modify — add `bingo` section)

**Analog:** the existing `dex:` (lines 207-302) and `explore:` (lines 310-349) sections in the same file.

Add a `bingo:` block after `explore` (single-config-file rule, CLAUDE.md). Copy the section conventions: nested object literal inside the `as const` config, `[ASSUMED]`/`[VERIFIED]` JSDoc comment discipline on every value, artifact-path keys mirroring `backtestReportPath`/`backtestJsonPath` (lines 102-105). Full proposed shape is in RESEARCH §"Config surface" (lines 397-426): `calibrationReportPath`, `calibrationJsonPath`, `rosterCandidatesPath`, `freeIndex`, `darkSquareFloor`, `bustOutGapShows`, `simCardsPerVibe`, `specificityRank`, `reliableEvents`, `gloryEvents`, `jamVehicleSongIds` (empty until D-20 checkpoint), `albumSquarePool` (empty until checkpoint), and per-vibe `vibes.{chill,balanced,glory}` mix/target bands.

**Path-key + [ASSUMED] comment idiom** (config.ts lines 101-105, 226-231):
```typescript
// config.ts:102-105 — the artifact-path convention to mirror
/** D-15: human-readable backtest report, mirrors censusReportPath. */
backtestReportPath: "data/backtest-report.md",
/** D-15: machine-readable backtest output, paired with backtestReportPath. */
backtestJsonPath: "data/backtest.json",
```
Keep `bingo.albumSquarePool` a DISTINCT key from `dex.cardAlbumUrls` (RESEARCH lines 428) — the dex shelf and the bingo pool tune independently, same discipline as `search` vs `dex.archiveSearch`.

---

### `packages/core/src/index.ts` (modify — add bingo barrel block)

**Analog:** the Phase-6/Phase-7 export blocks in the same file (lines 199-217 dex, 275-288 explore).

Add a `bingo/` block mirroring these: a JSDoc paragraph then `export { fn, type X }` grouped by module. Export `deal`, `deriveMarks`, `detectWins`, `buildBingoContext`, `expectedFill`, and types (`BingoCard`, `BingoSquareDef`, `MarkedCard`, `MarkedSquare`, `Win`, `BingoVibe`, `BingoEvent`, `BingoWinKind`, `BingoContext`). CLI internals (`cli/bingo-calibrate.ts`) stay behind the boundary — NEVER exported (matches run-backtest.ts, which is absent from index.ts; only `runBacktest` from `eval/` is exported).

**Barrel block pattern** (index.ts lines 199-211):
```typescript
// index.ts:199-211 — the block shape to copy
export {
  buildRarityIndex,
  showRarityScore,
  type RarityTier,
  type SongRarity,
  type RarityIndex,
} from "./dex/rarity.ts";
export {
  deriveDex,
  type DexSnapshotInput,
  ...
} from "./dex/derive-dex.ts";
```

---

### `packages/core/test/bingo/*.test.ts` + fixtures

**Analog:** `packages/core/test/dex/derive-dex.test.ts` + `packages/core/test/fixtures/dex/synthetic.ts`

**Test-file scaffold** (derive-dex.test.ts lines 1-44):
```typescript
// derive-dex.test.ts:1-13 — imports from ../../src (.ts ext) + ../fixtures
import { describe, expect, it } from "vitest";
import { deriveDex } from "../../src/dex/derive-dex.ts";
import { archiveShow, dexSnapshot, ... } from "../fixtures/dex/synthetic.ts";
// :42-44 — a local `run(...)` helper that binds the shared fixtures
function run(snapshot) { return deriveDex(snapshot, archive, albums, rarity); }
// :46-55 — describe("<fn> — <requirement id>") / it("<behavior> (D-xx)")
```

**Fixture factory idiom** (fixtures/dex/synthetic.ts lines 25-64): override-spread `Partial<T>` factories (`archiveShow(over = {})`), and the load-bearing note (lines 5-11) — declare input shapes LOCALLY / structurally so fixtures compile standalone and stay assignable without a nominal import. For bingo, hand-author cards + trails with known marks/wins (RESEARCH Wave 0 gaps):
```typescript
// synthetic.ts:25-36 — the factory idiom to copy
export function archiveShow(over: Partial<ArchiveShow> = {}): ArchiveShow {
  return { id: 100, date: "2020-01-01", ..., ...over };
}
```

Test coverage to write (from RESEARCH Test Map):
- `mark.test.ts` — `live == replay == catch-up` (full-trail vs shuffled-then-sorted vs incremental foldLeft byte-identical); consume-once (1 song / 3 squares → 1 mark); 15-song → ≤15 marks; tie-break never-caught > bust-out (D-09), equal-tier → lowest index (D-10); placeholder skip + rename-relights.
- `generate.test.ts` — same-seed → deep-equal card; different seed → different; never-blank (16 squares, exactly one `free` at `freeIndex`).
- `wins.test.ts` — line/corners/X/blackout geometry including free cell.
- `context.test.ts` — `buildBingoContext` resolves artifacts into correct lookups.

**`config.test.ts` addition** — assert `specificityRank` is a total order, `freeIndex ∈ {5,6,9,10}`, per-vibe mix weights present. Model the config-import + assert idiom on `test/eval/backtest.test.ts` (imports `config` from `../../src/config.ts`). NOTE: no `test/config.test.ts` currently exists — this is a NEW file (see "No Analog" note below).

---

## Shared Patterns

### Core purity (applies to ALL `bingo/` source files)
**Source:** CLAUDE.md constraint + `dex/derive-dex.ts:9-12`, `dex/rarity.ts:9-12` headers
```typescript
// Every core module opens with a "Zero I/O, no Dexie/DOM/Date.now()" purity note.
// Rules: import { config } from "../config.ts" with the .ts extension;
// cfg: typeof config = config default param; string-literal unions never enum;
// no `Math.random()`/`Date.now()`; NEVER import TrackedEntry (packages/app/src/db/db.ts) — D-22.
```
The core defines its own minimal trail contract `{ songId: number | null; position: number; isPlaceholder: boolean }` (structural, not imported). This mirrors how `dex/derive-dex.ts:25-43` declares `DexSnapshotInput` as a *local structural subset* rather than importing app types.

### Deterministic ordering (applies to mark.ts, context.ts, generate.ts, bingo-calibrate.ts)
**Source:** `dex/derive-dex.ts:149-151`, `dex/rarity.ts:58-59,95`
```typescript
// Every map iteration / selection sorts by a stable key with an explicit
// secondary tie-break, so output is byte-stable across reruns (Pitfall 4).
[...map.entries()].sort((a, b) => a[0] - b[0]);        // by numeric key
[...set].sort((a, b) => a.x < b.x ? -1 : a.x > b.x ? 1 : a.id - b.id);  // multi-key
```

### Zod strict schema (applies to types.ts; consumed by generate.ts, bingo-calibrate.ts)
**Source:** `ingest/tuning-tags.ts:28-61`, `dex/albums.ts:215-216`
```typescript
// z.strictObject + z.enum(closedVocab) + z.infer paired type; parse() before
// returning a built artifact so shape drift fails loudly (never reaches disk/Dexie).
```

### Markdown-report XSS escaping (applies to bingo-calibrate.ts)
**Source:** `cli/run-backtest.ts:41-43`
```typescript
// run-backtest.ts:41-43 — reuse verbatim for any song name embedded in the report
function escapeMarkdownExcerpt(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
```

### CLI gate scaffold (applies to bingo-calibrate.ts)
**Source:** `cli/run-backtest.ts:155-171`
```typescript
// isMain guard + try/catch with process.exit(1); byte-stable writes; console.log(report).
// D-19b extends the guard: collect `failures`, print, process.exit(1) if any.
```

---

## No Analog Found

None. Every file has a strong in-repo analog. Two low-friction notes:

| File | Note |
|------|------|
| `packages/core/test/config.test.ts` | No such file exists yet (there is no dedicated config test). It is effectively NEW — use the `import { config } from "../../src/config.ts"` + `expect(...)` idiom from any core test (e.g. `test/eval/backtest.test.ts:2`). Alternatively fold the config assertions into `test/bingo/generate.test.ts` rather than creating a new file. |
| `packages/core/src/bingo/prng.ts` | The PRNG *algorithm* (xmur3/mulberry32) is external (public-domain snippet in RESEARCH lines 118-158), not derived from an in-repo analog — but its *module shape* (tiny pure numeric export) matches `model/decay.ts`. Copy the snippet verbatim with the source comment. |

---

## Metadata

**Analog search scope:** `packages/core/src/{dex,ingest,model,cli,domain}/`, `packages/core/test/{dex,eval,fixtures}/`, `packages/app/src/show/`, `packages/core/src/{config,index}.ts`
**Files scanned (read in full or targeted):** derive-dex.ts, albums.ts, tuning-tags.ts, rarity.ts, run-backtest.ts, scoring.ts, config.ts, index.ts, domain/types.ts (MatrixNode/Performance), derive-dex.test.ts, fixtures/dex/synthetic.ts, eval/backtest.test.ts
**Key structural facts verified:** tests live in `packages/core/test/` (not `src/`); `MatrixNode.eraPlayCount`/`tuningFamily` (types.ts:117-118); `Performance.{songId,position,isPlaceholder}` (types.ts:19-31); config `dex`/`explore` section conventions; index.ts barrel-block shape; CLIs never barrel-exported.
**Pattern extraction date:** 2026-07-19

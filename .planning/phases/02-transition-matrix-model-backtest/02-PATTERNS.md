# Phase 2: Transition Matrix, Model & Backtest - Pattern Map

**Mapped:** 2026-07-08
**Files analyzed:** 11 new/modified (9 new, 2 extended)
**Analogs found:** 11 / 11 (every file has a Phase 1 analog — this is an additive phase over an established `packages/core` layout)

> This is a **pure `packages/core` phase** — zero React/DOM/browser deps (compile-enforced by the package's `lib: ES2023` tsconfig + no-React `package.json`). Every new file is a new pure function, a new pure-derivation module, a thin Node-CLI wrapper, or a Vitest fixture test — and Phase 1 already ships a proven analog for each of those four shapes. The planner should copy structure, imports, export style, error-message convention, and determinism discipline **verbatim** from the cited analogs.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/domain/types.ts` (EXTEND) | model / domain types | transform | `src/domain/types.ts` (existing unions/interfaces) | exact (same file, same vocabulary) |
| `src/config.ts` (EXTEND) | config | — | `src/config.ts` (existing `as const` object) | exact (same file) |
| `src/model/matrix.ts` (NEW) | model / builder | transform (corpus → artifact) | `src/ingest/census.ts` (pure derivation over corpus rows) | role+flow match |
| `src/model/decay.ts` (NEW) | model / pure helper | transform | `src/ingest/census.ts` helpers (small pure fns) | role match |
| `src/model/predict.ts` (NEW) | model / scorer | transform (matrix+context → ranked) | `src/ingest/tuning-tags.ts` (pure multi-stage resolve) | role match |
| `src/model/index-build.ts` (NEW) | model / loader helper | transform | `deriveCatalogFromCorpus` in `tuning-tags.ts` (index build from corpus) | role match |
| `src/eval/backtest.ts` (NEW) | eval / walk-forward | batch | `src/ingest/census.ts` (batch derivation + `derived` result object) | role+flow match |
| `src/eval/holdout.ts` (NEW) | eval / pure helper | transform | pure reducer fns in `census.ts` | role match |
| `src/cli/build-model.ts` (NEW) | cli entrypoint | file-I/O (corpus → matrix.json) | `src/cli/normalize-corpus.ts` (corpus in → artifact out) | exact |
| `src/cli/run-backtest.ts` (NEW) | cli entrypoint | file-I/O (corpus → paired .md + .json) | `src/cli/run-census.ts` (paired .md + .json report) | exact |
| `src/index.ts` (EXTEND) | barrel | — | `src/index.ts` (existing type+fn re-export blocks) | exact |
| `test/model/matrix.test.ts`, `test/model/predict.test.ts`, `test/eval/backtest.test.ts` (NEW) | test | — | `test/normalize.test.ts` + `test/census.test.ts` | exact |
| `test/fixtures/*.json` (NEW synthetic) | test fixture | — | `test/fixtures/2017-segues.json` + `.meta.json` | exact |

**Key structural fact for the planner:** existing `test/fixtures/*.json` are **raw kglw.net setlist-row arrays**, NOT `NormalizedCorpus`. Scoring/matrix tests must run the fixture through `normalizeCorpus(fixture)` first (see `normalize.test.ts` line 4 + usage), then feed the resulting `NormalizedCorpus` into `buildMatrix`. New synthetic scoring fixtures should follow the same raw-row shape so they normalize through the same boundary.

---

## Pattern Assignments

### `src/domain/types.ts` (EXTEND — add `TransitionMatrix`, `MatrixNode`, `MatrixEdge`, `PredictionCandidate`, `BacktestResult`)

**Analog:** the existing file itself — follow its exact conventions.

**Union-not-enum + doc-comment convention** (`domain/types.ts:9-11, 46-48`):
```typescript
/**
 * Union type (not enum) per erasableSyntaxOnly (CLAUDE.md / tsconfig).
 */
export type TransitionKind = "none" | "segue" | "terminal";
// ...
/** ...Hand-authored literal union (not zod-derived) to keep the domain layer free of ingest-layer schema imports... */
export type SetNumber = "1" | "2" | "e";
```
Any new discriminant (e.g. which backoff tier fired, `"transition" | "tuning" | "albumEra" | "basePlayRate"`) MUST be a string-literal union, NOT an enum — `erasableSyntaxOnly` is compile-enforced.

**Frozen-artifact header convention** (`domain/types.ts:75-87`) — mirror this exactly for the `TransitionMatrix` header (D-08 is "the second frozen contract"):
```typescript
/**
 * The D-08 header — the first frozen contract in the system... `schemaVersion` is
 * bumped only on breaking shape changes; consumers check it before reading `shows`.
 */
export interface NormalizedCorpus {
  schemaVersion: 1;
  generatedAt: string;
  latestShowDate: string;
  showCount: number;
  songCount: number;
  shows: NormalizedShow[];
}
```
Give `TransitionMatrix` the same shape: `schemaVersion: 1`, a `generatedAt`/`asOf` provenance field, counts, then `nodes: MatrixNode[]` + `edges: MatrixEdge[]` (D-08 nodes+edge-list). Per D-10 each `MatrixEdge` carries both `count` (raw int) and `weightedCount` (decayed float) plus `segueCount`, `firstDate`, `lastDate` (M4 needs the dates for the reason string + constellation labels).

**Input types to REUSE (do not redefine):** `NormalizedCorpus`, `NormalizedShow`, `SetSection`, `Performance` (fields `transitionKind`, `isPlaceholder`, `position`, `songId`), `TransitionKind`. Import from `./domain/types.ts`. `Performance.transitionKind === "segue"` is the segue-out signal — see Shared Pattern "Segue direction".

---

### `src/config.ts` (EXTEND — all Phase 2 model constants, D-16)

**Analog:** the existing `config` object — one `as const` object, every constant carries a doc comment citing the deciding requirement/decision.

**Exact shape to extend** (`config.ts:9, 43-68, 82`):
```typescript
export const config = {
  // ... existing keys ...
  /** Pitfall 7 / docs/SCHEMA.md §6: song_id 1 ("Unknown"...) ... excluded from ... transition-edge emission. */
  sentinelSongIds: [1],
  /** ...tour_id 1 = "Not Part of a Tour" sentinel... */
  tourIdSentinel: 1,
  /** The versioned normalized corpus artifact — Phase 2's sole input (D-08). */
  corpusArtifactPath: "data/normalized/corpus.json",
  /** Human-readable census report (D-10). */
  censusReportPath: "data/census-report.md",
  /** Machine-readable census output, paired with censusReportPath (D-10). */
  censusJsonPath: "data/census.json",
} as const;
```

**REUSE (already present, do not re-add):** `sentinelSongIds`, `tourIdSentinel`, `settypeAllowlist`, `corpusArtifactPath`, `dataNormalizedDir`, `cliYearMin`/`cliYearMax`.

**ADD (each with a doc comment naming its decision/seed + `[ASSUMED]` flag per D-16 / RESEARCH M1-M8):**
- `matrixArtifactPath: "data/normalized/transition-matrix.json"` (D-08 output; sibling of `corpusArtifactPath`)
- `backtestReportPath: "data/backtest-report.md"` + `backtestJsonPath: "data/backtest.json"` (D-15 — mirror the `censusReportPath`/`censusJsonPath` pair naming)
- `decayHalfLifeDays: 365` (M2/A2), `transitionAddAlpha: 0.0` (M1)
- `backoffWeights: { w1: 0.6, w2: 0.2, w3: 0.15, w4: 0.05 }` (M1/A1 — sums to 1.0)
- `rotationWindowShows: 3`, `rotationPenaltyPerShow: 0.5` (M3/A4)
- `alreadyPlayedFactor: 0.02` (M3/A3)
- `hardSegueConsistencyThreshold: 0.70`, `hardSegueMinSupport: 3`, `hardSegueOverrideCeiling: 0.97`, `hardSegueBoost: 3.0` (M4/A5)
- `eraWindowShows: 40`, `eraPriorSmoothingK: 1`, `eraPriorFloor: 0.3`, `eraPriorCeil: 2.0` (M8/A6)
- `candidateListSize: 15` (M7/A7)

**Convention:** doc comment style matches the existing `microtonalAlbums` entry (`config.ts:73-81`) — cite the source decision, mark seeds as tunable-via-backtest, "starting default, not authoritative."

---

### `src/model/matrix.ts` (NEW — `buildMatrix(corpus, asOf, config) → TransitionMatrix`)

**Analog:** `src/ingest/census.ts` — a pure module that derives a structured result object from corpus data with zero I/O, exporting `interface` result types + one top-level pure fn.

**Module doc-comment + import convention** (`census.ts:1-16`):
```typescript
/**
 * ...Pure derivation over already-committed ...rows; performs ZERO network requests...
 */
import { config } from "../config.ts";
import { rawSetlistRowCensus, type RawSetlistRow } from "./api-types.ts";
```
Note: `.ts` extension in imports (Node-native TS), `import { config } from "../config.ts"`, and named `type` imports inline.

**Within-set edge emission + placeholder/boundary safety** — this is the load-bearing algorithm (D-07, D-08, D-10). RESEARCH.md supplies the verified shape (`02-RESEARCH.md:291-306`):
```typescript
for (const set of show.sets) {                 // NEVER across sets/encore (D-07)
  const p = set.performances;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1];
    if (a.isPlaceholder || b.isPlaceholder) continue;   // don't bridge Unknown
    const e = edgeFor(a.songId, b.songId);
    e.count += 1;
    e.weightedCount += decayedWeight(show.date, asOf, cfg.decayHalfLifeDays);
    if (a.transitionKind === "segue") e.segueCount += 1; // A's OUT-transition
    e.lastDate = show.date; e.firstDate ??= show.date;
  }
}
```

**Determinism discipline to copy from `census.ts`** (`census.ts:132, 174-175`):
- Sort before serializing: `census.ts` sorts field values (`result.sort((a, b) => String(a.value).localeCompare(...))`) and sorts show rows (`[...showRows].sort((a, b) => a.position - b.position)`). Matrix builder MUST sort nodes by `songId`, edges by `(from, to)`, and accumulate `weightedCount` over instances in fixed `(date, showOrder, position)` order, then round to fixed precision (Pitfall 2).
- Map-based accumulation identical to `census.ts:109-123` `byValue` pattern (`Map` keyed by value, `.get`/create/increment).

**As-of cutoff (D-09 refined by M5):** `buildMatrix` filters shows to strictly before the eval show using an **exclusive `(date, showOrder)` tuple bound**, not `date ≤ cutoff` (same-date shows exist — Pitfall 3). Signature should accept `asOf: { date: string; showOrder: number; inclusive: boolean }` or an equivalent predicate.

**Sentinel exclusion:** reuse `config.sentinelSongIds` exactly as `census.ts:232` does — `const sentinelIds = config.sentinelSongIds as readonly number[];` then `if (sentinelIds.includes(id)) continue;`. (Also filter `settypeAllowlist`/placeholder consistently — corpus is already normalized so placeholders are flagged via `isPlaceholder`.)

---

### `src/model/decay.ts` (NEW — exponential `decayedWeight` helper)

**Analog:** small pure helper fns in `census.ts`; the exact body is given in RESEARCH (`02-RESEARCH.md:267-277`):
```typescript
const MS_PER_DAY = 86_400_000;
function decayedWeight(showDate: string, asOfDate: string, halfLifeDays: number): number {
  const ageDays = (Date.parse(asOfDate) - Date.parse(showDate)) / MS_PER_DAY;
  return Math.exp((-Math.LN2 * ageDays) / halfLifeDays);
}
```
Half-life is relative to the matrix's own `asOf` cutoff, NEVER `Date.now()` (D-10). Round `weightedCount` to fixed precision before serialization (Pitfall 2 determinism).

---

### `src/model/predict.ts` (NEW — `predict(matrix, context, config, toggles) → PredictionCandidate[]`)

**Analog:** `src/ingest/tuning-tags.ts` — a pure module composing several small helper fns into a staged resolution, with a rich structured output per item and no I/O.

**Staged-helper decomposition convention** (`tuning-tags.ts:150-249`): `tuning-tags.ts` decomposes into `findMatchedAlbumTitles` → `defaultFamilyForAlbum` → `resolveFamily` → `generateTuningTags`, each a named pure fn. `predict.ts` should mirror this: `transitionProb` / `tuningAffinity` / `albumEraAffinity` / `basePlayRate` (tiers) → `baseFactor` (D-02 blend) → `rotationSuppression` / `alreadyPlayedFactor` / `eraPrior` / `hardSegueOverride` (multipliers) → `scoreCandidate` → `predict`. RESEARCH Patterns 1 & 2 give the exact signatures (`02-RESEARCH.md:135-141, 153-161`).

**Multiplicative pipeline with per-signal toggles** (D-01 + D-14, `02-RESEARCH.md:148-161`):
```typescript
interface SignalToggles { decay; rotation; alreadyPlayed; eraPrior; hardSegue; tuning; albumEra; }
function scoreCandidate(A, B, m, cfg, t, ctx): Scored {
  const base = baseFactor(A, B, m, cfg, t);
  let s = base;
  s *= t.rotation      ? rotationSuppression(B, ctx, cfg) : 1;
  s *= t.alreadyPlayed ? alreadyPlayedFactor(B, ctx, cfg) : 1;
  s *= t.eraPrior      ? eraPrior(B, m, cfg)              : 1;
  const seg = t.hardSegue ? hardSegueOverride(A, B, m, cfg) : null;
  return applyOverride(s, seg, cfg);   // reason string assembled here (D-06)
}
```
Every downstream signal defaults to `1.0` when its toggle is off so ablation is a flag-flip, not a code fork (M6). Backoff tiers ablate by dropping the tier + **re-normalizing** remaining weights to sum to 1.

**Rich per-candidate output (D-06):** `PredictionCandidate` carries `{ songId, score, factors: { transitionProb, decay, rotation, eraPrior, backoffTier, hardSegueFlag }, reason: string }`. Reason string reads like `"notated segue 14/15 times since 2024"` — built from the edge's stored `segueCount`/`totalExits`/`firstDate` (M4).

**Deterministic ranking tie-break (Pitfall 2):** sort candidates by `score` desc, tie-break `playCount` desc then `songId` asc. (Mirrors `census.ts`/`tuning-tags.ts` explicit-comparator sorting — never rely on Map order.)

**Config access convention:** destructure from the imported `config` object; `config.microtonalAlbums as readonly string[]` at `tuning-tags.ts:177` shows the `as readonly` cast pattern for `as const` array members.

---

### `src/model/index-build.ts` (NEW — `from → edges` in-memory index from the edge list, D-08)

**Analog:** `deriveCatalogFromCorpus` (`tuning-tags.ts:104-125`) — the established "walk the corpus/artifact once, build a `Map`-keyed index, return sorted" pattern:
```typescript
export function deriveCatalogFromCorpus(corpus: NormalizedCorpus): CatalogSong[] {
  const bySongId = new Map<number, CatalogSong>();
  for (const show of corpus.shows)
    for (const set of show.sets)
      for (const performance of set.performances) {
        if (performance.isPlaceholder) continue;
        // ...first-seen wins, OR-accumulate...
      }
  return [...bySongId.values()].sort((a, b) => a.songId - b.songId);
}
```
`index-build.ts` builds `Map<fromSongId, MatrixEdge[]>` (+ node lookup `Map<songId, MatrixNode>`) from the frozen edge list so the predictor has O(1) successor access. Pure, no I/O.

---

### `src/eval/backtest.ts` (NEW — walk-forward + metrics + ablation, EVAL-01/02)

**Analog:** `src/ingest/census.ts` — batch iteration over the corpus producing a single structured `*Result` object with a `derived`-style nested breakdown. Copy the "one exported `interface XResult` + interior sub-interfaces + one top-level pure fn" shape (`census.ts:57-81, 149`):
```typescript
export interface CensusDerived { /* many named breakdown fields */ }
export interface CensusResult { fields: ...; derived: CensusDerived; }
export function runCensus(rowsByFile: Map<string, unknown[]>): CensusResult { /* ... */ }
```
`BacktestResult` should carry per-split hit rates (`top1`/`top5`/`top10` × overall/hardSegue/freeChoice, D-13) plus an `ablation` array of per-signal `{ signal, hitRates, deltaVsFull }` (D-14). This is the diffable `.json` payload.

**Walk-forward loop (M5, D-12):** for each held-out show in `(date, showOrder)` order, call `buildMatrix(corpus, asOf = exclusive tuple just-before S)`, then walk each within-set `A→B`, predict, record hit@k. Reuse the `census.ts` sorted-iteration discipline. Skip eval targets where `B.isPlaceholder`, set-openers (no predecessor), and single-song sets (M7).

**Ablation (M6):** run full backtest once, then re-run per signal with one toggle off — same single scoring code path in `predict.ts`, one flag flipped. Report-only, no go/no-go gate (D-14).

---

### `src/eval/holdout.ts` (NEW — identify most-recent-complete-tour)

**Analog:** pure reducer fns in `census.ts`; RESEARCH gives the verified body (`02-RESEARCH.md:280-289`):
```typescript
function findHoldoutShows(corpus: NormalizedCorpus, tourIdSentinel: number): NormalizedShow[] {
  const latest = corpus.shows.reduce((m, s) =>
    s.date > m.date || (s.date === m.date && s.showOrder > m.showOrder) ? s : m, corpus.shows[0]);
  const tourId = latest.tourId; // 65 "2025 Phantom Island Australia Tour"
  if (tourId === tourIdSentinel) throw new Error(`Latest show is a one-off (tour ${tourIdSentinel}); no complete-tour holdout.`);
  return corpus.shows.filter((s) => s.tourId === tourId); // 9 shows
}
```
Identify holdout by the tour of the **latest-dated show**, NEVER `max(tourId)` (tourId is non-monotonic — Pitfall 3). Use `config.tourIdSentinel`, not a literal. Verified result: tour 65, 9 shows, 2025-12-02…2025-12-13, 154 eval transitions (36 hard-segue / 118 free-choice).

---

### `src/cli/build-model.ts` (NEW — corpus → transition-matrix.json)

**Analog:** `src/cli/normalize-corpus.ts` — the "read corpus → run pure fn → write versioned artifact" thin wrapper (exact structure to copy).

**Full CLI skeleton to copy** (`normalize-corpus.ts:12-17, 79-84, 114-126`):
```typescript
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "../config.ts";
// ...
await mkdir(dirname(options.outPath), { recursive: true });
// Stable 2-space formatting + trailing newline (LF) — makes `git diff` the review mechanism.
await writeFile(options.outPath, `${JSON.stringify(corpus, null, 2)}\n`, "utf8");
// ...
const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await runNormalizeCorpus(options);
    console.log(formatNormalizeSummary(result));
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}
```

**Corpus-loading-from-disk pattern** (`generate-tuning-tags.ts:69`):
```typescript
const corpusRaw = JSON.parse(await readFile(opts.corpusPath, "utf8")) as NormalizedCorpus;
```
Default input `config.corpusArtifactPath`, default output the new `config.matrixArtifactPath`. Write with `JSON.stringify(matrix, null, 2) + "\n"` for a diffable artifact (Pitfall 2). Export `runBuildModel` as a named fn (so `refresh.ts`-style orchestration can import it, not shell out) plus a `format*Summary` helper, exactly as `normalize-corpus.ts` splits `runNormalizeCorpus` + `formatNormalizeSummary`.

**CLI arg validation (Security V5):** if a `--cutoff` date flag is added, validate it against bounds before use, mirroring the `cliYearMin/Max` bounded-integer convention (`config.ts:25-27`); the `parseArgs` + `throw new Error(\`Unknown flag: ${arg}\`)` pattern is at `normalize-corpus.ts:96-112`.

---

### `src/cli/run-backtest.ts` (NEW — corpus → backtest-report.md + backtest.json)

**Analog:** `src/cli/run-census.ts` — the canonical paired `.md` + `.json` report emitter (D-15 explicitly says mirror this).

**Paired-write + report-format skeleton to copy** (`run-census.ts:186-203`):
```typescript
export async function runCensusCli(options = {}): Promise<RunCensusCliResult> {
  const jsonOutPath = options.jsonOutPath ?? config.censusJsonPath;
  const reportOutPath = options.reportOutPath ?? config.censusReportPath;
  // ...
  await mkdir(dirname(jsonOutPath), { recursive: true });
  await writeFile(jsonOutPath, `${JSON.stringify(census, null, 2)}\n`, "utf8");
  await mkdir(dirname(reportOutPath), { recursive: true });
  await writeFile(reportOutPath, formatReport(census, filesRead), "utf8");
  return { census, filesRead };
}
```
Use the new `config.backtestJsonPath` / `config.backtestReportPath`. `formatReport` builds a `sections: string[]` array joined with `\n\n` and a trailing `\n` (`run-census.ts:78-183`); markdown tables via `["| Col | ... |", "|---|---|", ...rows].join("\n")` (`run-census.ts:69-76, 100-107`). Print the `.md` to stdout and write it to the committed report file.

**MANDATORY security control — markdown escaping** (`run-census.ts:65-67`, threat T-01-03/F1, re-flagged in RESEARCH Security Domain):
```typescript
function escapeMarkdownExcerpt(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
```
The backtest `.md` embeds song names + reason strings (D-06) — any editor/catalog-sourced text interpolated into a table cell MUST pass through `escapeMarkdownExcerpt` (defense-in-depth; markdown viewers render embedded HTML). See usage at `run-census.ts:175`.

**`isMain` guard + try/catch/`process.exit(1)`** identical to `run-census.ts:214-229` and `normalize-corpus.ts:114-126`.

---

### `src/index.ts` (EXTEND — barrel export)

**Analog:** the existing barrel — grouped `export type { ... } from "./..."` and `export { fn, type X } from "./..."` blocks with a comment explaining what stays behind the anti-corruption boundary (`index.ts:1-41`).

Add the new domain types (`TransitionMatrix`, `MatrixNode`, `MatrixEdge`, `PredictionCandidate`, `BacktestResult`) and pure fns (`buildMatrix`, `predict`, `backtest`, `findHoldoutShows`, index-build helpers). Do NOT export CLI internals or raw ingest types — same boundary discipline the current barrel enforces (`index.ts:1-7`).

---

### `test/model/*.test.ts`, `test/eval/backtest.test.ts` (NEW)

**Analog:** `test/normalize.test.ts` + `test/census.test.ts`.

**Import + fixture-normalize convention** (`normalize.test.ts:1-16`):
```typescript
import { describe, expect, it } from "vitest";
import { normalizeCorpus } from "../src/ingest/normalize.ts";
import fixture2017Segues from "./fixtures/2017-segues.json" with { type: "json" };
import fixture2025Sandwich from "./fixtures/2025-sandwich.json" with { type: "json" };
```
Note the `with { type: "json" }` import attribute and the relative `../src/...ts` path. Matrix/predict tests normalize a raw fixture first, then build: `const { corpus } = normalizeCorpus(fixture2017Segues);` then `const matrix = buildMatrix(corpus, asOf, config);`.

**Fixture reuse map (from RESEARCH Wave 0):**
- boundary exclusion (D-07): `2013-encore.json`, `2022-rr1010-multiset.json`
- hard-segue (D-04/MODL-05): `2017-segues.json`, `2025-segue-chain.json`
- already-played (D-05/MODL-10): `2025-sandwich.json`
- as-of leak-safety (D-09): NEW tiny 2-cutoff synthetic fixture
- backtest (EVAL-01/02): NEW small synthetic multi-tour fixture with a known holdout + hand-computed top-k

**`describe`/`it` naming + numbered-assertion convention** (`census.test.ts:13-25`, `normalize.test.ts:25-45`): `describe("buildMatrix — <fixture desc>", () => { const { corpus } = normalizeCorpus(...); it("Test N: <specific expected output>", () => { expect(...).toBe(...) }) })` — assert concrete known values, matching `census.test.ts`'s exact-count assertions.

**NEW synthetic fixture pairing** — each `test/fixtures/<name>.json` (raw-row array) MUST ship a `<name>.meta.json` sidecar recording `sourceFile`/`showId`/`showdate`/`why` (`2017-segues.meta.json` is the template). Synthetic (hand-authored) fixtures note that in `why` and give the hand-computed expected score/top-k so the test is self-documenting (D-17).

**Determinism test (Pitfall 2):** assert `buildMatrix` output and `backtest.json` are byte-stable across two runs (mirrors the Phase-1 "survives regeneration byte-for-byte" test discipline).

---

## Shared Patterns

### Segue direction (CORRECTNESS-CRITICAL)
**Source:** `domain/types.ts:24` (`transitionKind` is the OUT-transition of a performance) + `normalize.test.ts:47-66` (verifies pos-1 "Mars For the Rich" `transition_id 2 → segue`).
**Apply to:** `model/matrix.ts` (segueCount accumulation), `model/predict.ts` (hardSegueOverride), `eval/backtest.ts` (split criterion).
Edge `A→B` is a hard segue **iff `A.transitionKind === "segue"`** — the kind lives on the earlier performance (A's row), never B's. Inverting this silently zeroes the entire hard-segue signal (RESEARCH Pitfall 1). Add a fixture assertion using `2017-segues` (which already asserts segue-kind on the earlier position).

### Config as single source of truth (MODL-11)
**Source:** `config.ts:1-8` (module doc), used via `import { config } from "../config.ts"` in every module (`census.ts:14`, `tuning-tags.ts:21`, `normalize-corpus.ts:15`).
**Apply to:** every new `model/`, `eval/`, `cli/` file. No numeric literal for any model constant may appear outside `config.ts`. Read `config.microtonalAlbums as readonly string[]` (`tuning-tags.ts:177`) shows the `as readonly` cast for `as const` array members.

### Anti-corruption input boundary
**Source:** `index.ts:1-7` (raw kglw.net types never re-exported); `generate-tuning-tags.ts:69` (corpus read as `NormalizedCorpus`).
**Apply to:** all Phase 2 code reads `data/normalized/corpus.json` via the `NormalizedCorpus` type ONLY — never a raw setlist row, never a raw kglw.net field name. Tests reach raw rows only through `normalizeCorpus(fixture)`.

### Deterministic / diffable artifact discipline (Pitfall 2)
**Source:** `normalize-corpus.ts:80-81` + `run-census.ts:197` (`JSON.stringify(x, null, 2) + "\n"`); `census.ts:132, 174-175` (explicit `.sort` comparators; sorted iteration).
**Apply to:** `matrix.ts`, `backtest.ts`, and both CLIs. Sort nodes/edges by stable keys; accumulate floats in fixed `(date, showOrder, position)` order; round `weightedCount` to fixed precision; deterministic candidate tie-break (`playCount` desc, `songId` asc). Serialize with 2-space + trailing newline so `git diff` is the review surface.

### Node-CLI wrapper shape
**Source:** `normalize-corpus.ts` + `run-census.ts` (both): `import { config }` → exported `run*` fn (importable, no shelling out) → `format*Summary`/`formatReport` → `parseArgs` with `throw new Error(\`Unknown flag\`)` → `const isMain = ... import.meta.url === pathToFileURL(process.argv[1]).href` → `try { ... } catch (err) { console.error((err as Error).message); process.exit(1); }`.
**Apply to:** `build-model.ts`, `run-backtest.ts`. Error-message convention: throw plain `Error` with a specific, loud message (e.g. `run-census.ts:39-40, 209`; `holdout.ts` sentinel throw in RESEARCH:286) — fail loudly rather than emit a corrupt artifact (Security DoS control).

### Markdown output escaping (Security V5/V12)
**Source:** `run-census.ts:65-67` `escapeMarkdownExcerpt`, applied at `run-census.ts:175`.
**Apply to:** `run-backtest.ts` — every song name / reason string written into the `.md` report.

### zod validation for loaded files (optional, if adding a matrix-artifact header schema)
**Source:** `tuning-tags.ts:28-63` (`z.strictObject`, `z.literal(1)` schemaVersion, custom `error`/`superRefine` messages) + `generate-tuning-tags.ts:100-103` (validate the final shape before writing so a bug hard-fails).
**Apply to:** if the plan adds a `transitionMatrixSchema` header validation or re-parses `tuning-tags.json`, reuse `z.strictObject` + `schemaVersion: z.literal(1)` and validate-before-write.

---

## No Analog Found

None. Every file maps to a Phase 1 analog. The only genuinely novel content is the **scoring arithmetic itself** (`baseFactor` blend, decay, rotation, hard-segue gating, era-prior) — which has no code analog but is fully specified as pure math in `02-RESEARCH.md` M1-M8 + Patterns 1-2. The planner should treat those RESEARCH sections as the "analog" for the math bodies and the Phase 1 files above as the analog for structure, style, and I/O.

## Metadata

**Analog search scope:** `packages/core/src/{cli,ingest,domain,config.ts,index.ts}`, `packages/core/test/{*.test.ts,fixtures/*}`, `packages/core/package.json`
**Files scanned (read in full or targeted):** `cli/run-census.ts`, `cli/normalize-corpus.ts`, `cli/generate-tuning-tags.ts`, `ingest/census.ts`, `ingest/tuning-tags.ts`, `domain/types.ts`, `config.ts`, `index.ts`, `test/normalize.test.ts`, `test/census.test.ts`, `test/fixtures/2017-segues.{json,meta.json}`
**Pattern extraction date:** 2026-07-08

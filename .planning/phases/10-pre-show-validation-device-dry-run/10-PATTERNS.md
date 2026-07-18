# Phase 10: Pre-Show Validation & Device Dry-Run - Pattern Map

**Mapped:** 2026-07-18
**Files analyzed:** 5 (1 new CLI, 1 optional generated artifact, 1 evidence doc, 1 possibly-edited data file, 3 re-run artifacts)
**Analogs found:** 5 / 5 (all strong)

> This is a validation/dry-run gate. It creates almost no new code. The only genuinely
> new source artifact is a **read-only VALID-01 tuning-review report** (a CLI and/or a
> generated markdown file). Everything else is either an evidence doc (`10-HUMAN-UAT.md`),
> a hand-edit to committed data (only if the sweep finds a real error), or a re-run of
> existing CLIs. No existing source is modified.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/core/src/cli/review-tuning-tags.ts` (NEW) | cli / utility | transform / batch (read-only) | `packages/core/src/cli/generate-tuning-tags.ts` | exact (role + read path) |
| `data/tuning-review.md` (NEW, optional artifact) | report output | transform | `data/backtest-report.md` via `run-backtest.ts` | role-match |
| `.planning/.../10-HUMAN-UAT.md` (NEW) | evidence doc | n/a | `05-HUMAN-UAT.md` / `01-HUMAN-UAT.md` | exact |
| `data/tuning-tags.json` (MODIFIED, only if D-03 fires) | config / data | file-I/O | itself + `tuning-tags.ts` schema | exact |
| `data/normalized/transition-matrix.json`, `data/backtest.json`, `data/backtest-report.md` (RE-GENERATED, only if D-03 fires) | build artifacts | batch | `build-model.ts` / `run-backtest.ts` (unchanged, just re-run) | exact |

## Pattern Assignments

### `packages/core/src/cli/review-tuning-tags.ts` (cli, read-only transform) — the primary new artifact

**Analogs:**
- `packages/core/src/cli/generate-tuning-tags.ts` — how to load corpus + albums + existing tags and reuse the pure `deriveCatalogFromCorpus`/schema helpers (copy the load half, **omit** the merge/write half — this CLI is read-only per D-01).
- `packages/core/src/cli/run-backtest.ts` — the `.md` report-string builder + stdout-print convention (copy `sections: string[]`, `escapeMarkdownExcerpt`, table formatters).
- `packages/core/src/cli/build-model.ts` — the `loadTuningFamilyBySongId` zod-validated-load helper and `parseArgs`/`isMain` scaffold.

**File header / CLI-purpose docblock pattern** (`generate-tuning-tags.ts` lines 1-10) — every core CLI opens with a docblock naming the decision refs and the "never invoked from CI" etiquette note. The new file must state it is **read-only** (writes nothing to `data/tuning-tags.json`):
```typescript
/**
 * Thin CLI wrapper (DATA-04, D-01/D-02) around the pure tuning-tags helpers:
 * read the committed normalized corpus + albums.json + data/tuning-tags.json,
 * cross-check the ~10 canonical well-known songs (expected vs actual family)
 * and surface cs-standard/other + standard/microtonal anomaly candidates for
 * owner eyeballing. READ-ONLY: never writes tuning-tags.json (D-01 — the
 * append-only merge already preserves the 52 hand-edits, needsReview is 0).
 * Never invoked from CI (CLAUDE.md: manual-run only).
 */
```

**Imports pattern** (`generate-tuning-tags.ts` lines 11-25) — Node-native `.ts` extensions, `config` from `../config.ts`, pure helpers from `../ingest/tuning-tags.ts`:
```typescript
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { config } from "../config.ts";
import type { NormalizedCorpus } from "../domain/types.ts";
import {
  albumRowSchema,
  deriveCatalogFromCorpus,
  tuningTagsFileSchema,
  tuningFamilyValues,
  type AlbumRow,
  type TuningFamily,
  type TuningTagsFile,
} from "../ingest/tuning-tags.ts";
```
Note: import `deriveCatalogFromCorpus` and `tuningTagsFileSchema` — reuse, do NOT re-parse. Do NOT import `mergeTuningTags`/`generateTuningTags` (that would be the write path this CLI must avoid).

**Corpus + albums + tags load pattern** (`generate-tuning-tags.ts` lines 64-95) — copy the load block verbatim, drop the merge/write:
```typescript
const corpusRaw = JSON.parse(await readFile(opts.corpusPath, "utf8")) as NormalizedCorpus;
const albumsParsed: unknown = JSON.parse(await readFile(opts.albumsPath, "utf8"));
const allAlbumRows: AlbumRow[] = z
  .array(albumRowSchema)
  .parse(extractRows(albumsParsed, opts.albumsPath));
const kglwAlbumRows = allAlbumRows.filter((row) => row.artist_id === 1);

// zod-validate the committed tags file on load (build-model.ts lines 52-62 pattern)
const existingRaw = await readFile(opts.tagsPath, "utf8");
const tagsFile: TuningTagsFile = tuningTagsFileSchema.parse(JSON.parse(existingRaw));
const familyBySongId = new Map(tagsFile.entries.map((e) => [e.songId, e.family]));

const catalog = deriveCatalogFromCorpus(corpusRaw);
```
Also copy `extractRows` (lines 38-54) verbatim — it tolerates both the bare-array and `{ data: [...] }` envelope shapes of committed data. Copy `defaultOptions()` (lines 56-62) using `config.corpusArtifactPath`, `join(config.dataRawDir, "albums.json")`, `config.tuningTagsPath`.

**The read-only "run + format" split** (`generate-tuning-tags.ts` lines 64-118, `run-backtest.ts` lines 114-138) — every CLI exports a pure `runX(): Promise<Result>` plus a `formatXSummary(result): string`, then an `isMain` block calls them. Mirror this so the review logic is unit-testable in `node` env:
```typescript
export interface ReviewTuningTagsCliResult {
  spotChecks: { songId: number; name: string; expected: TuningFamily; actual: TuningFamily; ok: boolean }[];
  anomalies: { songId: number; name: string; actual: TuningFamily; reason: string }[];
}

export async function runReviewTuningTags(
  options: Partial<ReviewTuningTagsCliOptions> = {},
): Promise<ReviewTuningTagsCliResult> { /* load (above) + heuristics (below) */ }
```

**Canonical spot-check anchors** (from `01-HUMAN-UAT.md` line 16 + CONTEXT specifics) — seed the ~10-song expected-vs-actual list with the Phase 01 anchors ("Doom City" → `microtonal`, "12 Bar Bruise" → `standard`). Match by name against `catalog`/`tagsFile`.

**cs-standard / other anomaly heuristics (D-02)** — the album-default logic in `tuning-tags.ts` NEVER emits `cs-standard` or `other` (see `defaultFamilyForAlbum` lines 176-180: only `standard`/`microtonal`). So the sweep must nominate candidates the auto-logic is blind to. Reference the closed vocabulary constant and the album-seed config:
```typescript
// tuning-tags.ts line 25 — the closed 4-value family vocabulary
export const tuningFamilyValues = ["standard", "cs-standard", "microtonal", "other"] as const;
// config.ts line 90 — microtonal-seed albums (only source of a non-standard auto-default)
microtonalAlbums: ["Flying Microtonal Banana", "K.G.", "L.W."],
```
Heuristic surface (planner/researcher tunes the exact list): flag songs whose album/era signals suggest down-tuning (`cs-standard`) or non-Western/experimental tunings (`other`) but which currently carry the `standard`/`microtonal` album default and `source: "album-default"` (never hand-confirmed). Entries with `source: "hand-tagged"` are already owner-confirmed and can be reported as "already reviewed."

**Markdown report builder** (`run-backtest.ts` lines 91-112, 41-43) — if producing `data/tuning-review.md`, copy the `sections: string[]` join-with-blank-line + trailing-newline convention and the `escapeMarkdownExcerpt` helper (song names are catalog-sourced prose — a markdown injection surface, T-01-03):
```typescript
function escapeMarkdownExcerpt(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
export function formatReviewReport(result: ReviewTuningTagsCliResult): string {
  const sections: string[] = [];
  sections.push(`# Tuning-Family Review (VALID-01)\n\n...`);
  sections.push(`## Canonical spot-check\n\n${/* table */}`);
  sections.push(`## Anomaly sweep — cs-standard / other candidates\n\n${/* table */}`);
  return `${sections.join("\n\n")}\n`;
}
```

**`isMain` execution guard + error handling** (`generate-tuning-tags.ts` lines 120-131, identical in all three CLIs) — copy verbatim:
```typescript
const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  try {
    const result = await runReviewTuningTags();
    console.log(formatReviewSummary(result));
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}
```

**Arg parsing (if any flags needed, e.g. `--out`)** — copy `run-backtest.ts` `parseArgs` lines 140-153 (linear loop, `throw new Error(\`Unknown flag: ${arg}\`)` on unknown). Keep it minimal; this CLI likely needs no flags beyond an optional `--out`.

---

### `data/tuning-tags.json` (config/data) — MODIFIED only if the sweep finds a genuine error (D-03)

**Analog:** the file itself + `tuning-tags.ts` schema (lines 28-63).

**Edit shape** — each entry is the `tuningTagEntrySchema` object (`tuning-tags.ts` lines 28-37). A hand-fix flips `family` to one of the closed vocabulary values and sets `source: "hand-tagged"`:
```json
{ "songId": 42, "name": "Some Song", "family": "cs-standard", "needsReview": false, "source": "hand-tagged" }
```
Constraints the edit MUST satisfy (enforced by zod on next `build-model` load): `family` ∈ `standard | cs-standard | microtonal | other` (line 31-34), no duplicate `songId` (superRefine lines 48-60), object is `strictObject` (no extra keys). Stable 2-space formatting + trailing newline (matches `writeFile(..., JSON.stringify(file, null, 2) + "\n")`, `generate-tuning-tags.ts` line 106) so `git diff` stays the review mechanism.

**Rebuild-and-verify path (D-03)** — after any edit, re-run the existing CLIs (NO new code): `build-model` reloads tags via `loadTuningFamilyBySongId` (`build-model.ts` lines 52-68) → rewrites `transition-matrix.json`; then `run-backtest` regenerates `backtest.json` + `backtest-report.md`. Compare the new `data/backtest-report.md` top-k table against the committed baseline for no-regression before declaring VALID-01 done. If the sweep finds nothing (likely), skip all of this — VALID-01 is confirmation-only.

---

### `.planning/phases/10-.../10-HUMAN-UAT.md` (evidence doc) — NEW

**Analog:** `05-HUMAN-UAT.md` (multi-step loop, closest to VALID-02) and `01-HUMAN-UAT.md` (the tuning spot-check this re-confirms).

**Front-matter + section skeleton** (`05-HUMAN-UAT.md` lines 1-37) — copy verbatim, adjust phase:
```markdown
---
status: complete
phase: 10-pre-show-validation-device-dry-run
source: [10-VERIFICATION.md]
started: <ISO>
updated: <ISO>
---

## Current Test
[all tests complete]

## Tests

### 1. <title>
expected: <what to do + expected result>
result: <pass/fail + on-device evidence note>

## Summary
total: N
passed: N
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
none
```

**Per D-08**, enumerate VALID-01 (spot-check + sweep result) and VALID-02 as discrete numbered steps: start → predictions → log hits/misses → set break → encore → End Show → recap → dex credit → **offline leg (D-05)** → JSON export/import round-trip. The `05-HUMAN-UAT.md` `result:` lines show the expected evidence style (on-device, iPhone, over the cloudflared HTTPS tunnel, found+fixed notes inline). Mark the Android criterion "no device available / waived" per D-06.

## Shared Patterns

### Node-native core CLI scaffold
**Source:** `packages/core/src/cli/generate-tuning-tags.ts` (lines 11-25 imports, 120-131 isMain), identical across `run-backtest.ts` and `build-model.ts`.
**Apply to:** the new `review-tuning-tags.ts`.
- `.ts` import extensions (Node 24.12 type-stripping); `config` from `../config.ts`.
- Exported pure `runX()` + `formatXSummary()` split; thin `isMain` block that try/catches and `process.exit(1)` on error.
- Never CI-invoked; manual run via `node packages/core/src/cli/review-tuning-tags.ts`.

### zod-validated file load (fail loud)
**Source:** `build-model.ts` lines 52-62 (`loadTuningFamilyBySongId`), `generate-tuning-tags.ts` lines 83-91.
**Apply to:** loading `tuning-tags.json` in the review CLI.
```typescript
const raw = await readFile(tagsPath, "utf8");
const file = tuningTagsFileSchema.parse(JSON.parse(raw)); // corrupt hand-edit hard-fails here
```
A corrupt hand-edit made during D-03 fixing surfaces at parse time, not silently downstream.

### Markdown report emission (escape + sections + trailing newline)
**Source:** `run-backtest.ts` lines 41-43 (`escapeMarkdownExcerpt`), 91-112 (`sections: string[]` builder), 128-135 (write + stdout print).
**Apply to:** the optional `data/tuning-review.md` artifact.
- Escape all catalog-sourced song names before embedding (`&`/`<`/`>`) — markdown injection surface.
- Build `sections`, `join("\n\n")`, append trailing `\n`.
- Write with `JSON`/text stable formatting AND `console.log` the report so the owner sees results immediately.

## No Analog Found

None. Every Phase 10 artifact has a strong in-repo analog (the phase deliberately reuses existing CLI/data/evidence conventions). Planner does not need to fall back to RESEARCH.md patterns (none exists for this phase anyway).

## Metadata

**Analog search scope:** `packages/core/src/cli/`, `packages/core/src/ingest/`, `packages/core/src/config.ts`, `data/`, `.planning/phases/*/NN-HUMAN-UAT.md`
**Files scanned:** ~8
**Pattern extraction date:** 2026-07-18

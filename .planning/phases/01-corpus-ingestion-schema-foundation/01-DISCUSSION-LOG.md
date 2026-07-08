# Phase 1: Corpus Ingestion & Schema Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-08
**Phase:** 1-Corpus Ingestion & Schema Foundation
**Areas discussed:** Tuning-family tagging workflow, Refresh script & corpus storage, Schema doc form & unknowns, Covers & special-song policy

---

## Tuning-family tagging workflow

### File format

| Option | Description | Selected |
|--------|-------------|----------|
| JSON (Recommended) | One object per song: name, album-derived default, blank/confirm field; zod-validated on load; no CSV edge cases | ✓ |
| CSV | Spreadsheet-friendly column fill; needs parser and escaping care | |
| You decide | Claude picks for simplest editing + validation | |

### Default assignment

| Option | Description | Selected |
|--------|-------------|----------|
| Default + confidence flag (Recommended) | Best-guess default for every song plus 'needs review' flag on ambiguous album mappings; owner checks only flagged subset | ✓ |
| Default everything silently | Best-guess for all, no flags; requires reviewing all 250 rows | |
| Only obvious ones | Defaults only from unambiguous single-tuning albums; rest blank | |

### Vocabulary

| Option | Description | Selected |
|--------|-------------|----------|
| 3 families + 'other' (Recommended) | standard, cs-standard, microtonal, other; backoff treats 'other' as its own family | ✓ |
| Strict 3 families only | Force every song into three; guessing on oddballs | |
| Extensible list | File carries its own family list; model must handle arbitrary families | |

### Regeneration behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Merge: append new only (Recommended) | Existing entries preserved verbatim; new songs appended with defaults + flag; summary printed | ✓ |
| Never regenerate | One-shot generation; new songs added by hand | |
| Regenerate + git diff | Full rewrite each run; git protects hand-edits | |

---

## Refresh script & corpus storage

### Fetch strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Incremental by year (Recommended) | Per-year raw storage; refresh refetches only current year (plus named years) | ✓ |
| Full refetch every time | Simplest, immune to edit-history drift, but hammers volunteer API | |
| Incremental + occasional full | Incremental default plus --full flag for retroactive editor corrections | |

### What's committed

| Option | Description | Selected |
|--------|-------------|----------|
| Both raw + normalized (Recommended) | Raw per-year JSON = offline source of truth; normalized = what consumers use | ✓ |
| Raw only | Normalized derived at build time; every checkout must run normalizer | |
| Normalized only | Smallest repo but re-normalizing means re-hitting the API | |

### Pacing

| Option | Description | Selected |
|--------|-------------|----------|
| ~2s delay, sequential (Recommended) | One request at a time, ~2s courtesy delay, descriptive User-Agent, no auto-retries | ✓ |
| 1 req/s | Faster, still sequential | |
| You decide | Claude picks based on final request count | |

### Artifact versioning

| Option | Description | Selected |
|--------|-------------|----------|
| Schema ver + snapshot date (Recommended) | Embedded header: schemaVersion + generatedAt + latest-show-date + counts | ✓ |
| Content hash | Cache-busting identity, no human-useful freshness info | |
| Git is the version | No embedded metadata; app can't report data freshness | |

---

## Schema doc form & unknowns

### Documentation form

| Option | Description | Selected |
|--------|-------------|----------|
| Markdown + zod pair (Recommended) | SCHEMA.md explains 'why'; zod schemas enforce 'what'; drift caught on every ingest | ✓ |
| Zod schemas only | Single source of truth but prose knowledge doesn't fit in a schema | |
| Markdown doc only | Satisfies DATA-01 literally; nothing mechanically ties code to doc | |

### Resolving open unknowns

| Option | Description | Selected |
|--------|-------------|----------|
| Census report script (Recommended) | Ingest emits distinct values of enum-ish fields with counts + example show IDs; unknowns resolved with evidence before normalizer finalized | ✓ |
| Strict zod, fail on surprise | Novel values fail loudly one at a time; whack-a-mole first ingest | |
| Log warnings, keep going | Fast but unknowns can slip into the matrix unexamined | |

### Drift posture after census

| Option | Description | Selected |
|--------|-------------|----------|
| Strict enums, hard fail (Recommended) | Novel value fails refresh with message naming field, value, example show | ✓ |
| Fail structure, warn vocabulary | Structural changes fail; novel enum values quarantined with report | |
| You decide | Per-field strictness based on matrix impact | |

### Filter validation (DATA-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Post-fetch assertion (Recommended) | Every returned row asserted to match the requested filter; mismatch hard-fails | ✓ |
| Assertion + count cross-check | Adds count comparison; extra requests against volunteer API | |
| Centralized fetch wrapper | One fetch function with structured filters and internal assertion | |

---

## Covers & special-song policy

### Covers

| Option | Description | Selected |
|--------|-------------|----------|
| Include, flagged isCover (Recommended) | Normal catalog songs with a flag; transitions intact; Phase 2 decides weighting; dex can badge | ✓ |
| Exclude from catalog | Fabricates false adjacencies; forfeits dex credit | |
| Include, no flag | Simplest but loses downstream options | |

### Sandwiches/reprises

| Option | Description | Selected |
|--------|-------------|----------|
| Positional occurrences (Recommended) | Each appearance its own entry in position order; no inference; repeats detectable as duplicate song IDs | ✓ |
| Detect + link occurrences | Builds inference on unreliable isreprise field | |
| You decide | Based on Phase 2 consumption | |

### Teases/footnotes

| Option | Description | Selected |
|--------|-------------|----------|
| Carry through, unused (Recommended) | Footnote text preserved verbatim, never emits transitions; v2 raw material without re-ingest | ✓ |
| Drop entirely | Cleanest types; v2 tease work requires re-ingest | |
| Parse into structured teases | Premature — notation format unknown pending census | |

### Corpus show scope

| Option | Description | Selected |
|--------|-------------|----------|
| Proper live shows only (Recommended) | Explicit allowlist informed by census; soundchecks/radio sessions excluded | ✓ |
| Everything artist_id 1 | Defers filtering to Phase 2; risks never being done | |
| Include + flag, filter in Phase 2 | showKind flag with downstream gate | |

---

## Claude's Discretion

- Exact file locations in the workspace (SCHEMA.md, data/ raw files, tagging file, normalized artifact)
- Workspace scaffolding details
- Census report output format
- Fixture-test structure

## Deferred Ideas

None — discussion stayed within phase scope.

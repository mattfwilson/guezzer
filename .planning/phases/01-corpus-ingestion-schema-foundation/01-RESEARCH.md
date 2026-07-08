# Phase 1: Corpus Ingestion & Schema Foundation - Research

**Researched:** 2026-07-08
**Domain:** Build-time data pipeline (kglw.net API ingestion, zod validation, Node CLI, pnpm workspace scaffolding)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Tuning-family tagging file (DATA-04)
- **D-01:** Format is JSON — one object per song with name, album-derived default family, and a confirm/review field. Zod-validated on load like everything else at the ingestion boundary.
- **D-02:** Every song gets a best-guess default plus a `needsReview` flag when the album mapping is ambiguous (multi-album, live-only, mixed album). The owner hand-checks only the flagged subset, not all ~250 songs.
- **D-03:** Vocabulary is exactly four values: `standard`, `cs-standard`, `microtonal`, `other`. `other` is an honest bucket for songs that don't fit; the Phase 2 backoff treats it as its own family. Not extensible.
- **D-04:** Regeneration is an append-only merge: existing entries are preserved verbatim, only newly-seen songs are appended (with defaults + review flag), and a summary prints what was added. Hand-edits are never overwritten.

#### Refresh script & corpus storage (DATA-02)
- **D-05:** Fetching is incremental by year: raw corpus stored per-year; refresh refetches only the current year plus any year explicitly named. The frozen 2010–2024 history is not re-pulled on routine refreshes.
- **D-06:** Both raw per-year API responses AND the normalized artifact are committed to the repo. Raw is the offline source of truth (normalizer can be rewritten and re-run with zero API traffic); normalized is what Phase 2 and the app consume.
- **D-07:** Fetch pacing: strictly sequential, ~2-second courtesy delay between requests, descriptive User-Agent (project name + owner contact), no automatic retries on error.
- **D-08:** The normalized artifact carries an embedded header: `schemaVersion` (bumped on breaking shape changes, checked by consumers), `generatedAt`, latest-show-date, and show/song counts. The UI can later display "data through YYYY-MM-DD".

#### Schema documentation & unknowns (DATA-01)
- **D-09:** Schema knowledge lives as a pair: a standalone `SCHEMA.md` (field meanings, `transition_id` vocabulary, gotchas, real response excerpts — the "why") plus zod schemas in `core/ingest` encoding it executably (the "what"). Zod validates every ingest run, so doc/code drift is caught mechanically.
- **D-10:** Open unknowns (multi-set `setnumber` values, `transition_id: 4`, tease notation location, `settype` variants) are resolved via a census report: the full-corpus ingest emits every distinct value of enum-ish fields with counts and example show IDs. SCHEMA.md unknowns get resolved with evidence BEFORE the normalizer is finalized.
- **D-11:** After the census locks the vocabulary, zod uses strict enums that hard-fail on future refreshes: a novel value fails with a clear message naming the field, value, and an example show. Schema drift on the volunteer API must fail loudly, never silently corrupt.
- **D-12:** DATA-03 filter validation is a post-fetch assertion: after every filtered fetch, every returned row is asserted to match the requested filter (all `artist_id === 1`, all `showyear === requested`, etc.). Mismatch = hard fail naming the endpoint and filter.

#### Covers & special-song policy (normalizer semantics)
- **D-13:** Covers are included as normal catalog songs with an `isCover` flag. Transitions through them stay intact (excluding them would fabricate false adjacencies). Phase 2 decides weighting; the dex can badge them.
- **D-14:** Sandwiches/reprises are plain positional occurrences: each appearance is its own setlist entry in position order; transitions read off adjacent positions with no inference. No reprise detection/linking — the API's `isreprise` is unreliable. Repeats are detectable downstream as duplicate song IDs within a show (what MODL-10 needs).
- **D-15:** Teases/footnotes are carried through verbatim on setlist entries but never emit transitions. v2 tease-awareness (MODL-V2-03) gets its raw material without a re-ingest.
- **D-16:** Corpus scope is proper live shows only: standard live concerts included; soundchecks, radio sessions, and other non-show `settype` variants excluded via an explicit allowlist informed by the census. A radio session's song choices would pollute rotation and transition signals.

### Claude's Discretion
- Exact file locations within the workspace (where `SCHEMA.md`, `data/` raw files, the tagging file, and the normalized artifact live), workspace scaffolding details, census report output format, and fixture-test structure — all Claude's call, consistent with the locked stack (pnpm workspace, Node ≥24.12 native TS, `erasableSyntaxOnly`, zod at the boundary).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | Empirical schema documentation from real endpoint samples (field names, ordering, `transition_id` vocabulary, set/encore delimiting, covers/teases, multi-set representation) before any extraction code | "Verified Schema Facts" section below resolves multi-set representation and `transition_id: 4` from salvaged samples; full field-type census table provided; SCHEMA.md + zod pairing per D-09; census CLI design per D-10 |
| DATA-02 | One-command refresh script fetches full historical corpus, writes versioned static JSON artifact bundled with repo | Fetch strategy (per-year `showyear` filter empirically validated), pacing per D-07, artifact header per D-08, file layout in Recommended Project Structure; Node ≥24.12 native TS execution verified on this machine |
| DATA-03 | Every ingestion path filters `artist_id === 1` and validates filtered responses actually match the requested filter | Silent-filter-ignore gotcha confirmed in prior research; post-fetch assertion pattern (D-12) with code example; NOTE: `songs.json` has no `artist_id` — KGLW catalog must derive from setlist rows |
| DATA-04 | Tuning-family tagging file with album-derived defaults for ~250 songs | `albums.json` join strategy (no `song_id` — join via slug from `song_url`); microtonal album seed map ([ASSUMED], owner reviews via `needsReview`); append-only merge per D-04 |
</phase_requirements>

## Summary

This phase is a build-time Node data pipeline with zero UI — and its two salvaged API samples (`rr1010.json`, `showyear2013.json`, currently untracked at repo root) turn out to resolve the two biggest open schema questions **before the phase even starts**: multi-set shows use `setnumber: "2"` (string), and `transition_id: 4` is observed in the wild as a set-break terminal marker. More importantly, the 2013 sample proves that **terminal transition IDs are unreliable across eras** (11 of 26 shows in 2013 end with `transition_id: 1`, a "normal break"), which hardens the already-locked rule: set membership comes from `setnumber` grouping, never from `transition_id`. The 2013 sample also surfaces the exact `settype` exclusion case D-16 anticipated (`"Live Session"` at PBS Studios — a radio session), a double-JSON-encoded `footnotes` field, and a sentinel "Unknown" song (`song_id: 1`, slug `_custom_`) that must be handled explicitly.

The stack is fully locked by CLAUDE.md and prior verified research: TypeScript 6.0.3, zod 4.4.3, Vitest 4.1.10, pnpm two-package workspace, Node ≥24.12 native TS execution with `erasableSyntaxOnly`. All Phase-1 packages passed the npm-registry legitimacy gate (slopcheck + `npm view` with official source repos, no postinstall scripts). The one environment gap: **pnpm is not installed** on this machine, but corepack 0.34.6 is available (`corepack enable pnpm`), with npm workspaces as the CLAUDE.md-sanctioned fallback. Node 24.15.0 satisfies the ≥24.12 requirement.

The critical sequencing insight for the planner: zod enum strictness must be **two-stage**. The census (D-10) must run over the full corpus with structurally-strict but enum-loose schemas first; only after the census locks the vocabulary do the schemas get strict enums that hard-fail on novel values (D-11). Writing strict enums before the census would make the census itself impossible to run.

**Primary recommendation:** Plan the phase as: workspace scaffold → SCHEMA.md v1 from on-disk samples → enum-loose zod schemas → fetch CLI + committed raw corpus → census report → resolve unknowns + lock enums → normalizer + versioned artifact → tuning-tags generator → era fixture tests. The schema doc gate (SCHEMA.md before `normalize.ts`) is success criterion #1 — enforce it as task ordering.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Corpus fetching (per-year, paced) | Node CLI (`packages/core/src/cli/`) | — | Only code that touches bulk endpoints; never runs in browser or CI (P11) |
| Raw API schema knowledge (zod) | Core `ingest/` module | — | Anti-corruption layer — the only module that knows raw field names |
| Filter-match validation (DATA-03) | Core `ingest/validate` | — | Pure function; called by every fetch path; unit-testable |
| Census report | Node CLI + core `ingest/census` | — | Pure derivation over committed raw data; report is a first-class deliverable |
| Normalization (raw → domain) | Core `ingest/normalize` | — | Pure function; re-runnable with zero API traffic (D-06) |
| Normalized artifact storage | Repo `data/` (committed JSON) | — | Static artifact is Phase 2's sole input; git diff is the review mechanism |
| Tuning-tags generation/merge | Node CLI + core `ingest/` | Owner (hand-edit) | Append-only merge protects hand-edits (D-04) |
| Fixture tests | Vitest (`node` environment) | — | Core purity means no jsdom needed anywhere in this phase |

No browser, no service worker, no IndexedDB, no React in this phase. The `app` package is scaffolded as a stub only.

## Verified Schema Facts (NEW evidence from salvaged samples)

Both files are real kglw.net responses analyzed with Node during this research session. These findings extend `.planning/research/ARCHITECTURE.md` Part 1 and belong in SCHEMA.md verbatim.

### From `rr1010.json` — Red Rocks 2022-10-10, marathon show (27 rows, show_id 1678309429)

1. **Multi-set representation RESOLVED** [VERIFIED: sample analysis]: `setnumber` values are `"1"` and `"2"` — plain string numerals. Combined with prior-verified `"e"` for encores, the vocabulary so far is `"1" | "2" | "e"` (census confirms whether `"3"` exists — some 2022 marathons may have had 3 sets).
2. **`transition_id: 4` OBSERVED** [VERIFIED: sample analysis]: appears exactly once, at position 13 — the **last song of set 1** ("Magma"), with display string `"  "` (two spaces, same display as id 6). The show's final row (position 27, last song of set 2, no encore) has `transition_id: 6`. Working interpretation: **id 4 is a set-break terminal variant**; ids 4/5/6 are all terminal/boundary markers used inconsistently by editors. Census must count all three across the corpus.
3. `position` is global and contiguous 1–27 across both sets [VERIFIED: sample analysis].
4. `settype` is `"Set"` on every row including set 2 — again useless for structure detection.
5. Guest footnotes observed: `"With Leah Senior narration"` on three consecutive rows — footnotes carry guest/performance notes, still no tease observed.

### From `showyear2013.json` — full year 2013 (149 rows, 26 distinct shows)

6. **`/setlists/showyear/2013.json` filter WORKS** [VERIFIED: sample analysis]: all 149 rows have `showyear === 2013` (number). The per-year fetch strategy (D-05) is validated. Caveat: all rows were also `artist_id === 1`, but that is coincidence (no side-project shows documented for 2013) — it does NOT prove the endpoint filters by artist. Client-side `artist_id === 1` filtering remains mandatory.
7. **Terminal transition IDs are unreliable in older data** [VERIFIED: sample analysis]: 14 of 26 shows' final rows have `transition_id: 1` (", ") instead of a terminal id. Distribution across 149 rows: id 1 ×132, id 2 ×3, id 3 ×1, id 5 ×10, id 6 ×3. **Never infer set/show boundaries from transition_id — group by `setnumber` and sort by `position`. Set boundary always wins.**
8. **Notation-era drift is real** (Pitfall P6 confirmed): 2013 has 4 segue notations in 149 rows (~2.7%); the 2022 Red Rocks sample has 9 in 27 rows (~33%). The census should emit per-year segue-frequency so Phase 2 can decide whether the hard-segue signal needs an era restriction.
9. **`settype` variants observed** [VERIFIED: sample analysis]: `"Set"` (13 shows), `"One Set"` (11 shows), `"Live Session"` (2 shows, both at PBS Studios — a Melbourne radio station). `"Live Session"` is exactly the D-16 radio-session exclusion case. Likely allowlist: `{"Set", "One Set"}` — final list pending census (watch for "Soundcheck", festival variants, etc.).
10. **`footnotes` is a double-encoded JSON string** [VERIFIED: sample analysis]: value is either `null` or a *string containing JSON*, e.g. `"[\"first confirmed performance\"]"`. Zod schema: `z.string().nullable()` with a guarded `JSON.parse` transform. `footnote` (singular) is the same content as a plain display string.
11. **Sentinel "Unknown" song exists** [VERIFIED: sample analysis]: `song_id: 1`, `songname: "Unknown"`, `slug: "_custom_"`, `isoriginal: 0` — 4 occurrences in 2013. The normalizer must treat this as an unknown-song placeholder: keep it as a positional entry (it occupies a slot), exclude it from the song catalog and from transition-edge emission (it would create a garbage "Unknown" node). Document in SCHEMA.md.
12. **Covers confirmed in old data**: 9 rows with `isoriginal: 0` and populated `original_artist` (e.g., "I Gotta Rock 'n' Roll" — The Reatards). D-13's include-with-flag policy has real data to test against.
13. **Set→encore boundary with `transition_id: 5`** (2013-02-23) — prior research saw id 6 before an encore. Further proof that 4/5/6 are interchangeable terminals.
14. **Positions contiguous 1..N in every one of the 26 shows** — the normalizer can assert contiguity and hard-fail on gaps (a cheap data-integrity check).
15. Two shows share date 2013-09-11 — `showorder` disambiguation is real; the natural key is `(showdate, showorder, artist_id)`.

### Field type census (both samples, every field)

| Field | Type(s) | Notes |
|-------|---------|-------|
| `uniqueid` | string | numeric string |
| `show_id`, `song_id`, `venue_id`, `tour_id` | number | |
| `showdate` | string | `YYYY-MM-DD` |
| `showtime` | null | never populated in samples — `z.unknown()`/nullable |
| `showtitle`, `artist`, `songname`, `permalink`, `settype`, `transition`, `footnote`, `shownotes`, `opener`, `tourname`, `soundcheck`, `slug`, `original_artist`, `venuename`, `city`, `state`, `country` | string | empty string common; `soundcheck` always `""` in samples |
| `artist_id`, `position`, `transition_id`, `showyear`, `showorder`, `isjamchart`, `isverified`, `isoriginal`, `isreprise`, `isjam` | number | flags are 0/1 numbers, not booleans; `showyear` is a **number** (D-12 assertion must compare numbers) |
| `setnumber` | string | `"1"`, `"2"`, `"e"` |
| `tracktime`, `jamchart_notes`, `css_class` | string \| null | |
| `footnotes` | string \| null | double-encoded JSON array (see fact 10) |
| `timezone` | null | never populated in samples |
| `isrecommended` | number \| null | |

**Row key set is identical between the 2013 and 2022 samples** (41 keys) — the `setlists` schema has been stable across eras. (`latest.json` has a smaller subset per prior research — a Phase 5 concern, but note it in SCHEMA.md.)

### Known facts carried forward from `.planning/research/ARCHITECTURE.md` Part 1 (11 live fetches, 2026-07-08)

- Envelope: `{ error: boolean, error_message: string, data: [...] }`; empty result is `data: []`, NOT an error [VERIFIED: prior live fetch].
- **Silent filter-ignore**: an invalid filter path returns the ENTIRE unfiltered table — the D-12 post-fetch assertion is the only defense [VERIFIED: prior live fetch].
- Multi-artist database: `artist_id 1` = KGLW; side projects share every table; `latest.json` verifiably returned a Stu Mackenzie solo set [VERIFIED: prior live fetch].
- `songs.json` schema: `{ id, name, slug, isoriginal, original_artist, created_at, updated_at }` — **no `artist_id`, no album/tuning data**. Consequence: the KGLW song catalog CANNOT be derived from `songs.json` alone; derive it from the set of `song_id`s observed in `artist_id === 1` setlist rows, using `songs.json` only as supplementary metadata [VERIFIED: prior live fetch].
- `albums.json`: one row per track; **no `song_id`** — join to songs via slug extracted from `song_url` (`"/song/ah-ah-ah"`) or by name; `releasedate` is dirty (`"2006-10-24 (1)"`); `album_notes` is raw HTML (never render, never parse); has `artist_id` (filter + assert) [VERIFIED: prior live fetch].
- `jamcharts.json`: field-name inconsistencies — `showid` (not `show_id`), `song_slug` (not `slug`) [VERIFIED: prior live fetch].
- Sandwich confirmed (2025-12-13: Motor Spirit > Gila Monster > Motor Spirit) with `isreprise: 0` on the second occurrence — `isreprise` is unreliable, per D-14 [VERIFIED: prior live fetch].
- Future shows exist in `shows.json` (2026 tour dates already present) — ingestion must tolerate shows with zero setlist rows [VERIFIED: prior live fetch].
- `tour_id: 1` = "Not Part of a Tour" sentinel [VERIFIED: prior live fetch].

## Standard Stack

All dependency choices are locked by CLAUDE.md (verified against npm registry 2026-07-08 by prior research; re-verified today, same day). Phase 1 needs only the subset below.

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 6.0.3 | Typecheck only (Node strips types at runtime) | Locked by CLAUDE.md; `npm view typescript@6.0.3` confirms existence [VERIFIED: npm registry]; TS 7.0.2 is `latest` but typescript-eslint@8.63.0 peer range is `>=4.8.4 <6.1.0` [VERIFIED: npm registry] |
| zod | 4.4.3 | Runtime schema validation at the ingestion boundary | Locked by CLAUDE.md [VERIFIED: npm registry]; v4 API confirmed against official docs [CITED: zod.dev/api] |
| Vitest | 4.1.10 | Test runner (`projects` config, `node` environment for core) | Locked by CLAUDE.md [VERIFIED: npm registry]; `vitest.workspace.ts` was removed in v4 — use `test.projects` |
| Node.js | ≥24.12 (24.15.0 installed) | Native `.ts` execution for all CLI scripts | Type stripping stable in 24.12+; requires erasable-only syntax (`erasableSyntaxOnly: true`, no `enum`/`namespace`) [VERIFIED: local `node --version` + CLAUDE.md/Node docs] |
| pnpm workspaces | via corepack 0.34.6 | Two-package monorepo (`packages/core` + `packages/app`) | Compile-time core purity enforcement; pnpm NOT currently installed — activate via `corepack enable pnpm`, or use npm workspaces (CLAUDE.md-approved fallback) [VERIFIED: local environment probe] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/node | 24.13.3 (latest 24.x) | Node typings matching the runtime major | Core package devDependency [VERIFIED: npm registry] |
| eslint + typescript-eslint | 10.6.0 / 8.63.0 | Lint (optional this phase) | Can defer to a later phase; if added, it is what pins TS at 6.0.3 [VERIFIED: npm registry] |

**Explicitly NOT needed this phase:** React, Vite, vite-plugin-pwa, Dexie, fuse.js, d3 (all later phases); `tsx`/`ts-node` (Node 24.15 native execution); axios/got/node-fetch (Node built-in `fetch`); any retry/rate-limit library (D-07 forbids retries; pacing is a `setTimeout` sleep).

### Installation

```bash
corepack enable pnpm            # activates pnpm (one-time; or: npm workspaces fallback)
pnpm init                       # workspace root
# packages/core
pnpm add -D typescript@6.0.3 vitest@4.1.10 @types/node@24 --filter @guezzer/core
pnpm add zod@4.4.3 --filter @guezzer/core
```

**Version verification (performed this session):**
```
typescript@6.0.3   exists; latest is 7.0.2 (intentionally NOT used)
zod                latest = 4.4.3 (matches lock)
vitest             latest = 4.1.10 (matches lock)
@types/node        latest 24.x = 24.13.3
typescript-eslint@8.63.0 peerDependencies.typescript = ">=4.8.4 <6.1.0" (confirms TS pin)
```

## Package Legitimacy Audit

slopcheck 0.6.1 ran against the npm ecosystem via a `package.json` scan (note: `slopcheck install` defaults to PyPI and must NOT be used for npm packages — see Pitfall 8).

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| typescript | npm | 12+ yrs | ~60M/wk | github.com/microsoft/TypeScript | [OK] | Approved |
| zod | npm | 6+ yrs | ~30M/wk | github.com/colinhacks/zod | [OK] | Approved |
| vitest | npm | 4+ yrs | ~10M/wk | github.com/vitest-dev/vitest | [SUS] name-proximity to "vite" | Approved — false positive; official Vite-family test runner, verified repo + registry metadata; already locked by CLAUDE.md |
| @types/node | npm | 10+ yrs | ~100M/wk | github.com/DefinitelyTyped/DefinitelyTyped | [OK] | Approved |
| eslint | npm | 12+ yrs | ~40M/wk | github.com/eslint/eslint | [OK] | Approved |
| typescript-eslint | npm | 3+ yrs | ~5M/wk | github.com/typescript-eslint/typescript-eslint | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** vitest — heuristic typosquat warning (name proximity to `vite`); overruled with evidence: official `vitest-dev/vitest` repository confirmed via `npm view` registry metadata, package locked in project CLAUDE.md with peer-dependency verification. No `postinstall` scripts on any package [VERIFIED: npm registry].

## Architecture Patterns

### System Architecture Diagram

```
                       OWNER RUNS: pnpm refresh [--year YYYY]
                                      │
             ┌────────────────────────▼─────────────────────────┐
             │  packages/core/src/cli/refresh.ts  (Node ≥24.12) │
             └───┬──────────────┬──────────────┬────────────────┘
                 │ 1. fetch     │ 2. census    │ 3. normalize
                 ▼              ▼              ▼
   kglw.net API ──► fetch-corpus ──► data/raw/*.json (committed)
   (sequential,     │  per-year setlists (D-05)     │
    2s delay,       │  shows/songs/albums/jamcharts │
    UA header,      │                               ▼
    no retries)     │                    census.ts ──► data/census-report.md
                    │                    (distinct enum values + counts +
                    │                     example show IDs → resolves
                    │                     SCHEMA.md unknowns, D-10)
                    ▼                               │
        validate.ts (D-12 post-fetch assertions:    │ owner reviews, enums locked (D-11)
        every row matches requested filter;         ▼
        zod strict-object parse; hard fail     normalize.ts (artist filter,
        naming endpoint/field/value/show)      setnumber grouping, settype
                                               allowlist, cover/unknown flags)
                                                    │
                                                    ▼
                                    data/normalized/corpus.json
                                    (schemaVersion header, D-08)
                                                    │
                              ┌─────────────────────┼──────────────────┐
                              ▼                     ▼                  ▼
                    Phase 2 matrix builder   tuning-tags generator   fixture tests
                                             (albums join → defaults, (era-spanning,
                                              append-only merge D-04)  Vitest node env)
                                                    │
                                                    ▼
                                          data/tuning-tags.json
                                          (owner hand-edits needsReview subset)
```

Data enters only via the owner-run CLI; nothing in this phase runs in a browser or in CI. The primary use case traces: API → raw snapshots → census → locked schemas → normalizer → versioned artifact.

### Recommended Project Structure

(Claude's-discretion decisions, consistent with CLAUDE.md and ARCHITECTURE.md; the planner should treat these as the plan's file targets.)

```
guezzer/
├── pnpm-workspace.yaml            # packages: ["packages/*"]
├── package.json                   # root: scripts (refresh, test), private
├── vitest.config.ts               # test.projects: ['packages/*']  (NOT vitest.workspace.ts)
├── tsconfig.base.json             # shared strict options
├── docs/
│   └── SCHEMA.md                  # D-09 standalone schema doc (the "why")
├── data/
│   ├── samples/                   # rr1010.json + showyear2013.json MOVED here + committed
│   ├── raw/                       # committed per-year snapshots (D-05/D-06)
│   │   ├── setlists-2010.json … setlists-2026.json
│   │   ├── shows.json  songs.json  albums.json  jamcharts.json
│   │   └── fetch-meta.json        # per-file fetchedAt timestamps
│   ├── normalized/
│   │   └── corpus.json            # versioned artifact (D-08 header) — Phase 2's sole input
│   ├── census-report.md           # first-class deliverable (D-10)
│   └── tuning-tags.json           # owner-editable (D-01..D-04)
└── packages/
    ├── core/
    │   ├── package.json           # "type": "module"; NO react; name @guezzer/core
    │   ├── tsconfig.json          # no DOM lib, erasableSyntaxOnly, allowImportingTsExtensions, noEmit
    │   ├── src/
    │   │   ├── config.ts          # ALL constants (API base URL, delay ms, year range, allowlist)
    │   │   ├── domain/
    │   │   │   └── types.ts       # Show, SetSection, Performance, TransitionKind — clean domain types
    │   │   ├── ingest/
    │   │   │   ├── api-types.ts   # zod raw-row schemas (census-mode + locked-mode) + inferred types
    │   │   │   ├── validate.ts    # D-12 filter assertions, drift error formatting
    │   │   │   ├── census.ts      # distinct-value census over raw corpus (pure)
    │   │   │   ├── normalize.ts   # raw rows → domain Show[] (pure)
    │   │   │   └── tuning-tags.ts # generate + append-only merge (pure)
    │   │   ├── cli/
    │   │   │   ├── refresh.ts     # THE one documented command (orchestrates below)
    │   │   │   ├── fetch-corpus.ts
    │   │   │   ├── run-census.ts
    │   │   │   ├── normalize-corpus.ts
    │   │   │   └── generate-tuning-tags.ts
    │   │   └── index.ts           # public API; raw types NOT re-exported
    │   └── test/
    │       ├── fixtures/          # small real-show extracts: 2012, 2013 live-session,
    │       │                      #   2013 encore, rr1010 multi-set, 2025 sandwich, synthetic edge cases
    │       ├── api-types.test.ts
    │       ├── validate.test.ts
    │       ├── normalize.test.ts
    │       ├── census.test.ts
    │       └── tuning-tags.test.ts
    └── app/                       # STUB ONLY this phase (package.json + placeholder)
```

Root script: `"refresh": "node packages/core/src/cli/refresh.ts"` — satisfies "one documented command" (success criterion 2). Flags: `--year 2026` (default: current year only, per D-05), `--all` (initial full pull), `--census-only`, `--normalize-only`.

### Pattern 1: Two-stage zod schemas (census-mode → locked-mode)

**What:** Enum-ish fields (`settype`, `setnumber`, `transition_id`, flags) are validated structurally (`z.string()`, `z.number().int()`) during fetch + census; after the census resolves the vocabulary with evidence, a second locked schema layer uses `z.enum`/`z.literal` unions that hard-fail on novel values (D-11).
**When to use:** Always here — running strict enums before the census would be circular (the census exists to discover the enum values).
**Example:**

```typescript
// Source: zod.dev/api (v4) + this session's field-type census
import { z } from "zod";

// Stage 1 — structural (fetch + census). Strict keys catch NEW fields (drift).
export const rawSetlistRowCensus = z.strictObject({
  uniqueid: z.string(),
  show_id: z.number().int(),
  showdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  showyear: z.number().int(),          // NUMBER, not string (verified)
  artist_id: z.number().int(),
  song_id: z.number().int(),
  songname: z.string(),
  settype: z.string(),                  // loose until census locks allowlist
  setnumber: z.string(),                // loose until census locks vocabulary
  position: z.number().int().positive(),
  transition_id: z.number().int(),      // loose until census locks 1..6
  transition: z.string(),
  footnote: z.string(),
  footnotes: z.string().nullable(),     // DOUBLE-ENCODED JSON string (verified)
  isoriginal: z.number(),               // 0/1 number flags, not booleans
  isreprise: z.number(),
  isjam: z.number(),
  // ...remaining 20 fields per the field-type census table
});

// Stage 2 — locked (normalizer input), AFTER census. Values below are the
// working hypothesis; the census confirms/extends them with evidence.
export const transitionIdLocked = z.union([
  z.literal(1), z.literal(2), z.literal(3),
  z.literal(4), z.literal(5), z.literal(6),
]);
export const setnumberLocked = z.enum(["1", "2", "3", "e"]); // "3" pending census
```

### Pattern 2: Post-fetch filter assertion (D-12)

**What:** Every filtered fetch is followed by an assertion that every returned row matches the requested filter — the only defense against the verified silent-filter-ignore behavior.

```typescript
// Source: D-12 + ARCHITECTURE.md 1.1 (silent-ignore verified empirically)
export function assertFilterApplied<T>(
  rows: T[], endpoint: string,
  filter: { field: keyof T & string; expected: unknown },
): void {
  const bad = rows.find((r) => r[filter.field] !== filter.expected);
  if (bad !== undefined) {
    throw new Error(
      `FILTER NOT APPLIED by ${endpoint}: requested ${filter.field}=${String(filter.expected)} ` +
      `but got row with ${filter.field}=${String((bad as Record<string, unknown>)[filter.field])}. ` +
      `The kglw.net API silently ignores invalid filters — check the URL path. ` +
      `Example row: ${JSON.stringify(bad).slice(0, 200)}`,
    );
  }
}
// usage after /setlists/showyear/2013.json:
//   assertFilterApplied(rows, "setlists/showyear/2013", { field: "showyear", expected: 2013 });
// artist filtering is CLIENT-SIDE (keep non-KGLW rows out of the corpus but
// count them in the census summary so side-project volume is visible).
```

### Pattern 3: Paced sequential fetcher (D-07, P11)

```typescript
// Source: D-07 + PITFALLS.md P11
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchJson(path: string): Promise<unknown> {
  const res = await fetch(`${config.apiBase}${path}`, {
    headers: { "User-Agent": "Guezzer setlist tool (matt.f.wilson@gmail.com)" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${path} — NOT retrying (D-07)`);
  const body = await res.json() as { error: boolean; error_message: string; data: unknown[] };
  if (body.error) throw new Error(`API error from ${path}: ${body.error_message}`);
  return body.data; // NOTE: data: [] is a VALID empty result, not an error
}
// caller: for (const year of years) { ...; await sleep(config.fetchDelayMs); } — strictly sequential
```

### Pattern 4: Append-only tuning-tags merge (D-04)

```typescript
// Source: D-01..D-04
interface TuningTagEntry {
  songId: number;
  name: string;
  family: "standard" | "cs-standard" | "microtonal" | "other";
  needsReview: boolean;
  source: "album-default" | "hand-tagged";
}
// merge(existing, generated): keep every existing entry VERBATIM (never touch
// hand-edits); append only songIds absent from existing; print added names.
```

### Anti-Patterns to Avoid

- **Inferring set/show boundaries from `transition_id`:** NEW evidence makes this fatal — 2013 shows routinely end with id 1, and ids 4/5/6 are interchangeable terminals. Group by `setnumber`, sort by `position`; boundary always wins.
- **String-parsing the `transition` display field:** whitespace is inconsistent (`" ->"`, `"  "`, `", "`); ids 4 and 6 share the same display string. Switch on `transition_id` only.
- **Deriving the KGLW catalog from `songs.json`:** it has no `artist_id` — side-project songs are indistinguishable there. Catalog = distinct `song_id`s from `artist_id === 1` setlist rows.
- **Locking zod enums before the census runs:** circular; use the two-stage schema pattern.
- **Fetching in CI or on `npm run build`:** the refresh is a manually-run script; raw corpus is committed (P11).
- **Writing extraction code before SCHEMA.md exists:** success criterion 1 and the entire point of P6 prevention. Task ordering must enforce it.
- **Treating `data: []` as an error:** verified valid empty result (future shows, years before 2010).
- **Trusting `isreprise`:** verified 0 even on an actual sandwich reprise (D-14 locks the positional approach).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Runtime schema validation | Hand-written type guards per field | zod 4.4.3 strict objects | 41-field rows × drift detection × error formatting; locked decision |
| TS execution for CLIs | Build step / tsx / ts-node | Node 24.15 native type stripping | Zero-dependency; verified working locally; requires `.ts` import extensions + erasable syntax |
| HTTP client | axios/got wrapper | Node built-in `fetch` + `AbortSignal.timeout` | Stable since Node 18; nothing else needed for sequential GETs |
| Rate limiting / retry | p-retry, bottleneck, etc. | `setTimeout` sleep in a `for` loop | D-07 mandates sequential + no retries; a library would add the exact behavior we must NOT have |
| Test fixtures/snapshots | Custom fixture loader | Vitest + plain JSON imports | `node` environment, JSON modules import cleanly |
| Monorepo task orchestration | turbo/nx | pnpm workspace scripts | Two packages, one consumer; anything more is overhead |

**Key insight:** this phase's complexity is *empirical* (what the data actually looks like), not *technical*. Every library beyond zod/vitest/typescript adds surface area without addressing the real risk, which is schema misunderstanding.

## Common Pitfalls

### Pitfall 1: Trusting `transition_id` for structure
**What goes wrong:** Set boundaries inferred from terminal ids (4/5/6) miss the 2013-era shows that end with id 1, producing phantom transitions or truncated sets.
**Why it happens:** The 2022+ data looks consistent; the drift only appears in old data.
**How to avoid:** `setnumber` grouping + `position` sort is the ONLY structure source; transition_id is metadata on the gap after a row, used solely for segue detection (2/3).
**Warning signs:** Normalizer code that branches on transition_id ∈ {4,5,6}; fixture tests only using post-2020 shows.

### Pitfall 2: Locking enums before the census
**What goes wrong:** Strict `z.enum(["Set"])` written from samples hard-fails on `"One Set"`/`"Live Session"` the moment the full corpus is fetched — the census never completes.
**How to avoid:** Two-stage schemas (Pattern 1). The locked stage is written AFTER the census report is reviewed.
**Warning signs:** A single `rawSetlistRow` schema used by both fetch and normalize; plan tasks where schema-locking precedes census.

### Pitfall 3: Silent filter-ignore poisoning the raw corpus
**What goes wrong:** A typo'd filter path (`/setlists/showyr/2013.json`) returns the ENTIRE multi-artist table; the committed "2013" file is actually everything.
**How to avoid:** `assertFilterApplied` after every fetch (Pattern 2); also sanity-assert row counts (a year file with >5,000 rows is wrong).
**Warning signs:** Any fetch not followed by an assertion; raw files committed without the census run over them.

### Pitfall 4: Node native TS import/extension gotchas
**What goes wrong:** CLI scripts fail at runtime with `ERR_MODULE_NOT_FOUND` because relative imports lack `.ts` extensions, or fail on `enum`/`namespace`/parameter-properties under type stripping.
**Why it happens:** Node's type stripping does not do module resolution magic — ESM rules apply; erasable-syntax-only is enforced at runtime.
**How to avoid:** `"type": "module"` in core's package.json; all relative imports carry `.ts` extensions; tsconfig: `"erasableSyntaxOnly": true`, `"allowImportingTsExtensions": true`, `"noEmit": true`, `"module": "nodenext"`. Vitest and (later) Vite both handle `.ts`-extension imports fine.
**Warning signs:** `enum` anywhere in core; imports without extensions; a `tsc` emit step appearing in scripts. [ASSUMED — pattern from Node docs via prior verified research; confirm on first CLI run, which happens naturally in Wave 1]

### Pitfall 5: `footnotes` double-decode crash
**What goes wrong:** `JSON.parse(row.footnotes)` throws on malformed editor-entered content somewhere in 15 years of data, killing a full ingest at row 12,000.
**How to avoid:** Guarded transform: parse failure → keep raw string, log to census as a data quirk, never throw. Teases/footnotes are carried verbatim and never emit transitions (D-15), so a failed parse costs nothing.

### Pitfall 6: Tuning-tags regeneration clobbering hand-edits
**What goes wrong:** The owner hand-fills 60 `needsReview` entries; a later refresh regenerates the file from album defaults and wipes the work.
**How to avoid:** Append-only merge (D-04) with a unit test that proves an existing hand-edited entry survives regeneration byte-for-byte.

### Pitfall 7: The "Unknown" sentinel song entering the catalog
**What goes wrong:** `song_id: 1` ("Unknown", slug `_custom_`) becomes a catalog song and later a constellation node / prediction candidate.
**How to avoid:** Normalizer marks it as a placeholder occurrence (occupies position, excluded from catalog + transition emission). Add it to an explicit sentinel list in `config.ts`.

### Pitfall 8: slopcheck/pip cross-ecosystem trap (tooling, discovered this session)
**What goes wrong:** `slopcheck install <npm-package>` checks **PyPI** and then pip-installs PyPI squatters named `typescript`/`zod`.
**How to avoid:** For npm audits use `slopcheck scan package.json --json` (file-based scan detects ecosystem). Never `slopcheck install` for Node projects.

### Pitfall 9: Windows dev environment friction
**What goes wrong:** Committed JSON churns with CRLF conversions; shell-specific script syntax breaks (`sleep` doesn't exist in PowerShell).
**How to avoid:** `.gitattributes` with `*.json text eol=lf`; all pacing/orchestration lives inside Node scripts (cross-platform), never shell one-liners; root scripts are plain `node <file>` invocations.

## Code Examples

See Architecture Patterns 1–4 above (two-stage zod schemas, filter assertion, paced fetcher, append-only merge). One additional load-bearing example — the normalized artifact header (D-08, the first frozen contract):

```typescript
// Source: D-08 + ARCHITECTURE.md Pattern 2 (adapted for the Phase-1 corpus artifact)
export interface NormalizedCorpus {
  schemaVersion: 1;                 // bump on breaking shape changes; consumers check
  generatedAt: string;              // ISO timestamp
  latestShowDate: string;           // "data through YYYY-MM-DD" in later UI
  showCount: number;
  songCount: number;
  shows: NormalizedShow[];          // grouped sets, positional performances,
                                    // isCover / isPlaceholder flags, verbatim footnotes
}
```

And the census report shape (Claude's discretion, D-10):

```
data/census-report.md — one section per enum-ish field
  (settype, setnumber, transition_id, isoriginal, isreprise, isjam,
   soundcheck, opener, isverified, css_class, tour_id sentinels):
    value | row count | show count | 3 example show_ids + dates
  plus derived checks:
    - last-row transition_id distribution (terminal reliability by era)
    - per-year segue (id 2/3) frequency  (notation-drift check for Phase 2)
    - rows where footnotes fails JSON.parse
    - non-contiguous position sequences (should be zero)
    - side-project row counts filtered out per year
    - distinct KGLW songs, shows per year, covers count
Also emit census.json (machine-readable) next to it for tests.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tsx`/`ts-node` for TS CLIs | Node ≥24.12 native type stripping | Node 24.12 (stable) | Zero build step; requires erasable-only syntax + `.ts` import extensions |
| `vitest.workspace.ts` | `test.projects` in root `vitest.config.ts` | Vitest 4 (removed) | Pre-2025 tutorials are wrong; one root config runs core in `node` env |
| zod 3 `.strict()` chains | zod 4 `z.strictObject()` | zod 4 | Cleaner strict-by-construction schemas [CITED: zod.dev/api] |
| TypeScript 7.0.2 (`latest`) | Pin 6.0.3 | typescript-eslint peer `<6.1.0` | Upgrade later is a one-line change once lint toolchain catches up |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Microtonal albums for the tuning-tag seed map are Flying Microtonal Banana, K.G., and L.W.; `cs-standard` assignments are owner knowledge; everything ambiguous defaults to `standard` + `needsReview: true` | Phase Requirements / DATA-04 | Low — D-02's review flag is the designed mitigation; owner hand-checks flagged entries |
| A2 | KGLW live data on kglw.net starts ~2010; the fetch probes 2010–2026 and tolerates empty years (`data: []`) | Fetch strategy | Nil — empty-year handling makes over-probing free (1 wasted request per empty year) |
| A3 | Node native TS tsconfig combo (`allowImportingTsExtensions` + `noEmit` + `module: nodenext`) is the right typecheck configuration for runtime-stripped code | Pitfall 4 | Low — fails loudly on first `node script.ts` run; fix is config-only |
| A4 | `settype` allowlist will end up `{"Set", "One Set"}` | Verified Schema Facts #9 | Low — D-16 explicitly gates the final allowlist on the census |
| A5 | `transition_id: 4` = set-break terminal (observed once) | Verified Schema Facts #2 | Nil for correctness — normalizer never uses terminals for structure; census confirms with full-corpus counts |
| A6 | `setnumber: "3"` exists for 3-set shows | Pattern 1 locked schema | Nil — census discovers the actual vocabulary before enums lock |

## Open Questions

1. **Tease notation location** — still zero teases observed in any sample (2013 footnotes carry debut notes; 2022 carry guest notes).
   - What we know: no tease row type exists in the schema; footnote/footnotes is the only candidate location.
   - What's unclear: exact string conventions for teases.
   - Recommendation: census emits a footnote-content sample (rows whose footnote matches /tease/i etc.); D-15 makes this non-blocking — footnotes are carried verbatim regardless.
2. **`settype` full variant list across 15 years** (Soundcheck? Festival? Movie Score sets?)
   - Recommendation: census resolves; allowlist decision is an explicit owner-reviewable line in SCHEMA.md.
3. **Whether every year 2010–2026 responds to `/setlists/showyear/`** — 2013 verified; the D-12 assertion mechanically covers all others.
4. **jamcharts ingestion scope** — Phase 2 needs jamcharts for MODL-05; fetching it now (one request) alongside the corpus is cheap and consistent with D-05. Recommendation: fetch + commit raw in Phase 1, normalize in Phase 2.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js ≥24.12 | Native TS CLI execution | ✓ | 24.15.0 | — |
| pnpm | Workspace management | ✗ | — | `corepack enable pnpm` (corepack 0.34.6 present) or npm workspaces (CLAUDE.md-approved) |
| npm | Registry access | ✓ | 11.12.1 | — |
| git | Repo, committed corpus | ✓ | 2.54.0.windows.1 | — |
| kglw.net API reachability | Corpus fetch | ✓ (assumed — samples were fetched from this network recently) | v2 | Salvaged samples allow schema/normalizer work to proceed offline |
| slopcheck | Package audits | ✓ | 0.6.1 | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** pnpm — plan should include a one-time `corepack enable pnpm` setup step (first task, Wave 0).

**Platform note:** Windows 11 dev machine — all orchestration must live inside Node scripts (no POSIX shell assumptions); `.gitattributes` should pin LF for committed JSON.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 |
| Config file | none — see Wave 0 (`vitest.config.ts` with `test.projects: ['packages/*']`; core project `environment: 'node'`) |
| Quick run command | `pnpm vitest run packages/core/test/<file>.test.ts` |
| Full suite command | `pnpm vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | zod raw-row schemas parse real samples (rr1010, showyear2013) with zero errors; strict-object rejects an extra key | unit | `pnpm vitest run packages/core/test/api-types.test.ts` | ❌ Wave 0 |
| DATA-01 | Census over sample data emits expected distinct values (settype: Set/One Set/Live Session; tids incl. 4) | unit | `pnpm vitest run packages/core/test/census.test.ts` | ❌ Wave 0 |
| DATA-02 | Fetch orchestration (mocked fetch): per-year sequencing, pacing hook called, envelope handling, empty-year tolerance; artifact header fields present + counts correct | unit | `pnpm vitest run packages/core/test/fetch.test.ts` | ❌ Wave 0 |
| DATA-02 | Real one-command refresh produces committed raw files + normalized artifact | manual-only (touches live volunteer API — justification: D-07/P11 forbid automated API calls) | owner runs `pnpm refresh --all` once; census report reviewed | — |
| DATA-03 | `assertFilterApplied` throws with endpoint/field/value/example on mismatch; passes on clean data; artist filter drops non-KGLW rows | unit | `pnpm vitest run packages/core/test/validate.test.ts` | ❌ Wave 0 |
| DATA-04 | Generator assigns album defaults + needsReview; merge preserves existing entries verbatim, appends only new songs, reports additions | unit | `pnpm vitest run packages/core/test/tuning-tags.test.ts` | ❌ Wave 0 |
| (SC #5) | Era fixtures parse: 2012/2013-style (loose terminals, One Set, Live Session exclusion, Unknown sentinel), 2022 multi-set (tid 4, setnumber 2), 2025-style (encore `e`, sandwich, segue chain) | unit | `pnpm vitest run packages/core/test/normalize.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run packages/core` (fast — pure functions, small fixtures)
- **Per wave merge:** `pnpm vitest run` + `pnpm -r exec tsc --noEmit` (typecheck both packages)
- **Phase gate:** full suite green + real refresh executed once + census report reviewed + SCHEMA.md unknowns resolved before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Workspace scaffold: `pnpm-workspace.yaml`, root `package.json`, `tsconfig.base.json`, core/app package.jsons, core tsconfig (no-DOM, erasableSyntaxOnly)
- [ ] `vitest.config.ts` with `test.projects` (framework install: `pnpm add -D vitest@4.1.10 --filter @guezzer/core`)
- [ ] `packages/core/test/fixtures/` — extracted from `data/samples/` (move rr1010.json + showyear2013.json off repo root first)
- [ ] `.gitattributes` (LF for JSON)

## Security Domain

### Applicable ASVS Categories (Level 1; phase is a build-time CLI, no auth surface)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts, no secrets — kglw.net API is unauthenticated |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | zod 4 strict objects at the ingestion boundary (the core of this phase); guarded JSON.parse for `footnotes`; year CLI arg validated as integer 2010–2100 before URL construction |
| V6 Cryptography | no | — |
| V14 Config/Supply chain | yes | Package legitimacy audit completed (this doc); lockfile committed; no postinstall scripts in dependency set; corpus committed = reviewable via git diff |

### Known Threat Patterns for build-time Node ETL

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious/corrupt API payload | Tampering | zod strict validation; hard fail at build time (D-11); never `eval`/`Function` on fetched data |
| Path injection via CLI year arg | Tampering | Validate as bounded integer before interpolating into file paths/URLs |
| Slopsquatted dependency | Elevation | slopcheck npm-scan (done); pin exact versions; verify repo provenance |
| Stored XSS via `album_notes` (raw HTML) / song names | Tampering (future UI) | Phase 1: carry strings verbatim, never interpret; note in SCHEMA.md that `album_notes` and footnotes are untrusted content for later UI phases (React default escaping, no `dangerouslySetInnerHTML`) |
| Accidental API abuse | DoS (against volunteer site) | D-07 pacing, no retries, no CI fetches, descriptive User-Agent |

## Project Constraints (from CLAUDE.md)

Directives the plan MUST honor (same authority as locked decisions):

- **Core purity:** all domain logic in pure TS `core/` with zero React/DOM/browser deps; enforced mechanically — core tsconfig has no DOM lib (`"lib": ["ES2023"]`), core package.json has no React; entire core runnable/testable from Node CLI.
- **TypeScript 6.0.3, NOT 7.0.2** (typescript-eslint peer `<6.1.0`).
- **Node ≥24.12 native TS execution** for CLI scripts; `"erasableSyntaxOnly": true`; no `enum`/`namespace`; no tsx unless Node <24.12 (it isn't).
- **zod 4.4.3 at the ingestion boundary**; build-time fetch validates every show; drift fails loudly.
- **API etiquette:** historical corpus fetched once at build time and bundled as static JSON; volunteer-run fan site; NO CI-scheduled corpus refresh — committed corpus + manual one-command refresh only.
- **Single config file for all model/pipeline constants** — no scattered magic numbers (`packages/core/src/config.ts`).
- **pnpm workspaces** `packages/core` + `packages/app` (npm workspaces acceptable fallback).
- **Vitest `projects` config** — do NOT create `vitest.workspace.ts` (removed in Vitest 4).
- **Unit tests use small fixture setlists with known expected outputs.**
- **GSD workflow enforcement:** file changes go through GSD commands (`/gsd-execute-phase` for planned work).
- **Transition matrix (Phase 2 concern) must be plain serializable JSON** — Phase 1's normalized artifact is its input contract; keep it plain JSON with the D-08 header.

## Sources

### Primary (HIGH confidence)
- `rr1010.json` + `showyear2013.json` — real kglw.net API responses analyzed with Node this session (field types, setnumber "2", transition_id 4, settype variants, footnotes encoding, Unknown sentinel, terminal unreliability)
- `.planning/research/ARCHITECTURE.md` Part 1 — 11 empirical live fetches (2026-07-08): envelope, silent filter-ignore, multi-artist, songs/albums/jamcharts schemas, sandwich behavior
- npm registry via `npm view` (this session): typescript@6.0.3 existence, zod 4.4.3, vitest 4.1.10, @types/node 24.13.3, typescript-eslint peer range, source repos, no postinstall scripts
- Local environment probes: Node 24.15.0, corepack 0.34.6, pnpm absent, git 2.54, slopcheck 0.6.1
- zod.dev/api [CITED] — zod 4 `z.strictObject`, `z.enum`, `.transform`, error customization
- slopcheck 0.6.1 npm-ecosystem scan (this session) — all six packages OK (vitest SUS = name-proximity false positive)

### Secondary (MEDIUM confidence)
- `.planning/research/PITFALLS.md` P6/P11 — prior research, sources cited there (kglw.net docs verified to omit segue representation; volunteer-API etiquette)
- `.planning/research/STACK.md` / CLAUDE.md — Node native type-stripping behavior and tsconfig implications (verified versions; exact tsconfig combo flagged A3)

### Tertiary (LOW confidence)
- KGLW album→tuning-family mapping (A1) — training knowledge; mitigated by design (needsReview flags, owner review)

## Metadata

**Confidence breakdown:**
- API schema facts: HIGH — every claim traced to a real response analyzed this session or a prior documented live fetch
- Standard stack: HIGH — versions registry-verified same-day; legitimacy audited
- Architecture/task ordering: HIGH — locked by CONTEXT.md decisions + prior verified research; discretion items are low-risk file-layout calls
- Pitfalls: HIGH for data pitfalls (empirically demonstrated); MEDIUM for Node-TS tsconfig details (A3, fails loudly if wrong)

**Research date:** 2026-07-08
**Valid until:** 2026-08-07 (stable domain; kglw.net schema shown stable 2013→2022; npm versions may drift — re-run `npm view` at install time)

---
phase: 01-corpus-ingestion-schema-foundation
verified: 2026-07-08T22:30:00Z
status: passed
resolution: "DATA-04 tuning spot-check completed by VALID-01 (Phase 10, 2026-07-18, zero backtest regression); the human_verification item below is superseded."
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open data/tuning-tags.json and spot-check ~10 songs the owner knows well (e.g. Rattlesnake -> microtonal, The River -> standard-era judgment call) for sensible album-derived tuning-family defaults."
    expected: "The album-derived defaults are sensible enough that hand-filling only the needsReview subset (52/264 entries, 19.7%) is realistic — no widespread silent misclassification outside the flagged subset."
    why_human: "Correctness of a tuning-family judgment call for a specific song requires domain/fan knowledge of the band's catalog that cannot be verified by grep or static analysis — this is the planner-deferred human-check from 01-05-PLAN.md Task 2 (DATA-04 readiness), harvested per workflow #3309."
---

# Phase 01: Corpus Ingestion & Schema Foundation Verification Report

**Phase Goal:** The full KGLW historical corpus is fetched, validated, and normalized into clean domain data — with every schema assumption documented from real endpoint samples before extraction code exists.
**Verified:** 2026-07-08T22:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Schema document exists, built from real endpoint samples, covering field names, ordering, transition_id vocabulary, set/encore delimiting, covers/teases, multi-set representation — written before any extraction code | VERIFIED | `docs/SCHEMA.md` (13 required sections + §13 Open Unknowns, all 5 resolved with census citations). Git history confirms ordering: `5764c4f` (docs: SCHEMA.md) precedes `a8827e0` (normalizeCorpus impl), `5091de4` (skeleton CLI), and `3fcdda5` (fetch-corpus.ts) — verified directly via `git log --oneline --all`, not trusted from SUMMARY narrative. |
| 2 | Running one documented command fetches the full historical corpus and writes a versioned static JSON artifact bundled with the repo | VERIFIED | `npm run refresh -- --all` / `--fetch-only` / `--normalize-only` documented in `packages/core/src/cli/refresh.ts` usage text and root `package.json`'s `"refresh"` script. `data/raw/setlists-2010.json` … `setlists-2026.json` + `shows/songs/albums/jamcharts.json` + `fetch-meta.json` committed (17 fetch-meta entries with real timestamps). `data/normalized/corpus.json` committed: `schemaVersion:1`, `showCount:738`, `songCount:264`, `latestShowDate:2025-12-13`. Re-ran `node packages/core/src/cli/refresh.ts --normalize-only` live during verification — reproduced byte-identical output except `generatedAt`, confirming the pipeline is real and reproducible (file reverted after check, working tree left clean). |
| 3 | Every ingestion path filters to artist_id === 1 and validates that filtered API responses actually match the requested filter | VERIFIED | `normalize.ts:109` (`validated.filter((row) => row.artist_id === 1)`), `census.ts:156-157` (kglw/non-kglw split), `generate-tuning-tags.ts:77` (`allAlbumRows.filter((row) => row.artist_id === 1)`) all filter client-side per D-06 design (raw files intentionally keep all artists as source-of-truth; filtering happens at every derived-data path). `assertFilterApplied` (`validate.ts`) is called after every per-year fetch in `fetch-corpus.ts:154` on the `showyear` filter — the only endpoint the API actually accepts a filter parameter for. Confirmed via source read, not SUMMARY claim. |
| 4 | Tuning-family tagging file (JSON/CSV) exists with album-derived defaults for ~250 songs, ready for hand-fill | VERIFIED | `data/tuning-tags.json`: 264 entries (matches corpus songCount exactly), `schemaVersion:1`, family vocabulary `{standard:247, microtonal:17}` (no invalid values), `needsReview` count 52 (19.7%, well under a "broken join" red flag). Re-ran `node packages/core/src/cli/generate-tuning-tags.ts` live — zero git diff, confirming D-04 append-only idempotence is real, not just summary narrative. |
| 5 | Era-spanning fixture tests (2012/2017/2022/2025-style shows) pass against the normalizer, proving set structure, segues, sandwiches parse correctly | VERIFIED | `packages/core/test/fixtures/` contains 8 real single-show extracts (`2012-loose-terminal`, `2013-live-session`, `2013-encore`, `2013-unknown-sentinel`, `2022-rr1010-multiset`, `2017-segues`, `2025-sandwich`, `2025-segue-chain`), each with a `.meta.json` provenance sibling. `npx vitest run packages/core/test/normalize.test.ts` — 16/16 tests pass (re-run live during verification, not taken from SUMMARY). |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `docs/SCHEMA.md` | Empirical schema doc, 13 sections + resolved Open Unknowns | VERIFIED | Exists, all 5 Open Unknowns have substantive Resolution lines with counts + evidence |
| `packages/core/src/ingest/api-types.ts` | Census-mode (Stage 1) + locked (Stage 2) zod schemas | VERIFIED | `rawSetlistRowCensus`, `rawSetlistRowLocked`, `setnumberLocked`, `transitionIdLocked`, `settypeLocked`, `formatRowError` all present and exported |
| `packages/core/src/ingest/validate.ts` | `assertFilterApplied` | VERIFIED | Implements the documented error-message convention (endpoint/field/expected/actual/example row) |
| `packages/core/src/ingest/normalize.ts` | Pure `normalizeCorpus` | VERIFIED | Uses `rawSetlistRowLocked`, setnumber-only grouping, exhaustive `mapTransitionKind`, D-13/14/15/16 semantics implemented |
| `packages/core/src/cli/fetch-corpus.ts` | Paced sequential fetcher | VERIFIED | `fetchJson`/`fetchCorpus`, no retry logic (`grep -c "retry"` = 0), `assertFilterApplied` wired |
| `packages/core/src/ingest/census.ts` | Full-corpus census | VERIFIED | `runCensus` produces `data/census.json` (2MB) + `data/census-report.md` (23KB), both committed |
| `packages/core/src/ingest/tuning-tags.ts` | Tuning-tag generator + merge | VERIFIED | `generateTuningTags`/`mergeTuningTags`/`tuningTagsFileSchema`, closed 4-value family enum |
| `data/normalized/corpus.json` | Final versioned full-corpus artifact | VERIFIED | 738 shows, 264 songs, regenerates byte-identical (except `generatedAt`) on live re-run |
| `data/tuning-tags.json` | ~250-song tagging file | VERIFIED | 264 entries, idempotent on live re-run |
| `packages/core/test/fixtures/*.json` | Era-spanning fixtures (>= 8) | VERIFIED | 8 fixture pairs (16 files incl. `.meta.json`) covering 2012/2013/2017/2022/2025 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `cli/normalize-corpus.ts` | `ingest/normalize.ts` | thin wrapper calling `normalizeCorpus` | WIRED | Confirmed by successful live re-run producing identical output |
| `ingest/normalize.ts` | `ingest/api-types.ts` | `rawSetlistRowLocked` validation | WIRED | `grep -c "rawSetlistRowCensus" normalize.ts` = 0 (fully swapped to locked schema per 01-04) |
| `cli/fetch-corpus.ts` | `ingest/validate.ts` | `assertFilterApplied` after every per-year fetch | WIRED | Present at line 154, called on `showyear` filter |
| `data/census.json` | `data/raw/` | census derived from committed raw only | WIRED | `run-census.ts` reads only `data/raw/setlists-*.json`; census counts (settype triple, transition_id distribution) match corpus cross-checks |
| `cli/generate-tuning-tags.ts` | `data/normalized/corpus.json` | catalog derived from normalized artifact, never `songs.json` | WIRED | `grep -c "songs.json" tuning-tags.ts` = 0; confirmed via source read |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite passes | `npx vitest run` | 7 files, 60/60 tests passed | PASS |
| Typecheck clean | `npx tsc --noEmit -p packages/core/tsconfig.json` | exit 0, no errors | PASS |
| `--normalize-only` reproduces committed artifact | `node packages/core/src/cli/refresh.ts --normalize-only` | Identical output except `generatedAt`; file reverted after check | PASS |
| Tuning-tags CLI is idempotent | `node packages/core/src/cli/generate-tuning-tags.ts` (2nd run) | "264 total entries, 0 added, 52 needsReview"; zero git diff | PASS |
| Git history proves schema-before-code ordering | `git log --oneline --all` | `5764c4f` (SCHEMA.md) precedes all normalize/fetch commits | PASS |
| No live network calls in test suite | grep for real endpoint usage in tests | `fetch.test.ts`/`census.test.ts` use injected mocks only | PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|--------------|--------|----------|
| DATA-01 | 01-01, 01-03, 01-04 | Empirical schema documentation before extraction code | SATISFIED | `docs/SCHEMA.md` written and committed before `normalize.ts`/`fetch-corpus.ts` (git-log verified); all 5 Open Unknowns resolved with census evidence |
| DATA-02 | 01-02, 01-03, 01-04 | One-command refresh fetches full corpus, writes versioned artifact | SATISFIED | `npm run refresh` documented command; `data/raw/*` + `data/normalized/corpus.json` committed and reproducible |
| DATA-03 | 01-01, 01-02, 01-03 | Every ingestion path filters artist_id===1 and validates filtered responses match the filter | SATISFIED | Client-side filtering in `normalize.ts`/`census.ts`/`generate-tuning-tags.ts`; `assertFilterApplied` wired into `fetch-corpus.ts` on every per-year fetch |
| DATA-04 | 01-05 | Tuning-family tagging file with album-derived defaults for ~250 songs | SATISFIED (pending human spot-check) | `data/tuning-tags.json`, 264 entries, 19.7% needsReview; end-of-phase human-check deferred from plan 01-05 Task 2 not yet performed |

No orphaned requirements found — REQUIREMENTS.md maps only DATA-01..DATA-04 to Phase 1, and all four appear in at least one plan's `requirements:` frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/core/src/domain/types.ts` / `ingest/normalize.ts` | types.ts:19-38, normalize.ts:190-234 | `shownotes` is validated and read (census.ts tease-hunt) but never carried into `Performance`/`NormalizedShow`, contradicting `docs/SCHEMA.md` §12's explicit "must be carried verbatim through ingestion **and normalization**" requirement | WARNING | Does not fail any of the 5 numbered roadmap success criteria (none require shownotes retention specifically), but it is a real, verified inconsistency between the schema document's own stated invariant and the normalizer's actual behavior — confirmed directly by reading `normalize.ts`'s `Performance` construction (no `shownotes` field) and `domain/types.ts` (no `shownotes` field anywhere). Matches code-review finding WR-01 exactly; independently re-verified here rather than trusted from the review. Any future feature needing show-level prose will require a full re-normalize from `data/raw`, not just a read of the committed artifact. |
| `packages/core/src/cli/fetch-corpus.ts` | 99-109 | `mergeFetchMeta` catches ALL read/parse errors as "file doesn't exist", masking real corruption (WR-02) | INFO | Non-blocking; low likelihood, doesn't affect currently-committed data |
| `packages/core/src/cli/fetch-corpus.ts` | 51-70 | Network/timeout/JSON-parse failures don't name the endpoint, unlike the two explicit HTTP/API-error branches (WR-03) | INFO | Non-blocking; degrades diagnosability only in an already-rare failure path |
| `normalize-corpus.ts` / `run-census.ts` / `refresh.ts` | various | `--input`/`--out` flags accept no value silently, unlike `--year` (WR-04) | INFO | Non-blocking; produces a confusing but non-corrupting Node error |
| `fetch-corpus.ts` / `census.ts` | 151 / 155 | Census-mode row validation doesn't use `formatRowError` convention (WR-05) | INFO | Non-blocking; cosmetic error-message inconsistency |
| `tuning-tags.ts` | 150-167 | Name-based fallback match for album join could theoretically cross-contaminate same-named distinct songs (WR-06) | INFO | Non-blocking; verified not to manifest in current committed data |

No debt markers (TBD/FIXME/XXX) found in any file modified by this phase. No stub/placeholder code paths found — all "placeholder" string matches are legitimate `isPlaceholder` sentinel-song domain terminology, not incomplete implementation markers.

### Human Verification Required

### 1. Tuning-Family Default Sanity Check (DATA-04 readiness)

**Test:** Open `data/tuning-tags.json` and spot-check ~10 songs you know well (e.g. "Rattlesnake" -> expect `microtonal`; "The River" -> a standard-era judgment call) against the album-derived `family` defaults.
**Expected:** The defaults are sensible enough that hand-filling is realistically limited to the 52 `needsReview: true` entries (19.7% of the 264-song catalog) — no silent, unflagged misclassification outside that subset.
**Why human:** Whether a specific song's tuning-family default is musically correct requires fan/domain knowledge of the King Gizzard catalog that cannot be verified by static analysis or grep. This is the planner-deferred `<verify_human>` check explicitly written into `01-05-PLAN.md` Task 2 ("End-of-phase... confirm the album-derived defaults are sensible enough that hand-filling only the needsReview subset is realistic") — harvested here per the end-of-phase human-verify workflow rather than re-derived independently.

### Gaps Summary

No gaps block phase-goal achievement. All 5 roadmap success criteria are independently verified against the codebase (not merely SUMMARY.md narrative): the schema document provably precedes extraction code by git history, the one-command refresh pipeline was re-executed live during this verification and reproduces the committed artifacts, artist_id filtering and `assertFilterApplied` are wired at every ingestion path, the tuning-tags file has the correct entry count and idempotence proven live, and all 8 era-spanning fixtures pass with explicit expected-value assertions.

The single WARNING (shownotes not carried into the normalized domain model despite `docs/SCHEMA.md` §12 claiming it must be) is a real, confirmed discrepancy but does not fail any of the 5 named success criteria — it is surfaced for the record and should be resolved (either implement the carry-through or narrow the SCHEMA.md claim) before any future phase relies on show-level prose fields.

The phase status is `human_needed` solely because of the one planner-deferred human-check in `01-05-PLAN.md` (spot-checking tuning-tag defaults) — this was intentionally deferred to end-of-phase to avoid executor cold-start cost, not because of any detected defect.

---

_Verified: 2026-07-08T22:30:00Z_
_Verifier: Claude (gsd-verifier)_

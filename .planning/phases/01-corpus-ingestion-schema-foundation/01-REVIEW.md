---
phase: 01-corpus-ingestion-schema-foundation
reviewed: 2026-07-08T00:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - data/census-report.md
  - data/census.json
  - data/normalized/corpus.json
  - data/tuning-tags.json
  - docs/SCHEMA.md
  - packages/app/README.md
  - packages/app/package.json
  - packages/core/package.json
  - packages/core/src/cli/fetch-corpus.ts
  - packages/core/src/cli/generate-tuning-tags.ts
  - packages/core/src/cli/normalize-corpus.ts
  - packages/core/src/cli/refresh.ts
  - packages/core/src/cli/run-census.ts
  - packages/core/src/config.ts
  - packages/core/src/domain/types.ts
  - packages/core/src/index.ts
  - packages/core/src/ingest/api-types.ts
  - packages/core/src/ingest/census.ts
  - packages/core/src/ingest/normalize.ts
  - packages/core/src/ingest/tuning-tags.ts
  - packages/core/src/ingest/validate.ts
  - packages/core/test/api-types.test.ts
  - packages/core/test/census.test.ts
  - packages/core/test/fetch.test.ts
  - packages/core/test/normalize.test.ts
  - packages/core/test/smoke.test.ts
  - packages/core/test/tuning-tags.test.ts
  - packages/core/test/validate.test.ts
  - packages/core/tsconfig.json
findings:
  critical: 0
  warning: 6
  info: 5
  total: 11
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-07-08T00:00:00Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

Reviewed the corpus-ingestion/schema-foundation phase: config, domain types, ingest modules (api-types, normalize, census, tuning-tags, validate), CLI wrappers (fetch-corpus, normalize-corpus, run-census, generate-tuning-tags, refresh), their tests, and the generated data artifacts (census.json/census-report.md, corpus.json, tuning-tags.json) plus docs/SCHEMA.md.

All 60 existing tests pass and `tsc --noEmit` is clean. Cross-checked the generated artifacts against the code that produces them (census-report.md totals reconcile with census.json's per-field counts; corpus.json's `showCount`/`songCount` reconcile with the settype-allowlist exclusion logic in `normalize.ts`) — no arithmetic or aggregation bugs found in the generated data.

No Critical/security issues were found — this is local, single-user, build-time tooling with no untrusted input surface (the one hostile-input vector, the kglw.net API response, is handled with real rigor: `assertFilterApplied`, row-count sanity check, strict zod schemas, and the D-11 locked-enum drift detection).

The Warnings below are mostly about **inconsistently applied conventions the codebase itself established**: a documented "must carry verbatim through normalization" requirement (docs/SCHEMA.md §12) that isn't actually honored for the `shownotes` field, an error-context convention (`formatRowError`, named-endpoint failures) that is applied in some call sites but not others, and an ENOENT-only-catch pattern used in one CLI file but not its sibling. None of these affect the correctness of the currently-committed data, but they represent gaps between the phase's own stated invariants and what the code does, which is exactly the kind of thing that will bite silently on the *next* refresh against live data.

## Warnings

### WR-01: `shownotes` is validated and read but never carried into the normalized domain model, contradicting docs/SCHEMA.md §12's "must carry verbatim" requirement

**File:** `packages/core/src/domain/types.ts:19-38,64-73`, `packages/core/src/ingest/normalize.ts:190-234`
**Issue:** docs/SCHEMA.md §12 states: "`shownotes`, `album_notes`, and `footnote(s)` are untrusted editor-entered content... These fields must be carried verbatim through ingestion and normalization, and never interpreted as HTML or rendered without escaping..." `footnote`/`footnotes` are honored (`Performance.footnote`, `footnotesParsed`, `footnotesRaw`). `shownotes` is validated by the zod schema (`rawSetlistRowCensus.shownotes: z.string()`) and read by `census.ts`'s tease-hunt, but `normalizeCorpus` never copies it onto `Performance` or `NormalizedShow` — it is silently dropped once normalization runs. Any future feature that wants to surface show-level prose (e.g., "why is this setlist marked incomplete") will need a full corpus re-fetch/re-normalize rather than reading the already-committed artifact, because the data was never retained.
**Fix:** Either add a `shownotes: string` field to `NormalizedShow` (it's a show-level attribute, not per-performance — every row in a show carries the identical string) populated from `firstRow.shownotes` in `normalize.ts`, or explicitly narrow docs/SCHEMA.md §12's scope to "ingestion" only and note that `shownotes` is intentionally excluded from the normalized artifact by design.

### WR-02: `mergeFetchMeta` swallows ALL read/parse errors, not just "file doesn't exist" — silent metadata loss on corruption

**File:** `packages/core/src/cli/fetch-corpus.ts:99-109`
**Issue:**
```ts
try {
  existing = JSON.parse(await readFile(metaPath, "utf8"));
} catch {
  // No existing fetch-meta.json yet (first run) — start fresh.
}
```
This catch is unconditional — a corrupted `fetch-meta.json` (bad JSON), a permissions error, or any other read failure is treated identically to "file doesn't exist," and the existing fetch history is silently discarded and overwritten with just this run's entries. The sibling CLI (`generate-tuning-tags.ts:84-91`) gets this right by checking `err.code !== "ENOENT"` and re-throwing everything else. This inconsistency means a corrupted meta file (e.g. from an interrupted write) loses all prior `fetchedAt`/`rowCount` provenance without any error surfaced to the owner.
**Fix:**
```ts
try {
  existing = JSON.parse(await readFile(metaPath, "utf8"));
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
    throw err;
  }
}
```

### WR-03: `fetchJson` doesn't name the endpoint on network/timeout/JSON-parse failures, unlike its own HTTP-status and API-error branches

**File:** `packages/core/src/cli/fetch-corpus.ts:51-70`
**Issue:** The function's own doc comment and the module header claim "a hard failure names the endpoint and the exact reason so the owner can diagnose" (D-07). This is true for the two explicit branches (`!res.ok`, `body.error`), but if `deps.fetch(...)` itself throws (DNS failure, `AbortSignal.timeout` firing, connection reset) or `res.json()` throws (non-JSON response body), the raw error propagates with no mention of which endpoint/path failed. Given D-07 explicitly forbids automatic retries and relies entirely on clear failure messages for the owner to diagnose and re-run the correct `--year`, this is a real gap in exactly the failure modes retries would otherwise have masked.
**Fix:** Wrap the fetch + json-parse in a try/catch that re-throws with the path prepended, e.g. `catch (err) { throw new Error(\`Request to ${path} failed: ${(err as Error).message}\`); }`.

### WR-04: `--input`/`--out` CLI flags accept no value silently (unlike `--year`, which is explicitly validated per security V5)

**File:** `packages/core/src/cli/normalize-corpus.ts:100-112`, `packages/core/src/cli/run-census.ts:194-201`, `packages/core/src/cli/refresh.ts:102-106`
**Issue:** `--year`'s value is validated by `validateYearArg` before any use (explicitly called out as the security-V5 mitigation in the module header). `--input` and `--out` — which flow directly into `readdir`/`readFile`/`writeFile`/`mkdir` — have no equivalent validation: `argv[++i]` on a trailing flag with no value silently assigns `undefined` to a variable typed `string`, producing a confusing low-level Node `TypeError` deep inside `fs` rather than the project's own clear "Invalid --input value" convention.
**Fix:** Add the same guard pattern used for `--year`:
```ts
function requireValue(argv: string[], i: number, flagName: string): string {
  const value = argv[i];
  if (value === undefined) throw new Error(`${flagName} requires a value.`);
  return value;
}
```

### WR-05: Census-mode row validation (`fetch-corpus.ts`, `census.ts`) doesn't use `formatRowError`, unlike `normalize.ts`

**File:** `packages/core/src/cli/fetch-corpus.ts:151`, `packages/core/src/ingest/census.ts:155`
**Issue:** `normalize.ts:97-106` wraps every `rawSetlistRowLocked.parse(row)` call in a try/catch that converts a `ZodError` into a message naming the show via `formatRowError` — described in `api-types.ts` as "the project-wide failure-UX convention every later ingestion phase copies." Both `fetch-corpus.ts` (`rawSetlistRowCensus.parse(row)`) and `census.ts` (`rawSetlistRowCensus.parse(row)`) call `.parse()` directly with no such wrapping, so a validation failure during a fetch or a census run produces a raw Zod error with no show/endpoint context — exactly the debuggability gap the convention exists to prevent.
**Fix:** Apply the same try/catch + `formatRowError` pattern at both call sites.

### WR-06: `findMatchedAlbumTitles`'s name-based fallback match can cross-contaminate tuning-family data between distinct catalog songs that share an exact name

**File:** `packages/core/src/ingest/tuning-tags.ts:150-167`
**Issue:** When no album row's slug (derived from `song_url`) matches a catalog song, the function falls back to `row.song_name.toLowerCase() === song.name.toLowerCase()`. The real catalog (`data/census.json`) contains multiple distinct `song_id`s sharing an identical name — e.g. "Jam" (song_id 177, 439), "Bit" (song_id 107, 108, 110), "Ghost" (song_id 270, 381). Today this doesn't manifest a visible bug because each of these currently resolves via the slug path independently (verified: `data/tuning-tags.json`'s entries for these song_ids have different `needsReview`/`family` values, meaning slug-matching succeeded for each). But the fallback path has no defense against a *future* regeneration where one of these duplicate-named songs lacks a slug match in `albums.json` — it would then silently borrow an album match (and therefore a tuning-family default) intended for a different song with the same name.
**Fix:** Either drop the name-based fallback (it's explicitly described as "none observed in practice, kept as a safety net" in the existing comment) or restrict it to only fire when the catalog contains exactly one song with that name, else fall through to the "no match, needsReview: true" path.

## Info

### IN-01: `censusField`'s sort is lexicographic (string) even for numeric fields, which would misorder any future two-digit value

**File:** `packages/core/src/ingest/census.ts:132`
**Issue:** `result.sort((a, b) => String(a.value).localeCompare(String(b.value)))` sorts every field's values as strings. This is harmless today because the only numeric field (`transition_id`) tops out at 6 (single digit), but it's a latent bug: a future value of 10+ would sort before "2" lexicographically ("10" < "2" as strings).
**Fix:** Sort numerically when `typeof a.value === "number"`, falling back to `localeCompare` for strings.

### IN-02: Inconsistent process-exit convention across CLI entry points

**File:** `packages/core/src/cli/normalize-corpus.ts:124`, `packages/core/src/cli/run-census.ts:216`, `packages/core/src/cli/generate-tuning-tags.ts:129`, vs. `packages/core/src/cli/refresh.ts:137,180`
**Issue:** Three of the four CLI entry points call `process.exit(1)` on error (abrupt, can truncate buffered stdout/stderr on some platforms), while `refresh.ts` uses the gentler `process.exitCode = 1; return;`. Pick one convention project-wide.
**Fix:** Standardize on `process.exitCode = 1;` (allowing pending I/O to flush) across all CLI wrappers.

### IN-03: Owner's personal email is hardcoded into the committed User-Agent string

**File:** `packages/core/src/config.ts:20`
**Issue:** `userAgent: "Guezzer setlist tool (matt.f.wilson@gmail.com)"` is intentional per D-07 (a descriptive User-Agent naming project + owner contact, for API etiquette), but this file will be committed to a repo that CLAUDE.md says deploys to Vercel/Netlify/GitHub Pages — worth a conscious check that the source repo itself isn't public if that email address shouldn't be publicly associated with this project.
**Fix:** No code change needed if this is an accepted tradeoff; flagging only so it's a deliberate decision rather than an oversight.

### IN-04: Census's distinct-song count (265) and the normalized corpus's song count (264) differ with no code comment explaining why

**File:** `data/census-report.md:258-259` vs `data/normalized/corpus.json:6`
**Issue:** Verified this is *not* a bug — one song (song_id 236) appears only in a "Live Session" show, which the census counts (it doesn't apply the settype allowlist) but `normalizeCorpus` excludes (D-16). The numbers are both correct for their respective scopes, but nothing in `census.ts`, `run-census.ts`, or docs/SCHEMA.md calls out that these two "distinct song count" figures are expected to differ and why — a future reader cross-referencing the two artifacts could reasonably conclude one of them is wrong.
**Fix:** Add a one-line comment/note wherever both counts are surfaced (e.g. in the census report's "corpus totals" section) clarifying that this count intentionally includes Live-Session-only songs while the normalized corpus's `songCount` does not.

### IN-05: No test coverage for the CLI orchestration layer beyond `parseRefreshArgs`

**File:** `packages/core/src/cli/generate-tuning-tags.ts`, `packages/core/src/cli/normalize-corpus.ts`, `packages/core/src/cli/run-census.ts`, `packages/core/src/cli/refresh.ts`
**Issue:** Every pure ingest function (`normalizeCorpus`, `runCensus`, `generateTuningTags`, `mergeTuningTags`, `assertFilterApplied`) has direct unit tests, and `fetch.test.ts` covers `fetchCorpus`/`fetchJson`/`parseRefreshArgs`. But `runGenerateTuningTags`, `runNormalizeCorpus`'s CLI-level `extractRows`/`parseArgs`, `runCensusCli`'s `loadRowsByFile`/`parseArgs`, and `refresh.ts`'s `main()` orchestration (including the error-handling/exit-code paths flagged in WR-04/IN-02) have no test coverage at all.
**Fix:** Not blocking for this phase (these are thin, mostly-I/O wrappers), but worth adding at least one integration test per CLI exercising a temp-directory round trip, given these are the only code paths a future contributor will actually invoke via `npm run refresh`.

---

_Reviewed: 2026-07-08T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

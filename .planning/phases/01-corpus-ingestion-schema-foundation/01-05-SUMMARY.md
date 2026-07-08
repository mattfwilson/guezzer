---
phase: 01-corpus-ingestion-schema-foundation
plan: 05
subsystem: data
tags: [zod, tuning-family, tagging, albums-join, append-only-merge]

requires:
  - phase: 01-04
    provides: locked normalize.ts, final data/normalized/corpus.json artifact (738 shows, 264 songs)
provides:
  - "data/tuning-tags.json — the owner-editable DATA-04 tagging file, one entry per catalog song (264), album-derived defaults + needsReview flag, ready for hand-fill of only the flagged subset"
  - "packages/core/src/ingest/tuning-tags.ts — pure generateTuningTags/mergeTuningTags/deriveCatalogFromCorpus + tuningTagsFileSchema (D-01..D-04, closed 4-value family vocabulary)"
  - "packages/core/src/cli/generate-tuning-tags.ts — CLI reading corpus + albums.json + existing tags file, writing the merged result with an additions summary"
  - "config.microtonalAlbums seed map (Flying Microtonal Banana, K.G., L.W.)"
affects: [phase-2-matrix-builder]

tech-stack:
  added: []
  patterns:
    - "Album join via song_url slug (never song_id — albums.json has none), with a case-insensitive song-name fallback"
    - "Live-album releases (islive === 1) are excluded from the tuning-family join entirely — a live recording carries no signal about which record a song was written for; verified against the real corpus where a heavily-toured song otherwise accumulates a dozen-plus spurious live-album matches"
    - "Tie-break precedence: on a count-tied conflict between a 'standard' default and an explicit non-default ('microtonal') default, the specific signal wins — 'standard' means 'no seed-album evidence', not a competing positive claim. The conflict is still flagged needsReview: true regardless of which value wins the tie"
    - "D-04 append-only merge is a reference-copy of existing entries (never re-derived, never field-rewritten) — the byte-for-byte survival guarantee comes from object identity, not a diff/patch algorithm"

key-files:
  created:
    - packages/core/src/ingest/tuning-tags.ts
    - packages/core/src/cli/generate-tuning-tags.ts
    - packages/core/test/tuning-tags.test.ts
    - data/tuning-tags.json
  modified:
    - packages/core/src/config.ts (added microtonalAlbums seed map)
    - packages/core/src/index.ts (exported TuningFamily/TuningTagEntry/generateTuningTags/mergeTuningTags for Phase 2)

key-decisions:
  - "Live-album releases (islive === 1) are excluded from the album join before slug/name matching — discovered as a Rule 1 bug while running Task 2 against the real corpus (see Deviations)"
  - "Tie-break on conflicting album defaults prefers the non-'standard' value rather than 'first-encountered' — 'standard' is a fallback for unrecognized albums, not a positive assertion, so it should never silently outvote an explicit microtonal-seed match on a plain count tie. The conflict is still flagged for review either way"
  - "cs-standard and other are never auto-assigned by the generator (D-03) — they only ever enter the file via a hand-edit, which mergeTuningTags preserves verbatim"

patterns-established:
  - "Album-metadata joins over kglw.net's albums.json must filter islive === 0 before matching — any future ingestion code that reads albums.json for per-song metadata should apply the same filter or explicitly justify not doing so"

requirements-completed: [DATA-04]

duration: ~25min
completed: 2026-07-08
---

# Phase 1 Plan 5: Tuning-Family Tagging File Summary

**Pure album-derived tuning-family generator (standard / cs-standard / microtonal / other) with an append-only merge that never clobbers owner hand-edits, producing the full 264-song `data/tuning-tags.json` — the last Phase-1 deliverable and DATA-04 complete.**

## Performance

- **Duration:** ~25 min (RED/GREEN TDD pair + 1 Rule-1 bug-fix commit)
- **Started:** 2026-07-08T17:53:00-04:00 (approx, session-continuous with plan 01-04)
- **Completed:** 2026-07-08T18:12:00-04:00
- **Tasks:** 2/2 completed
- **Files modified:** 7 (2 new source files, 1 new test file, 1 new data artifact, 2 modified source files, 1 requirements doc)

## Accomplishments

- **Task 1 — Pure generator + append-only merge, TDD RED then GREEN:** `packages/core/src/ingest/tuning-tags.ts` implements `deriveCatalogFromCorpus` (distinct non-placeholder songs from the normalized corpus — never the raw songs table, which has no `artist_id`), `generateTuningTags` (album join via `song_url` slug with a case-insensitive name fallback, `config.microtonalAlbums` seed rule, `needsReview` on no-match/conflict/cover per D-02), `mergeTuningTags` (D-04 reference-preserving append-only merge), and `tuningTagsFileSchema` (D-03's closed 4-value vocabulary + duplicate-songId rejection). All 6 specified behavior tests pass, plus one added regression test (see Deviations). Full suite green (60/60), `tsc --noEmit` clean on both packages.
- **Task 2 — Full-catalog `data/tuning-tags.json` generated, committed, and proven idempotent:** Ran the CLI against the final committed corpus (264 songs) and `data/raw/albums.json`. 264 entries, 17 microtonal, 52 needsReview (19.7% — well under the 60% ceiling), zero `hand-tagged` entries (first run). Re-ran the CLI a second time immediately: zero git diff, proving D-04's append-only contract live, not just in a unit test.
- **Real-data quality check beyond the plan's stated acceptance criteria:** Cross-referenced the 264-entry output against every song independently known to appear on the three seed microtonal albums (27 real catalog songs, excluding the album-title-as-song-name false match). Result: 17 correctly auto-tagged `microtonal`, 10 imperfectly defaulted to `standard` but flagged `needsReview: true`, **0 silently wrong-and-unflagged**. This is the D-02 invariant that matters — the owner's hand-review subset (52 songs, 19.7% of the catalog) is small and catches every known misclassification.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Add failing tests for tuning-tags generator + merge** - `a3b10fa` (test)
1. **Task 1 (GREEN): Implement tuning-tags generator + append-only merge** - `bcd52eb` (feat)
1. **Task 1 (deviation fix, discovered running Task 2): Exclude live-album rows from the join, fix tie-break precedence** - `51bbbb5` (fix) — this commit also contains Task 2's generated `data/tuning-tags.json`, since the bug was found and fixed while running Task 2's CLI against the real corpus, before the artifact was ever committed in its buggy form. No buggy version of the data file was ever committed.

**Plan metadata:** (this commit, see below)

_Note: Task 1 was TDD (`tdd="true"`) — verified genuine RED by temporarily relocating the implementation files, confirming the test suite failed to resolve the import, then restoring and confirming GREEN (60/60, including 6 pre-existing suites unaffected)._

## Files Created/Modified

- `packages/core/src/ingest/tuning-tags.ts` - pure generator/merge/schema (D-01..D-04)
- `packages/core/src/cli/generate-tuning-tags.ts` - CLI: corpus + albums.json + existing tags file → merged file + additions summary
- `packages/core/test/tuning-tags.test.ts` - 6 specified behavior tests + 1 live-album regression test
- `packages/core/src/config.ts` - added `microtonalAlbums` seed map (A1)
- `packages/core/src/index.ts` - exported `TuningFamily`, `TuningTagEntry`, `generateTuningTags`, `mergeTuningTags` for Phase 2
- `data/tuning-tags.json` - the generated, committed, owner-editable tagging file (264 entries)
- `.planning/REQUIREMENTS.md` - marked DATA-04 complete (checkbox + traceability table)

## Decisions Made

- **Live-album exclusion in the album join:** `islive === 1` rows are filtered out before slug/name matching. A live recording says nothing about which studio record (and therefore which tuning family) a song was written for; including them let a heavily-toured song's dozen-plus "Live In `<city>`" album rows outvote its one real studio-album match.
- **Tie-break prefers the specific signal:** when a song's matched albums carry both a "standard" default (e.g. a promotional single release) and an explicit "microtonal" default (the parent studio album), the resolver now prefers "microtonal" rather than whichever was encountered first. "standard" here means "no seed-album evidence," not a competing claim, and should never silently outvote an explicit match on a plain count tie. The conflict is still flagged `needsReview: true` either way — this only improves the *default*, not the review-flag behavior.
- **cs-standard/other never auto-assigned:** confirmed by design and by Test 5 (`cs-standard` only ever enters the file via a hand-edit, which the merge preserves byte-for-byte).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Live-album rows and a naive tie-break caused the generator to badly undercount microtonal songs on the real corpus**
- **Found during:** Task 2 (first CLI run against the full corpus and `data/raw/albums.json`)
- **Issue:** The initial `findMatchedAlbumTitles` matched every `albums.json` row sharing a song's slug, with no filter on release type. A heavily-toured song like "Rattlesnake" matched 16 distinct "Live In `<city>`" album titles (all defaulting to `standard`) plus its 2 real non-live matches ("Rattlesnake (Single)" → standard, "Flying Microtonal Banana" → microtonal) — the live-album noise, combined with a first-encountered tie-break, drove the result to `standard` for nearly every microtonal-era song. First full-catalog run produced only 4 microtonal entries against an expected several dozen, failing the plan's own `micro > 10` acceptance gate.
- **Fix:** (a) `findMatchedAlbumTitles` now filters to `islive === 0` before slug/name matching — added `islive` to `albumRowSchema`. (b) `resolveFamily`'s conflict tie-break now prefers the non-`standard` value over a plain first-encountered rule, since `standard` represents "no seed-album evidence" rather than a competing positive claim; the conflict remains flagged `needsReview: true` regardless of which value the tie-break selects.
- **Files modified:** `packages/core/src/ingest/tuning-tags.ts`, `packages/core/test/tuning-tags.test.ts` (added a live-album-exclusion regression test; updated Test 3's conflicting-case assertion to the corrected tie-break outcome, with an expanded comment explaining the real-world single-vs-album shape this models)
- **Verification:** Full suite green (60/60); `tsc --noEmit` clean; re-ran the CLI against the real corpus — 17 microtonal entries (was 4), 52 needsReview (19.7%, under the 60% ceiling); cross-checked against every known real microtonal-album song (27 songs): 17 correct, 10 imperfect-but-flagged, 0 silently wrong.
- **Committed in:** `51bbbb5` (also contains the first, already-correct `data/tuning-tags.json` — the buggy version was never committed)

---

**Total deviations:** 1 auto-fixed (Rule 1 bug fix, found and resolved while executing Task 2 as written — the plan's own acceptance criteria caught the defect before any bad data was committed)
**Impact on plan:** Necessary to meet the plan's own Task 2 acceptance criteria (`micro > 10`, `needsReview < 60%`). No scope creep — no functionality was added beyond correcting a genuine defect in the album-join heuristic, discovered by running the plan's own verification script against real data exactly as specified.

## Issues Encountered

None beyond the deviation above, resolved on the first fix attempt.

## User Setup Required

None — no external service configuration required. This plan touches only committed data (`data/normalized/corpus.json`, `data/raw/albums.json`) and pure TypeScript.

## Next Phase Readiness

- `data/tuning-tags.json` is committed and idempotent: 264 entries (matches `corpus.songCount` exactly), closed 4-value family vocabulary zod-enforced, 52 needsReview (19.7%) — a realistic subset for the owner to hand-check before relying on tuning-family affinity in Phase 2's backoff tier.
- Phase 2's MODL-08/09 backoff tier can import `TuningFamily`/`TuningTagEntry`/`generateTuningTags`/`mergeTuningTags` directly from `@guezzer/core`'s public barrel.
- Owner action recommended before Phase 2 backtest: spot-check the 52 `needsReview` entries (particularly the 10 known-imperfect microtonal-adjacent songs identified in this plan's real-data quality check) and hand-edit any that should be `cs-standard` or a corrected `microtonal`/`standard` call — hand-edits are permanently safe against regeneration (D-04, byte-for-byte verified).
- No blockers. DATA-04 complete — this was the last Phase-1 deliverable per the plan's own objective statement.

## Self-Check: PASSED

Verified on disk: `packages/core/src/ingest/tuning-tags.ts`, `packages/core/src/cli/generate-tuning-tags.ts`, `packages/core/test/tuning-tags.test.ts`, `data/tuning-tags.json` (264 entries, `schemaVersion: 1`), `packages/core/src/config.ts` (`microtonalAlbums` present), `packages/core/src/index.ts` (new exports present). Verified in git log: `a3b10fa` (test), `bcd52eb` (feat), `51bbbb5` (fix, includes data artifact) — all three present in `git log --oneline`. Full test suite 60/60 green; `tsc --noEmit` clean on `packages/core/tsconfig.json`; idempotence re-verified (`git diff --quiet data/tuning-tags.json` after a fresh re-run).

---
*Phase: 01-corpus-ingestion-schema-foundation*
*Completed: 2026-07-08*

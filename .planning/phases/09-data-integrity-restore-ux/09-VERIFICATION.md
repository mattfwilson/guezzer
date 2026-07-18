---
phase: 09-data-integrity-restore-ux
verified: 2026-07-18T18:00:00Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
---

# Phase 9: Data Integrity & Restore UX Verification Report

**Phase Goal:** Ingested show data preserves everything a future feature will need, and an owner can never fail to recover their own backup on a fresh or evicted database.
**Verified:** 2026-07-18T18:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

Merged roadmap Success Criteria (3) + PLAN frontmatter must-haves (8 truths across 2 plans, deduplicated).

| #   | Truth (source) | Status | Evidence |
| --- | -------------- | ------ | -------- |
| 1 | shownotes carried verbatim through ingestion AND normalization into `NormalizedShow` per SCHEMA §12 (SC-1, D-02) | ✓ VERIFIED | `types.ts:80` `shownotes: string;` with §12 untrusted-verbatim doc comment (lines 72-79); `normalize.ts:254` `shownotes: sortedRows[0].shownotes` — zero transformation; ingestion `z.string()` pre-existing |
| 2 | Automated test asserts shownotes survives normalization end-to-end (SC-2) | ✓ VERIFIED | `normalize.test.ts:287` Fixture E asserts `corpus.shows[0].shownotes` === raw `pos1RawRow.shownotes` (raw→domain exact equality, not a hardcoded literal). 45 tests pass. |
| 3 | Within-show shownotes disagreement recorded in NormalizeStats, never throws (D-01) | ✓ VERIFIED | `normalize.ts:181-183` pushes `{showId, showDate}` to `showsWithShownotesDisagreement`, no throw; Test 10 proves record + no-throw + position-1 wins; Test 11 proves agreement not recorded |
| 4 | corpus.json carries shownotes for every show, schemaVersion stays 1 (D-04, D-05) | ✓ VERIFIED | `grep -c '"shownotes"'` = 738 (all shows); `"schemaVersion": 1` unchanged in corpus.json and types.ts (lines 90, 149, 252) |
| 5 | archive.json byte-identical + matrix diff provenance-only (D-06) | ✓ VERIFIED | Phase commit `1f63c0f` changed only corpus.json + transition-matrix.json under `data/`; archive.json NOT touched. Matrix diff excl. generatedAt + headers = 0 content lines. archive.json has 0 shownotes hits. |
| 6 | Evicted DB (local owner unset) + typing file's own owner name reaches merge path — proven by component test (SC-3, PWA-05) | ✓ VERIFIED | `settingsOwner.test.tsx:223` — file owned "Matt", local owner unset, type "matt" + `namePromptConfirm` → `pickAndImportMock` called once, `importSuccessHeading` renders, no compare banner |
| 7 | Real (unmocked) pickAndImport merge on evicted DB is a union — local rows survive AND file rows added (PWA-05) | ✓ VERIFIED | `importFork.test.ts:155` — seeds attendedShows(111)+trackedShows(s-local), real `pickAndImport`, asserts 111+222 present, s-local kept, ownerName meta stays unset |
| 8 | isTypedNameMine is a pure, directly unit-tested decision covering case/whitespace/empty/file-owner-leg edges (PWA-05) | ✓ VERIFIED | `ownerMatch.ts` pure fn (no React/DOM/Dexie imports); `ownerMatch.test.ts` 6 edge unit tests, all green |
| 9 | Zero behavior/copy changes to prompt UX — routing byte-equivalent (D-03) | ✓ VERIFIED | `importPicker.ts` last touched by `fcbfbdc` (pre-phase quick fix), unchanged by phase 09; only `SettingsView.tsx` delegation (line 124) + new `ownerMatch.ts` touch `src` |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/core/src/domain/types.ts` | `NormalizedShow.shownotes: string` + §12 doc | ✓ VERIFIED | `shownotes: string;` at line 80, full untrusted-verbatim doc comment |
| `packages/core/src/ingest/normalize.ts` | carry + disagreement stats counter | ✓ VERIFIED | `showsWithShownotesDisagreement` field + accumulator + push (no throw); carry from `sortedRows[0]` |
| `packages/core/src/cli/normalize-corpus.ts` | CLI prints disagreement count | ✓ VERIFIED | `formatNormalizeSummary` appends `Shownotes disagreements: N (...)` (line 95) |
| `packages/core/test/normalize.test.ts` | e2e verbatim + synthetic edge tests | ✓ VERIFIED | Tests 9-12 + Fixture E; asserts against fixture's own raw value |
| `data/normalized/corpus.json` | regenerated w/ shownotes (D-05) | ✓ VERIFIED | 738 shownotes entries, schemaVersion 1, +740 insertions in phase commit |
| `packages/app/src/settings/ownerMatch.ts` | pure `isTypedNameMine` helper | ✓ VERIFIED | exports `isTypedNameMine`, zero React/DOM/Dexie imports |
| `packages/app/test/ownerMatch.test.ts` | flat per-edge unit tests | ✓ VERIFIED | 6 tests, all edges, green |
| `packages/app/test/settingsOwner.test.tsx` | typed-name → merge component test | ✓ VERIFIED | `pickAndImportMock` present; PWA-05 test at line 223 |
| `packages/app/test/importFork.test.ts` | real-Dexie union merge proof | ✓ VERIFIED | `isTypedNameMine` imported + wired to real merge; PWA-05 test at line 155 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| normalize.ts | types.ts | `shownotes: sortedRows[0].shownotes` | ✓ WIRED | Position-sorted first row, not `firstRow` |
| normalize-corpus.ts | normalize.ts | prints `stats.showsWithShownotesDisagreement` | ✓ WIRED | Line 91/95 |
| normalize.test.ts | fixtures/2022-rr1010-multiset.json | raw-row → domain exact equality | ✓ WIRED | Fixture E line 296 |
| SettingsView.tsx | ownerMatch.ts | `resolveNamePrompt` delegates `isTypedNameMine` | ✓ WIRED | Import line 34, call line 124; inline isMine removed |
| settingsOwner.test.tsx | SettingsView.tsx | typed-name change + `namePromptConfirm` → `pickAndImportMock` | ✓ WIRED | Line 237-241 |
| importFork.test.ts | importPicker.ts | real `pickAndImport` on evicted DB | ✓ WIRED | Line 186 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase 09 test suite (all 4 files) | `npx vitest run` (normalize, ownerMatch, settingsOwner, importFork) | 4 files, 45 tests passed | ✓ PASS |
| corpus shownotes coverage | `grep -c '"shownotes"' corpus.json` | 738 | ✓ PASS |
| archive D-06 isolation | `grep -c '"shownotes"' archive.json` | 0 | ✓ PASS |
| matrix provenance-only diff | `git diff -U0 1f63c0f^ 1f63c0f matrix \| filter` | 0 content lines | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| DATA-06 | 09-01 | shownotes carried verbatim through ingestion + normalization, e2e test | ✓ SATISFIED | Truths 1-5; REQUIREMENTS.md line 68 maps to Phase 9 |
| PWA-05 | 09-02 | evicted-DB typed-name reaches merge path, no data drop | ✓ SATISFIED | Truths 6-9; REQUIREMENTS.md line 69 maps to Phase 9 |

No orphaned requirements — REQUIREMENTS.md maps exactly DATA-06 and PWA-05 to Phase 9, both claimed by plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | None | — | No TBD/FIXME/XXX/HACK/PLACEHOLDER/TODO in any modified source; working tree clean |

### Human Verification Required

None. This is a data/test-hardening phase with no new user-facing features (UI/UX explicitly out of scope per 09-CONTEXT). Both plans are all `type="auto"` with `<automated>` verification only — no `checkpoint:human-verify` tasks and no deferred `<human-check>` blocks. The PWA-05 restore path is proven by a component test (prompt → typed name → merge route fires) and a real-Dexie union-merge integration test; no runtime/visual behavior requires human confirmation.

### Gaps Summary

No gaps. All 9 must-haves (3 roadmap Success Criteria + 8 plan truths, deduplicated) are VERIFIED against the codebase, not merely against SUMMARY claims:

- DATA-06: `shownotes` flows raw row → `NormalizedShow` byte-for-byte with position-1-wins semantics and a non-throwing D-01 disagreement counter; corpus.json carries it on all 738 shows at schemaVersion 1; the bundled archive is byte-identical (D-06 proven by commit-scope + zero-hit grep) and the matrix diff is provenance-only.
- PWA-05: the typed-name "it's mine" decision is a pure unit-tested helper, the evicted-DB merge route is component-proven, and the real union merge provably preserves every local row while adding the file's rows — with owner meta correctly left unset.

Full phase test suite green (45/45 in the phase-scoped run; 571/571 reported for full `vitest run`). No anti-patterns, no debt markers, clean working tree.

---

_Verified: 2026-07-18T18:00:00Z_
_Verifier: Claude (gsd-verifier)_

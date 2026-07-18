# Phase 9: Data Integrity & Restore UX - Context

**Gathered:** 2026-07-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Two hardening items in core/data, no new user-facing features:

1. **DATA-06** — `shownotes` is carried verbatim through ingestion AND normalization into the domain model (`NormalizedShow`), per `docs/SCHEMA.md` §12, with an automated test asserting it survives normalization end-to-end. Resolves audit WR-01 so a future show-level-prose feature needs no full re-normalize.
2. **PWA-05** — On a fresh/evicted DB (owner name unset), typing your own owner name into the "Whose dex is this?" prompt reaches the merge/restore path and merges the backup without dropping local data. The *behavior* already landed in commit `e08ceee` (2026-07-18); this phase proves it with automated tests and closes the requirement.

Out of scope: any UI/UX changes, new model signals, backend anything, the three reviewed-but-not-folded UI todos (see Deferred).

</domain>

<decisions>
## Implementation Decisions

### Shownotes carry policy (DATA-06)
- **D-01: Within-show disagreement → first-row-wins + stats counter.** `shownotes` is show-level prose denormalized onto every row; if rows within one show disagree, take the position-1 row's value and record the disagreement in `NormalizeStats` so it's visible in build output. Do NOT hard-fail (unlike the `settype` mixed-value precedent) — prose is non-structural (D-15 ethos: malformed editor data costs nothing structurally), and a cosmetic mismatch must never break a future corpus refresh.
- **D-02: Verbatim = byte-for-byte, zero transformation.** No trim, no HTML stripping, `\r\n` preserved, empty string carried as `""` (not coerced to null). The end-to-end test asserts exact raw→domain equality. The value is untrusted content — carry verbatim, never render (`docs/SCHEMA.md` §12).

### PWA-05 remaining scope
- **D-03: Tests only — no UX/copy changes.** The typed-name restore path exists (commit `e08ceee`: `resolveNamePrompt` matches the typed name against the FILE's owner as well as the local owner). Phase 9 adds the missing automated coverage: evicted DB (local owner unset) + typed own name → merge path invoked, local data preserved (union merge, nothing dropped). Then the requirement is closed. No prompt copy hints, no owner-name surfacing.

### Corpus artifact & versioning
- **D-04: Keep `schemaVersion: 1`.** Adding `shownotes` to `NormalizedShow` is additive; existing consumers (matrix builder, archive builder, app loaders) ignore it. All `schemaVersion === 1` guards keep working — zero consumer ripple. The stated rule ("bump only on breaking shape changes") holds.
- **D-05: `shownotes` lives IN `data/normalized/corpus.json`, accept growth.** It becomes a field on `NormalizedShow` in the one canonical artifact — the literal reading of DATA-06 ("into the domain model"). Committed-file growth (~1 MB ballpark on today's 4.7 MB) is accepted. No sibling artifact.
- **D-06: App bundle MUST stay untouched.** The bundled archive is at 242 KB of its 250 KB budget-guard (A6); `shownotes` must NOT flow into `deriveArchive`'s output or any bundled artifact. Corpus is build-side only.

### Claude's Discretion
- **PWA-05 test shape** — user chose "you decide": likely extract the `isMine` name-match decision from `SettingsView.resolveNamePrompt` into a small pure helper (mirrors `classifyImport`'s style) for direct unit tests of case/whitespace edges, plus one component-level test of the full prompt→merge wiring. Component-only is also acceptable if extraction fights the code.
- Whether to regenerate `corpus.json` (and re-run downstream builders to prove byte-stable outputs) inside this phase — planner decides; regeneration is the natural way to prove D-05 end-to-end.
- Test fixture strategy for the shownotes end-to-end assertion (existing small fixture setlists in `packages/core/test/fixtures/` are the established pattern).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### DATA-06 (shownotes)
- `docs/SCHEMA.md` §12 (security note: untrusted content, carry verbatim, never render), §8 (footnotes precedent for tolerant prose handling), field table row `shownotes` — the spec DATA-06 names explicitly.
- `packages/core/src/ingest/api-types.ts` — `rawSetlistRowLocked` already validates `shownotes: z.string()` (line ~46); ingestion side is done.
- `packages/core/src/ingest/normalize.ts` — the normalizer that currently DROPS `shownotes`; `NormalizeStats` is where the D-01 disagreement counter goes; `settype` mixed-value hard-fail (do NOT copy for shownotes) and D-15 `parseFootnotesGuarded` (DO copy the tolerant ethos) both live here.
- `packages/core/src/domain/types.ts` — `NormalizedShow` (gains the field) and `NormalizedCorpus` (schemaVersion stays 1).
- `packages/core/src/cli/normalize-corpus.ts` — writes `data/normalized/corpus.json`.
- `packages/core/src/cli/build-archive.ts` — the 250 KB `MAX_ARCHIVE_BYTES` budget guard; proves why shownotes must not reach the bundle (D-06).

### PWA-05 (restore path)
- `.planning/quick/260716-vw2-fix-warning-1-own-backup-restore-misrout/260716-vw2-SUMMARY.md` — the WARNING-1 fix PWA-05 polishes; documents `classifyImport`'s `unowned` widening and names the then-residual typed-name gap.
- `packages/app/src/settings/SettingsView.tsx` — `resolveNamePrompt` (the `isMine` decision: typed name vs local owner OR file owner) and `confirmPromptMine`; commit `e08ceee` is the behavior under test.
- `packages/app/src/settings/importPicker.ts` — `classifyImport` (D-17 fork, `unowned` routing) and `pickAndImport` (atomic merge commit).
- `packages/app/test/settingsOwner.test.tsx` — existing prompt tests (covers the compare route; the merge route is the gap).
- `packages/app/test/importFork.test.ts` — existing `classifyImport` coverage (8 tests, evicted-DB `unowned` cases).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `parseFootnotesGuarded` (normalize.ts) — the D-15 "tolerant prose, never throw" pattern D-01 should mirror in spirit.
- `NormalizeStats` — established stats-reporting struct; the shownotes-disagreement counter is one more field, printed by the existing CLI.
- `packages/core/test/fixtures/*.json` — small fixture setlists with known expected outputs; the established pattern for the DATA-06 end-to-end test.
- `classifyImport` + its test file — pure-decision-function-with-direct-tests style to mirror if the `isMine` logic is extracted.

### Established Patterns
- Core purity: everything DATA-06 touches is in `packages/core` (zero DOM/React); runnable from Node CLI.
- Fail-loud vs carry-tolerant split: structural fields (settype, positions, transition_id vocab) hard-fail; prose (footnotes, and now shownotes) carries verbatim and never throws.
- Committed build artifacts reviewed via `git diff` — deterministic serialization, stable ordering.
- App tests: Vitest jsdom project, component tests render real views (`settingsOwner.test.tsx` precedent).

### Integration Points
- `normalize.ts` → `NormalizedShow` → `data/normalized/corpus.json` (regenerate) → downstream builders (`build-model.ts`, `build-archive.ts`) must produce identical outputs since they ignore the new field — a good invariant to assert if regenerating.
- `SettingsView` prompt → `mergeFile` → `pickAndImport` → `parseAndMergeImport` (core union merge) → `importSnapshot` (one Dexie transaction). The PWA-05 test asserts this route fires from a typed name with local owner unset, and that the merge is a union (local data preserved).

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond the decisions above — open to standard approaches. The owner's posture throughout: smallest-possible hardening pass, robustness over strictness for prose, don't touch working UX.

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
Reviewed against this phase in cross-referencing and deliberately kept pending (all UI, out of scope for a core/data phase):
- **Bottom sheets — smooth up/down animation + always-on-top layering** (`.planning/todos/pending/2026-07-17-bottom-sheets-smooth-up-down-animation-always-on-top-layerin.md`)
- **Readable full-date format "Mon D, YYYY" app-wide** (`.planning/todos/pending/2026-07-17-readable-full-date-format-mon-d-yyyy-app-wide.md`)
- **Final-show share card uses GizzDex totals instead of the show's recap stats** (`.planning/todos/pending/2026-07-18-final-show-share-card-uses-gizzdex-totals.md`)

</deferred>

---

*Phase: 9-Data Integrity & Restore UX*
*Context gathered: 2026-07-18*

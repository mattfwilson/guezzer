---
phase: 09-data-integrity-restore-ux
reviewed: 2026-07-18T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - packages/core/src/domain/types.ts
  - packages/core/src/ingest/normalize.ts
  - packages/core/src/cli/normalize-corpus.ts
  - packages/app/src/settings/ownerMatch.ts
  - packages/app/src/settings/SettingsView.tsx
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-07-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 09 delivers two small, tightly-scoped changes against base `cfb2f793`:

1. **DATA-06 — `shownotes` verbatim carry.** A `shownotes: string` field is added to
   `NormalizedShow`, populated from the position-1 (position-sorted) row, with a
   non-throwing `showsWithShownotesDisagreement` build-log stat and a summary line.
2. **PWA-05 — `isTypedNameMine` extraction.** The "Whose dex is this? → it's mine"
   decision is lifted out of `SettingsView.resolveNamePrompt` into a pure, testable
   `ownerMatch.ts` helper.

I traced both changes for correctness, type consistency, and behavior preservation, and
cross-checked the supporting modules (`api-types.ts`, `importPicker.ts`,
`export-schema.ts`).

Key verifications (all passed):

- **`shownotes` type safety.** The raw schema field is `z.string()` (non-nullable,
  `api-types.ts:46`), so `sortedRows[0].shownotes` is always a `string` — the
  `NormalizedShow.shownotes: string` contract holds with no null/undefined risk.
- **Position-1 sourcing is safe.** The contiguity assertion (`normalize.ts:165-174`)
  guarantees `sortedRows[0].position === 1`, so the "carried from the position-1 row"
  doc comment is enforced, not aspirational. The value is correctly taken from
  `sortedRows[0]` (position-sorted), not `firstRow` (input order) — the comment at
  `normalize.ts:252-254` calls this distinction out and the code matches it.
- **Disagreement stat never throws** (unlike the `settype` mixed-value hard-fail),
  matching the D-01 tolerant-prose intent.
- **`isTypedNameMine` is byte-equivalent** to the removed inline logic. Substituting the
  call args (`typedName=promptName`, `localOwnerName=ownerName ?? null`,
  `fileOwner=namePrompt.envelope.owner`) reproduces the original expression exactly,
  including the load-bearing `answer !== ""` guard and the collapse of
  `((ownerName ?? null) ?? "")` to `(ownerName ?? "")`. No behavior drift.
- **No dead-end restore path.** The typed-name path only recognizes a file as "mine" when
  the file itself is owner-stamped; an unstamped (v1) own-backup after an evicted DB is
  still restorable via the unconditional `confirmPromptMine` "It's mine, restore it"
  button (`SettingsView.tsx:133-138, 302-308`). Verified not a dead-end.
- **No archive leak.** Adding `shownotes` to `NormalizedShow` does not violate the
  "never flows into the bundled archive" invariant — the archive/dex builders construct
  explicit `ArchiveShow`/`strictObject` shapes rather than spreading the whole show
  object, so the new field is not carried through.

No blockers or warnings found. Three low-severity observations follow.

## Narrative Findings (AI reviewer)

### Info

#### IN-01: `showsWithShownotesDisagreement` records identity but not the conflicting values

**File:** `packages/core/src/ingest/normalize.ts:37, 181-183` and `packages/core/src/cli/normalize-corpus.ts:88-96`
**Issue:** The sibling diagnostic `showsExcludedBySettype` records the offending
`settype` value alongside `showId`/`showDate`, so the build log is self-explaining. The
new `showsWithShownotesDisagreement` records only `{ showId, showDate }` — the summary
line prints show IDs but never the conflicting prose. For a stat whose sole purpose is
build-log diagnosability, an operator seeing a disagreement must go re-open the raw data
to learn what actually differed. This is an observability asymmetry, not a correctness
bug (the show ID is enough to locate the record, and prose can be large/multi-line).
**Fix (optional):** If diagnosability matters, capture a short marker of the divergence,
e.g. the distinct-value count or truncated first-two values:
```ts
showsWithShownotesDisagreement.push({
  showId,
  showDate,
  distinctValues: new Set(showRows.map((r) => r.shownotes)).size,
});
```
Otherwise, leave as-is intentionally — the show ID is a sufficient lookup key.

#### IN-02: `isTypedNameMine` third parameter is wider than any real caller supplies

**File:** `packages/app/src/settings/ownerMatch.ts:22-25`
**Issue:** `fileOwner` is typed `string | null | undefined`, but the only production
source is `ExportEnvelope.owner`, which the schema constrains to `string | null`
(`export-schema.ts:125`, `nullable().default(null)`). The extra `| undefined` is
harmless (optional chaining already collapses both null and undefined to `undefined`
internally) but slightly overstates the input domain and could invite callers to pass
`undefined` where the envelope contract says they cannot.
**Fix (optional):** Narrow to `fileOwner: string | null` to match `ExportEnvelope.owner`,
or keep the wider type deliberately as a defensive seam and note it — either is
defensible; flagging only for intentionality.

#### IN-03: File-owner restore leg is a trust decision — confirm it stays "accepted"

**File:** `packages/app/src/settings/ownerMatch.ts:31-34` (leg `file != null && a === file`)
**Issue:** The file-owner leg means: on a device with no local identity (evicted DB), any
typed name that matches the *backup file's own stamped owner* routes to the merge/restore
path. A crafted backup stamped with a name the victim would plausibly type could therefore
be merged into the local dex. This is not new in this diff (the leg was relocated verbatim
from the prior inline code) and it is explicitly documented as accepted threat **T-09-04**
("a personal offline tool for <10 friends"). Recording it here only so the acceptance is a
conscious, reviewed decision rather than an implicit one. No change recommended given the
stated threat model; import validation still runs strict zod shape-gating first
(`importPicker.classifyImport`), so a malformed file is rejected before any fork.
**Fix:** None required — documented and accepted. Re-affirm if the audience ever widens
beyond the trusted friend group.

---

_Reviewed: 2026-07-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

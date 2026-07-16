---
status: resolved
trigger: "CR-01 (06-REVIEW.md): same-show dedupe in parseAndMergeImport silently drops local sightings on multi-device self-merge, violating the D-10 'every local row survives' invariant"
created: 2026-07-15
updated: 2026-07-16
---

## Symptoms

DATA_START
**Expected behavior:** After importing a same-owner snapshot from a second device, every locally-tracked sighting survives the merge (D-10 invariant, merge.ts comments at lines ~16-17, 119). A night tracked on two devices should union both sessions' songs — matching what `deriveDex` would produce if both sessions were present.

**Actual behavior:** `parseAndMergeImport` (packages/core/src/data-safety/merge.ts:166-231) union-merges `trackedEntries` keyed by (sessionId, position), but the D-11 same-night dedupe then picks a single canonical show per night-group (the one with the most entries) and drops EVERY other session's entries via `unionEntries.filter((e) => !droppedSessionIds.has(e.sessionId))`. When the local session is the smaller one, local sightings are permanently erased — `importSnapshot` clear()s `trackedEntries` and re-adds only the merged set. No user-facing indication.

**Error messages:** None — silent data loss.

**Timeline:** Introduced in Phase 06 plan 07 (envelope v2 merge, commit history around 06-07). Found by code review (06-REVIEW.md CR-01, 2026-07-15). Never worked correctly for the two-devices-same-night case.

**Reproduction:** Same owner, two devices at one show:
- Device A (local) tracks night D, session S_A, songs {1,2,3} (3 entries)
- Device B (import) tracks night D, session S_B, songs {4,5,6,7} (4 entries)
- Group key `date:D` contains both; canonical = S_B (4 > 3); S_A dropped
- Local songs {1,2,3} permanently erased from the dex

**Scope notes:** Retro/archive sighting sources and the friend-compare path are unaffected (compare never writes). Under-counting only, never fabrication.

**Reviewer's fix sketch (06-REVIEW.md):** For same-night groups keep one canonical show row but UNION the entries of every session in the group, re-stamping sessionId/position onto the canonical session; de-dupe by songId within the night so a duplicated performance isn't double-counted but a unique song from either device is never dropped. Alternative (if fullest-wins is truly intended): correct the false D-10 comment — reviewer considers this inferior since it accepts silent data loss.
DATA_END

## Current Focus

hypothesis: CONFIRMED — the D-11 same-night dedupe (merge.ts lines 193-218) drops every non-canonical session's entries wholesale via droppedSessionIds filter, instead of unioning unique songs onto the canonical session
test: 3 regression tests added to packages/core/test/merge.test.ts — union survival, no double-count, placeholder preservation. RED confirmed (3 failed / 20 passed pre-fix), GREEN post-fix (23/23). Full suite 465/465, typecheck clean both packages.
expecting: Human confirmation that a real two-device import shows the union in Settings copy + Pokédex
next_action: DONE — user confirmed fixed (two-device round-trip on dev server: profile A's original songs survived the merge, night appears once with the union of both devices' songs). Session archived.

reasoning_checkpoint:
  hypothesis: "merge.ts Step 5 selects one canonical show per attendance group and filters out ALL entries of dropped sessions (unionEntries.filter(!droppedSessionIds.has(...)), line 216-218) — so when the local session has fewer entries than the imported one for the same night, every local-unique song is silently erased on commit (importSnapshot clear()+bulkAdd makes it permanent)"
  confirming_evidence:
    - "merge.ts:207-218 read directly: droppedSessionIds collects every non-canonical sessionId in the group; finalEntries filter removes their entries with no adoption step"
    - "derive-dex.ts:155-167 read directly: deriveDex unions songIds across ALL sessionIds in a night group — proving the correct semantic for a two-device night is per-night songId union, exactly what the merge fails to preserve"
    - "db.ts importSnapshot: trackedEntries.clear() then bulkAdd(merged) — dropped entries are unrecoverable after commit"
  falsification_test: "If finalEntries after a smaller-local/larger-incoming same-night merge contained local songIds {1,2,3}, the hypothesis would be false — regression test will demonstrate they are absent (RED) before the fix"
  fix_rationale: "Adopt dropped sessions' entries onto the canonical session (re-stamp sessionId + fresh positions past canonical max), de-duping by songId within the night so a performance seen by both devices is not double-counted but a unique song from either device always survives. This restores the D-10 invariant at the mechanism level (the filter) rather than patching symptoms. Null-songId entries (placeholders) are always adopted — cannot prove they are duplicates, and D-10 says never drop local rows"
  blind_spots: "added.songs metric uses (sessionId,position) keys which change on re-stamp — must track local provenance by object identity so adopted local entries are not miscounted as 'added'. Position uniqueness required by Dexie [sessionId+position] compound index — fresh positions must start past canonical max. Existing D-11 tests use songId=1 fixtures everywhere so they still pass (duplicate songId → correctly not adopted)"

## Evidence

- timestamp: 2026-07-15
  checked: packages/core/src/data-safety/merge.ts (full read)
  found: Step 5 (lines 166-218) picks canonical per group by entry count (WR-01 local tie-break), collects all other sessionIds into droppedSessionIds, then finalEntries = unionEntries.filter(e => !droppedSessionIds.has(e.sessionId)). No adoption/union of dropped sessions' entries.
  implication: Defect exists exactly as reviewed — local-unique songs on the smaller session are erased.

- timestamp: 2026-07-15
  checked: packages/core/src/dex/derive-dex.ts (full read)
  found: deriveDex groups shows by the same attendanceGroupKey and unions songIds across ALL sessionIds in a group (Set per night, placeholders/null songIds skipped, per-night dedupe by songId).
  implication: The correct merge semantic is per-night songId union — matches reviewer's fix sketch. De-dupe by songId within the night is dex-equivalent.

- timestamp: 2026-07-15
  checked: packages/app/src/db/db.ts (importSnapshot, addEntry, Dexie schema)
  found: trackedEntries schema is "++id, sessionId, [sessionId+position]"; importSnapshot does trackedEntries.clear() then bulkAdd(merged). addEntry derives next position as max+1.
  implication: Loss is permanent after commit; adopted entries must get unique positions on the canonical session (start at canonical max+1, matching addEntry's max+1 idiom).

- timestamp: 2026-07-15
  checked: packages/core/test/merge.test.ts (full read)
  found: All D-11 fixtures use default songId=1 for every entry. Under the union fix, cross-session duplicates by songId are still not adopted, so all existing tests (incl. WR-01 tie-break) keep passing unchanged. addedSongs metric computed from (sessionId,position) keys vs local set.
  implication: Fix is behavior-compatible with existing suite; new regression test must use DISTINCT songIds to expose the bug. Metric needs provenance tracking so re-stamped local entries aren't counted as added.

## Eliminated

## Resolution

root_cause: parseAndMergeImport's D-11 same-night dedupe (merge.ts Step 5) selected one canonical show per attendance group and then removed EVERY other session's entries via `unionEntries.filter((e) => !droppedSessionIds.has(e.sessionId))` — no adoption step existed. When the local session had fewer entries than the imported same-owner session for the same night, all local-unique sightings were silently discarded; importSnapshot's clear()+bulkAdd then made the loss permanent. This violated the D-10 "every local row survives" invariant that the module's own comments claimed to uphold.
fix: Step 5 now ADOPTS non-canonical sessions' entries onto the canonical session instead of dropping them — re-stamped with the canonical sessionId and fresh positions past the canonical max (the addEntry max+1 idiom, preserving the Dexie [sessionId+position] compound-key uniqueness), de-duped by songId within the night (canonical's copy wins for a song both devices logged, so no double-counting), with null-songId placeholder entries always adopted (never provably duplicates). The added.songs metric switched from (sessionId,position)-key comparison to object-identity provenance tracking so re-stamped local entries are not miscounted as "added". Orphan entries (sessionId with no show row) keep their previous survive behavior. Module doc updated to state the corrected semantic. Semantics now match deriveDex's per-night songId union — the merged single session yields the same dex a two-session night would.
verification: TDD — 3 regression tests written first and confirmed RED on unfixed code (union survival {1..7}, no double-count of a shared songId, placeholder preservation), GREEN after fix. Full merge suite 23/23 including all pre-existing D-11 richer-wins and WR-01 tie-break tests unchanged. Whole workspace 465/465 tests across 61 files. tsc --noEmit clean for both packages. HUMAN-VERIFIED 2026-07-16 — user confirmed the two-device round-trip on the dev server: profile A's original songs survived the merge, night appears once with the union of both devices' songs.
files_changed:
  - packages/core/src/data-safety/merge.ts
  - packages/core/test/merge.test.ts

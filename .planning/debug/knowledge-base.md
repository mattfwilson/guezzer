---
status: complete
---

# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## cr-01-self-merge-under-count — Import merge silently dropped local sightings on two-device same-night self-merge
- **Date:** 2026-07-16
- **Error patterns:** parseAndMergeImport, merge.ts, same-night dedupe, D-11, D-10 invariant, droppedSessionIds, trackedEntries, silent data loss, under-count, self-merge, two devices, importSnapshot clear, dex under-count, local sightings erased
- **Root cause:** parseAndMergeImport's D-11 same-night dedupe (merge.ts Step 5) selected one canonical show per attendance group and removed every other session's entries via `unionEntries.filter((e) => !droppedSessionIds.has(e.sessionId))` — no adoption step. When the local session had fewer entries than the imported same-owner session for the same night, all local-unique sightings were silently discarded; importSnapshot's clear()+bulkAdd made the loss permanent, violating the D-10 "every local row survives" invariant.
- **Fix:** Step 5 now adopts non-canonical sessions' entries onto the canonical session — re-stamped with the canonical sessionId and fresh positions past the canonical max, de-duped by songId within the night (canonical's copy wins), null-songId placeholders always adopted. added.songs metric switched to object-identity provenance tracking so re-stamped local entries aren't miscounted. Semantics now match deriveDex's per-night songId union.
- **Files changed:** packages/core/src/data-safety/merge.ts, packages/core/test/merge.test.ts
---

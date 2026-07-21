/**
 * Pure export assembler (D-09, Task 1) — the app tier (Plan 05-05) reads the
 * four Dexie tables into an `ExportSnapshot` and calls this; serialization has
 * zero DOM and zero db.ts dependency, so the whole export shape is
 * Node-testable (CLAUDE.md: core runnable/testable from Node CLI).
 *
 * `serializeExport` does pure object assembly only — the four data arrays are
 * carried through verbatim (no mutation, no reordering) and wrapped with the
 * `schemaVersion` the caller supplies (app: config.dataSafety.SCHEMA_VERSION)
 * plus an ISO-8601 `exportedAt` stamp. The output round-trips through
 * `exportEnvelope.parse` by construction.
 */
import type {
  ExportEnvelope,
  archiveShowRow,
  attendedShowRow,
  bingoCardRow,
  metaRow,
  trackedEntryRow,
  trackedShowRow,
} from "./export-schema.ts";
import type { z } from "zod";

/**
 * The in-memory snapshot the app assembles from the Dexie tables and hands to
 * `serializeExport`. Row types are the schema-inferred shapes so the snapshot
 * and the envelope share one source of truth. Reused by merge.ts as both the
 * local-snapshot input and the merged-result shape.
 *
 * v2 (plan 06-07): `owner` (D-17 identity fork key, read from the meta
 * `ownerName` row by the app caller — null when unset) and `archiveShows` (the
 * online-fallback setlist cache table — Pitfall 5).
 */
export interface ExportSnapshot {
  owner: string | null;
  meta: z.infer<typeof metaRow>[];
  attendedShows: z.infer<typeof attendedShowRow>[];
  archiveShows: z.infer<typeof archiveShowRow>[];
  trackedShows: z.infer<typeof trackedShowRow>[];
  trackedEntries: z.infer<typeof trackedEntryRow>[];
  // envelope v3 (plan 15-01): persisted Gizz-Bingo cards (BINGO-07).
  bingoCards: z.infer<typeof bingoCardRow>[];
}

/**
 * Assemble the D-09 export envelope. Pure: `meta`/`attendedShows`/
 * `trackedShows` pass through verbatim; `trackedEntries` is mapped to strip
 * the volatile device-local `id` (CR-01 / T-05-07) so a new backup never
 * carries a per-device Dexie `++id` that could collide on a future merge.
 * `schemaVersion` (caller-supplied) and `exportedAt` (now) are added; `owner`
 * and `archiveShows` pass through verbatim (v2, plan 06-07). Output keys are
 * exactly the eight v2 envelope keys — nothing more.
 */
export function serializeExport(
  snapshot: ExportSnapshot,
  schemaVersion: number,
): ExportEnvelope {
  return {
    schemaVersion,
    exportedAt: new Date().toISOString(),
    owner: snapshot.owner,
    meta: snapshot.meta,
    attendedShows: snapshot.attendedShows,
    archiveShows: snapshot.archiveShows,
    trackedShows: snapshot.trackedShows,
    trackedEntries: snapshot.trackedEntries.map(({ id: _id, ...rest }) => rest),
    // Verbatim passthrough like archiveShows — `cardId` is a stable PK, so
    // there is no volatile `++id` to strip (unlike trackedEntries above).
    bingoCards: snapshot.bingoCards,
  };
}

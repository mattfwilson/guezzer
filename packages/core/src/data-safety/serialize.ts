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
  attendedShowRow,
  metaRow,
  trackedEntryRow,
  trackedShowRow,
} from "./export-schema.ts";
import type { z } from "zod";

/**
 * The in-memory snapshot the app assembles from the four Dexie tables and hands
 * to `serializeExport`. Row types are the schema-inferred shapes so the snapshot
 * and the envelope share one source of truth. Reused by merge.ts as both the
 * local-snapshot input and the merged-result shape.
 */
export interface ExportSnapshot {
  meta: z.infer<typeof metaRow>[];
  attendedShows: z.infer<typeof attendedShowRow>[];
  trackedShows: z.infer<typeof trackedShowRow>[];
  trackedEntries: z.infer<typeof trackedEntryRow>[];
}

/**
 * Assemble the D-09 export envelope. Pure: `meta`/`attendedShows`/
 * `trackedShows` pass through verbatim; `trackedEntries` is mapped to strip
 * the volatile device-local `id` (CR-01 / T-05-07) so a new backup never
 * carries a per-device Dexie `++id` that could collide on a future merge.
 * `schemaVersion` (caller-supplied) and `exportedAt` (now) are added. Output
 * keys are exactly the six D-09 keys — nothing more.
 */
export function serializeExport(
  snapshot: ExportSnapshot,
  schemaVersion: number,
): ExportEnvelope {
  return {
    schemaVersion,
    exportedAt: new Date().toISOString(),
    meta: snapshot.meta,
    attendedShows: snapshot.attendedShows,
    trackedShows: snapshot.trackedShows,
    trackedEntries: snapshot.trackedEntries.map(({ id: _id, ...rest }) => rest),
  };
}

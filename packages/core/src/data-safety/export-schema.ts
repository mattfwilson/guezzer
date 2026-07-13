/**
 * Versioned export-envelope schema (D-09) — the executable contract for the
 * JSON backup that is PWA-04's genuine eviction backstop (iOS Safari can evict
 * IndexedDB; the file the user downloads is the real safety net).
 *
 * Every row schema below is a `z.strictObject` (Task 1 / T-05-06): unexpected
 * keys hard-fail, which is the prototype-pollution defense at the import trust
 * boundary — a crafted `__proto__`/extra-key file is rejected whole before any
 * merge (RESEARCH §Security).
 *
 * Zero DOM, zero db.ts dependency: the row shapes below MIRROR the app's
 * persistence interfaces (packages/app/src/db/db.ts — MetaRow, AttendedShow,
 * TrackedShow, TrackedEntry) but are RE-DECLARED here, never imported, to keep
 * core app-free (CLAUDE.md strict core/UI separation — the same idiom db.ts
 * uses to re-declare `SetNumber`).
 *
 * CRITICAL cross-plan data contract: `status`, `currentSetNumber`, `setNumber`,
 * and `outcome` are pinned as string-literal `z.enum(...)` unions matching
 * db.ts (`ShowStatus = "active"|"finalized"` line 35, `SetNumber = "1"|"2"|"e"`
 * line 44, `EntryOutcome = "hit"|"miss"` line 47, `EntrySource =
 * "manual"|"editor"` line 56). They MUST NOT be widened to `z.string()` — the
 * inferred `ExportEnvelope` row types have to stay assignable to
 * `Table<TrackedShow>` / `Table<TrackedEntry>` at `db.importSnapshot`, or Plan
 * 05-03 / 05-05's `tsc --noEmit` gate fails.
 */
import { z } from "zod";

/** Generic key/value settings row (mirrors db.ts `MetaRow`). */
export const metaRow = z.strictObject({
  key: z.string(),
  value: z.unknown(),
});

/** Attendance stub keyed by the stable 10-digit `show_id` (mirrors db.ts `AttendedShow`). */
export const attendedShowRow = z.strictObject({
  show_id: z.number().int(),
  showDate: z.string(),
});

/**
 * A live-tracked show (mirrors db.ts `TrackedShow` incl. the v3 binding
 * fields). `status`/`currentSetNumber` are enum-pinned to db.ts's closed
 * vocabularies; the `showId`/`venueId`/`venueName`/`city` binding columns are
 * nullable so pre-binding rows validate (db.ts writes null until `bindShow`).
 */
export const trackedShowRow = z.strictObject({
  sessionId: z.string(),
  date: z.string(),
  status: z.enum(["active", "finalized"]),
  currentSetNumber: z.enum(["1", "2", "e"]),
  startedAt: z.number(),
  showId: z.number().int().nullable(),
  venueId: z.number().int().nullable(),
  venueName: z.string().nullable(),
  city: z.string().nullable(),
});

/**
 * One confirmed song in a tracked show (mirrors db.ts `TrackedEntry`). `id` is
 * optional (Dexie `++id` auto-increment — absent on unsaved rows). `setNumber`
 * and `outcome` are enum-pinned; `source` mirrors the v3 `EntrySource` union.
 */
export const trackedEntryRow = z.strictObject({
  id: z.number().int().optional(),
  sessionId: z.string(),
  position: z.number(),
  songId: z.number().int().nullable(),
  songName: z.string(),
  setNumber: z.enum(["1", "2", "e"]),
  outcome: z.enum(["hit", "miss"]),
  shownFanSongIds: z.array(z.number().int()),
  isPlaceholder: z.boolean(),
  source: z.enum(["manual", "editor"]),
  loggedAt: z.number(),
});

/**
 * The D-09 export envelope: a versioned wrapper carrying all four tables plus
 * provenance metadata. `strictObject` at the top level rejects any file with an
 * unexpected top-level key (T-05-06). `schemaVersion` drives the forward
 * migration chain in merge.ts.
 */
export const exportEnvelope = z.strictObject({
  schemaVersion: z.number().int(),
  exportedAt: z.string(),
  meta: z.array(metaRow),
  attendedShows: z.array(attendedShowRow),
  trackedShows: z.array(trackedShowRow),
  trackedEntries: z.array(trackedEntryRow),
});

/** The full validated export shape — inferred from the schema (single source of truth). */
export type ExportEnvelope = z.infer<typeof exportEnvelope>;

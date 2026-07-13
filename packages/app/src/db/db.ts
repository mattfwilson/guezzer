/**
 * Dexie v1 database: a thin-but-real schema (D-08) — a `meta` settings
 * table plus a stub `attendedShows` table keyed by the stable 10-digit
 * `show_id` (mirrors core `NormalizedShow.showId`, packages/core/src/domain/types.ts).
 * Enough to prove PWA-03 with a genuine domain write that survives relaunch;
 * later phases grow this via ADDITIVE versioned migrations, never by
 * rewriting version(1).
 */
import Dexie, { type Table } from "dexie";
import { config } from "../config.ts";
import { classifyOutcome } from "../show/scoring.ts";

/** Generic key/value settings row. Value type is validated at the call site. */
export interface MetaRow {
  key: string;
  value: unknown;
}

/**
 * Stub domain row proving a real personal-data write survives relaunch.
 * `show_id` is the stable 10-digit integer identifier confirmed permanent
 * in Phase 1 (mirrors core's `NormalizedShow.showId`).
 *
 * Thin-but-real (D-08): do NOT add Phase 4/5/6 fields here. Grow the shape
 * via `this.version(2).stores({...})` in a future plan.
 */
export interface AttendedShow {
  show_id: number;
  showDate: string; // ISO date string, indexed for later date queries
}

// ── Phase 4 Show Mode: tracked setlist + provisional attendance (version(2)) ──

/** Lifecycle of a tracked show. Exactly one row is `"active"` at a time (D-03). */
export type ShowStatus = "active" | "finalized";

/**
 * Mirror of core's `SetNumber` union (packages/core/src/domain/types.ts:48),
 * proven the complete closed vocabulary by the full-corpus census (SCHEMA §13a
 * — no `"3"` exists anywhere 2010–2026). Re-declared here rather than imported
 * to keep the app's persistence schema free of a core type dependency; the
 * closed set is stable by construction.
 */
export type SetNumber = "1" | "2" | "e";

/** A confirmed song is a hit if it was among the shown fan (D-06); a search/??? log is a miss (D-08). */
export type EntryOutcome = "hit" | "miss";

/**
 * Provenance of a tracked entry (D-03). `"manual"` = the user logged it via the
 * orbit/search/??? path (all Phase-4 writes, backfilled on the v3 upgrade);
 * `"editor"` = adopted from a kglw.net editor suggestion in Phase 5. Kept so the
 * running tally stays honest and decomposable — an editor-adopted hit must be
 * distinguishable from a manually-caught one.
 */
export type EntrySource = "manual" | "editor";

/**
 * A live-tracked show. This row IS the provisional attendance record
 * (DEX-01/D-02): its mere existence, keyed by a local `sessionId` + `date`,
 * credits dex attendance immediately and offline — never lost even on a
 * force-quit. Binding to a canonical kglw.net `show_id` + venue is deferred to
 * Phase 5/6 (D-05), matched by date; `showId` is therefore always null here.
 *
 * Exactly one row is `status: "active"` at a time (D-03); `End Show` finalizes
 * it read-only and is required before the next night can start (D-04).
 */
export interface TrackedShow {
  /** crypto.randomUUID() — local, stable; the provisional attendance key (D-02). */
  sessionId: string;
  /** ISO YYYY-MM-DD, auto-stamped on Start with no venue/network friction (D-01). */
  date: string;
  /** Exactly one `"active"` at a time (D-03); `"finalized"` is read-only (D-04). */
  status: ShowStatus;
  /** `"1"` at start; Set break → `"2"`; Encore → `"e"` (SHOW-06). Snapshotted onto each entry. */
  currentSetNumber: SetNumber;
  /** Date.now() at Start. */
  startedAt: number;
  /** Reconciliation seam for Phase 5/6 (D-05) — null until `bindShow` reconciles it. */
  showId: number | null;
  /** kglw.net venue id, written by `bindShow` on reconciliation (D-07); null pre-bind. */
  venueId: number | null;
  /** kglw.net venue name, written by `bindShow` on reconciliation (D-07); null pre-bind. */
  venueName: string | null;
  /** kglw.net venue city, written by `bindShow` on reconciliation (D-07); null pre-bind. */
  city: string | null;
}

/**
 * One confirmed song in a tracked show, written through to IndexedDB
 * immediately on log (SHOW-11). `position` is a global sort-only integer
 * across the whole show incl. encore (SCHEMA §3); deletion may leave a gap,
 * which is acceptable — export (Phase 5) re-derives contiguous positions.
 */
export interface TrackedEntry {
  /** ++ auto-increment primary key. */
  id?: number;
  /** FK → TrackedShow.sessionId (indexed). */
  sessionId: string;
  /** Global contiguous 1..N sort key at log time (SCHEMA §3). */
  position: number;
  /** null for a "???" placeholder (D-14). */
  songId: number | null;
  /** "???" for a placeholder; renamable later (D-15). */
  songName: string;
  /** Snapshot of the show's currentSetNumber at log time (SHOW-06). */
  setNumber: SetNumber;
  /** hit if it was in the shown fan (D-06); miss for search/??? (D-08). */
  outcome: EntryOutcome;
  /** The orbs on screen when logged — supports D-06 + Phase 6 recap decomposition (D-07). */
  shownFanSongIds: number[];
  /** true for a "???" placeholder (D-14). */
  isPlaceholder: boolean;
  /** Provenance (D-03): `"manual"` for Phase-4 writes (backfilled on v3), `"editor"` for adopted suggestions. */
  source: EntrySource;
  loggedAt: number;
}

/** Binding written onto a provisional show by `bindShow` on kglw.net reconciliation (D-07). */
export interface ShowBinding {
  showId: number;
  venueId: number;
  venueName: string;
  city: string;
}

/** The three fan-facing fields an editor suggestion carries when adopted (D-03). */
export interface AdoptedEntry {
  songId: number;
  songName: string;
  /** The orbs on screen when adopted — the honest hit/miss denominator (D-06). */
  shownFanSongIds: number[];
}

/**
 * A full serializable DB snapshot — the shape `importSnapshot` commits and the
 * export/import layer (Plan 05-05) parses/merges. All four tables in one object
 * so the merged import is written atomically (D-12/Pitfall 5).
 */
export interface DbSnapshot {
  meta: MetaRow[];
  attendedShows: AttendedShow[];
  trackedShows: TrackedShow[];
  trackedEntries: TrackedEntry[];
}

export class GuezzerDB extends Dexie {
  meta!: Table<MetaRow, string>;
  attendedShows!: Table<AttendedShow, number>;
  trackedShows!: Table<TrackedShow, string>;
  trackedEntries!: Table<TrackedEntry, number>;

  constructor() {
    super(config.DB_NAME);

    // Version 1: thin-but-real schema (D-08). `&` = unique inbound primary key.
    this.version(1).stores({
      meta: "&key",
      attendedShows: "&show_id, showDate",
    });

    // Version 2 (Phase 4 Show Mode): ADDITIVE only — v1 above is untouched, so
    // `meta`/`attendedShows` carry forward unchanged (D-08). `&sessionId` =
    // unique local id; `status`/`date` indexed for the active-lookup + later
    // date-match. `[sessionId+position]` compound index orders a show's setlist.
    this.version(2).stores({
      trackedShows: "&sessionId, status, date",
      trackedEntries: "++id, sessionId, [sessionId+position]",
    });

    // Version 3 (Phase 5 live sync + data safety): ADDITIVE only — v1/v2 above
    // are untouched, so no destructive schema rewrite and no data loss (D-03,
    // T-05-08). New indexes: `showId` on trackedShows for date/id reconciliation
    // (D-07); `source` on trackedEntries for provenance filtering. The binding
    // columns (venueId/venueName/city) are stored but NOT indexed — Phase 6 reads
    // them per-row. The upgrade backfills every pre-existing entry's `source` to
    // "manual" (so no entry has an undefined source) and defaults the new
    // trackedShows binding columns to null.
    this.version(3)
      .stores({
        trackedShows: "&sessionId, status, date, showId",
        trackedEntries: "++id, sessionId, [sessionId+position], source",
      })
      .upgrade(async (tx) => {
        await tx
          .table("trackedEntries")
          .toCollection()
          .modify((e) => {
            if (e.source === undefined) e.source = "manual"; // backfill (D-03)
          });
        await tx
          .table("trackedShows")
          .toCollection()
          .modify((s) => {
            if (s.venueId === undefined) s.venueId = null;
            if (s.venueName === undefined) s.venueName = null;
            if (s.city === undefined) s.city = null;
          });
      });
  }
}

export const db = new GuezzerDB();

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

// ── Show Mode write helpers ──────────────────────────────────────────────────
// Module-level async fns wrapping db.transaction("rw", …), mirroring the
// setMeta/getMeta idiom. The tracked-show row is the single source of truth the
// whole Show Mode loop writes through to (SHOW-11); the UI re-renders reactively
// from it via useLiveQuery in later plans.

/** ISO YYYY-MM-DD stamp for today, local time (D-01). */
function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Start a new tracked show (D-01). Asserts the single-active invariant first
 * (D-03): rejects if any show is already `"active"` — `endShow` is required
 * before the next night (D-04). The written row is the provisional attendance
 * record (DEX-01/D-02). Returns the created row.
 */
export async function startShow(): Promise<TrackedShow> {
  return db.transaction("rw", db.trackedShows, async () => {
    const existing = await db.trackedShows
      .where("status")
      .equals("active")
      .first();
    if (existing) {
      throw new Error(
        "A show is already active — End Show before starting the next (D-03/D-04).",
      );
    }
    const show: TrackedShow = {
      sessionId: crypto.randomUUID(),
      date: todayIso(),
      status: "active",
      currentSetNumber: "1",
      startedAt: Date.now(),
      showId: null,
      venueId: null,
      venueName: null,
      city: null,
    };
    await db.trackedShows.add(show);
    return show;
  });
}

/** The one active tracked show, or undefined pre-show (restore/auto-resume, SHOW-11/D-03). */
export async function getActiveShow(): Promise<TrackedShow | undefined> {
  return db.trackedShows.where("status").equals("active").first();
}

/**
 * Write-through a confirmed song (SHOW-11). `position` is the next contiguous
 * integer; `setNumber` is snapshotted from the show's current set (SHOW-06) so
 * callers never pass it. Returns the new entry's auto-increment id.
 */
export async function logSong(
  sessionId: string,
  entry: Omit<
    TrackedEntry,
    "id" | "sessionId" | "position" | "setNumber" | "source"
  >,
): Promise<number> {
  return db.transaction("rw", db.trackedShows, db.trackedEntries, async () => {
    const show = await db.trackedShows.get(sessionId);
    if (!show) throw new Error(`No tracked show for sessionId ${sessionId}.`);
    // Derive the next position from the CURRENT maximum position, not the row
    // count (CR-01). deleteEntry (D-15) removes an arbitrary mid-trail entry and
    // leaves a position gap by design, so `count + 1` would reuse an
    // already-occupied position and silently corrupt ordering + the derived
    // current song. Max-position + 1 is monotonic across deletes; 0 entries → 1.
    const existing = await db.trackedEntries
      .where("sessionId")
      .equals(sessionId)
      .sortBy("position");
    const nextPosition = (existing.at(-1)?.position ?? 0) + 1;
    return db.trackedEntries.add({
      ...entry,
      sessionId,
      position: nextPosition,
      setNumber: show.currentSetNumber,
      source: "manual", // the default write path is always a manual log (D-03)
    });
  });
}

/** Undo: delete the max-position entry in one call, no dialog (SHOW-07/D-15). */
export async function undoLast(sessionId: string): Promise<void> {
  await db.transaction("rw", db.trackedEntries, async () => {
    const entries = await db.trackedEntries
      .where("sessionId")
      .equals(sessionId)
      .sortBy("position");
    const last = entries.at(-1);
    if (last?.id != null) await db.trackedEntries.delete(last.id);
  });
}

/** Mark a set break — subsequent entries snapshot `"2"` (SHOW-06). Does NOT end the show (D-04). */
export async function markSetBreak(sessionId: string): Promise<void> {
  await db.trackedShows.update(sessionId, { currentSetNumber: "2" });
}

/** Mark the encore — subsequent entries snapshot `"e"` (SHOW-06). Does NOT end the show (D-04). */
export async function markEncore(sessionId: string): Promise<void> {
  await db.trackedShows.update(sessionId, { currentSetNumber: "e" });
}

/**
 * Delete a single entry by id — the confirm-gated older-trail-node delete
 * (D-15). Distinct from `undoLast` (bounded to the most-recent entry, no
 * dialog): this removes any entry the UI has confirmed via the destructive
 * dialog. Deletion may leave a position gap (acceptable; export re-derives).
 */
export async function deleteEntry(id: number): Promise<void> {
  await db.trackedEntries.delete(id);
}

/**
 * Rename a "???" placeholder OR edit a mis-logged real entry to a different song
 * (D-14/D-15); clears isPlaceholder. When `outcome` is supplied it is persisted
 * too, so the edit path can re-classify hit/miss against the entry's shown fan
 * (WR-01) and keep the tally honest (SHOW-09). Omitting `outcome` leaves the
 * stored outcome untouched (backward-compatible with the plain ??? rename).
 */
export async function renameEntry(
  id: number,
  songId: number,
  songName: string,
  outcome?: EntryOutcome,
): Promise<void> {
  await db.trackedEntries.update(id, {
    songId,
    songName,
    isPlaceholder: false,
    ...(outcome !== undefined ? { outcome } : {}),
  });
}

/** Finalize a show read-only (D-04) — required before the next night can start (D-03). */
export async function endShow(sessionId: string): Promise<void> {
  await db.trackedShows.update(sessionId, { status: "finalized" });
}

// ── Phase 5 write helpers (live sync + data safety) ──────────────────────────

/**
 * Adopt a kglw.net editor suggestion into the trail (D-03). A `logSong` variant
 * for the "Add" path: it stamps `source: "editor"` provenance, clears
 * `isPlaceholder`, and classifies hit/miss with the SAME Phase-4 rule
 * (`classifyOutcome` against the orbs on screen) so an editor-adopted hit is
 * indistinguishable in the tally math from a manually-caught one — the tally
 * stays honest and decomposable (T-05-10). `position`/`setNumber` are stamped by
 * the same monotonic rule as `logSong`. Returns the new entry's id.
 */
export async function adoptSuggestion(
  sessionId: string,
  entry: AdoptedEntry,
): Promise<number> {
  return db.transaction("rw", db.trackedShows, db.trackedEntries, async () => {
    const show = await db.trackedShows.get(sessionId);
    if (!show) throw new Error(`No tracked show for sessionId ${sessionId}.`);
    const existing = await db.trackedEntries
      .where("sessionId")
      .equals(sessionId)
      .sortBy("position");
    const nextPosition = (existing.at(-1)?.position ?? 0) + 1;
    return db.trackedEntries.add({
      sessionId,
      position: nextPosition,
      songId: entry.songId,
      songName: entry.songName,
      setNumber: show.currentSetNumber,
      outcome: classifyOutcome(entry.songId, entry.shownFanSongIds),
      shownFanSongIds: entry.shownFanSongIds,
      isPlaceholder: false,
      source: "editor",
      loggedAt: Date.now(),
    });
  });
}

/**
 * Write the kglw.net binding onto a provisional show (D-07) — the reconciliation
 * seam. Sets showId/venueId/venueName/city ONLY; status/date/currentSetNumber
 * are untouched, so binding is silent and non-destructive (a bind never changes
 * what the user tracked). Mirrors the `markSetBreak` `update` idiom.
 */
export async function bindShow(
  sessionId: string,
  binding: ShowBinding,
): Promise<void> {
  await db.trackedShows.update(sessionId, binding);
}

/**
 * Commit a fully-merged import snapshot in ONE rw transaction (D-12/Pitfall 5).
 * The caller (Plan 05-05) validates + merges entirely in memory first and passes
 * the finished snapshot here. `meta`/`attendedShows` have stable, non-volatile
 * primary keys (key / show_id) and are never reduced by the merge (union only,
 * D-10), so they commit via `bulkPut` (upsert by primary key).
 *
 * `trackedShows` and `trackedEntries` are DIFFERENT: the merge's D-11 same-show
 * dedupe can legitimately DROP a `sessionId` that already exists locally (the
 * losing duplicate of a collapsed night), and `trackedEntries`' primary key is
 * the volatile per-device Dexie `++id` (CR-01 / T-05-07) — a plain `bulkPut`
 * upsert never deletes rows absent from the merged set, so a dedupe-dropped
 * local show would survive as an orphaned, zero-entry duplicate. Both tables
 * instead commit by full-replace: `clear()` the table, then re-add the merged
 * snapshot's rows (`bulkPut` for `trackedShows`, whose `sessionId` key is
 * stable; `bulkAdd` for `trackedEntries`, whose id-less rows need Dexie to
 * assign fresh local ids). All five calls stay inside the SAME rw transaction
 * — that is the atomicity control: a mid-write throw rolls back every clear
 * too, so a failed import can never leave the dex half-wiped (no partial state).
 */
export async function importSnapshot(snapshot: DbSnapshot): Promise<void> {
  await db.transaction(
    "rw",
    db.meta,
    db.attendedShows,
    db.trackedShows,
    db.trackedEntries,
    async () => {
      await db.meta.bulkPut(snapshot.meta);
      await db.attendedShows.bulkPut(snapshot.attendedShows);
      await db.trackedShows.clear();
      await db.trackedShows.bulkPut(snapshot.trackedShows);
      await db.trackedEntries.clear();
      await db.trackedEntries.bulkAdd(snapshot.trackedEntries);
    },
  );
}

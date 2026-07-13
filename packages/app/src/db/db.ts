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
  /** Reconciliation seam for Phase 5/6 (D-05) — always null in Phase 4. */
  showId: number | null;
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
  loggedAt: number;
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
  entry: Omit<TrackedEntry, "id" | "sessionId" | "position" | "setNumber">,
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

/** Rename a "???" placeholder to a real song (D-14/D-15); clears isPlaceholder. */
export async function renameEntry(
  id: number,
  songId: number,
  songName: string,
): Promise<void> {
  await db.trackedEntries.update(id, {
    songId,
    songName,
    isPlaceholder: false,
  });
}

/** Finalize a show read-only (D-04) — required before the next night can start (D-03). */
export async function endShow(sessionId: string): Promise<void> {
  await db.trackedShows.update(sessionId, { status: "finalized" });
}

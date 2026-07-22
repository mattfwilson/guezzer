/**
 * Dexie v1 database: a thin-but-real schema (D-08) — a `meta` settings
 * table plus a stub `attendedShows` table keyed by the stable 10-digit
 * `show_id` (mirrors core `NormalizedShow.showId`, packages/core/src/domain/types.ts).
 * Enough to prove PWA-03 with a genuine domain write that survives relaunch;
 * later phases grow this via ADDITIVE versioned migrations, never by
 * rewriting version(1).
 */
import Dexie, { type Table } from "dexie";
import type { BingoCard } from "@guezzer/core";
import { config } from "../config.ts";
import { classifyOutcome } from "../show/scoring.ts";
import { readIdentityRecord } from "../auth/identityRecord.ts";
import { randomUUID } from "../uuid.ts";

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
  /**
   * Owning identity (AUTH-05 / D-11), stamped by `claimLegacyDexOnce` on first
   * sign-in and by future write-side stamping. Optional so pre-version(7)
   * (untagged) legacy rows and the additive upgrade both typecheck; undefined
   * means "unclaimed" until the one-time claim runs.
   */
  userId?: string;
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
  /** Owning identity (AUTH-05 / D-11); undefined until the version(7) claim stamps it. */
  userId?: string;
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
  /** Owning identity (AUTH-05 / D-11); undefined until the version(7) claim stamps it. */
  userId?: string;
}

/**
 * A cached online-fallback setlist row (DEX-02, plan 06-07), keyed by the
 * stable 10-digit `show_id`. ONLY written by an online-fallback retro mark: a
 * show marked from the live archive (post-corpus, absent from the bundled
 * `archive.json`) stashes its setlist here so its sightings survive reload AND
 * backup round-trips (Pitfall 5). Corpus-era marks write nothing here — their
 * setlists already ride in the bundled archive artifact.
 *
 * `sets[].n` reuses the existing `SetNumber` union — the core `archiveShowRow`
 * schema (export-schema.ts) enum-pins to it, so a validated envelope row is
 * assignable to `ArchiveShowRow` at `importSnapshot` (the `tsc --noEmit`
 * cross-boundary contract).
 */
export interface ArchiveShowRow {
  show_id: number;
  date: string;
  venueName: string;
  city: string;
  sets: Array<{ n: SetNumber; songs: Array<{ songId: number; songName: string }> }>;
  /** Owning identity (AUTH-05 / D-11); undefined until the version(7) claim stamps it. */
  userId?: string;
}

/**
 * One persisted Gizz-Bingo card (Phase 15, BINGO-07) — the frozen artifact a
 * past show's board is replayed from (D-08). Wraps the pure core `BingoCard`
 * (embedding its resolved, display-frozen `squares`) under `card:` so the
 * shipped `bingoCardSchema` validates it verbatim at the import trust boundary
 * (RESEARCH Pattern 2). Additive-only: written by `saveDraftCard`/`lockCard`,
 * never touched by any v1-v4 helper.
 *
 * Keyed by `cardId` — the D-12 STABLE, device-independent, merge-safe primary
 * key (NOT the volatile `++id`), set equal to `sessionId` (RESEARCH Pattern 6 /
 * A3: one card per show, D-07). A pre-lock reshuffle therefore OVERWRITES the
 * same row in place (the deal seed lives IN `card.seed`), never orphaning a
 * draft. Mirrors the stable-key discipline of `archiveShows.show_id` /
 * `trackedShows.sessionId`.
 */
export interface BingoCardRow {
  /** D-12 stable inbound PK (== sessionId), NOT the volatile ++id. */
  cardId: string;
  /** FK → TrackedShow.sessionId (indexed for replay lookup). */
  sessionId: string;
  /** The pure core card, embedding its frozen `squares` (resolvedDefs, D-08). */
  card: BingoCard;
  /**
   * The D-08/D-12 frozen catch-set stamped at lock time (REQUIRED per RESEARCH
   * Pitfall 1). `[]` on an unlocked draft; the replay fold reads it for
   * `neverCaught`, so it must be the caught songIds AS OF the lock, never the
   * live dex. Derivable from `deriveDex(...).perSong.keys()` at lock time
   * (RESEARCH A1) — Phase 16 wires the real Start-Show/deal trigger.
   */
  caughtSnapshot: number[];
  /** null = unlocked draft; a ms-epoch stamp once locked (D-08). */
  lockedAt: number | null;
  /** ISO YYYY-MM-DD (denormalized show identity, D-11). */
  showDate: string;
  /** kglw.net venue name, null pre-bind (denormalized identity, D-11). */
  venueName: string | null;
  /** kglw.net venue city, null pre-bind (denormalized identity, D-11). */
  city: string | null;
  /** Owning identity (AUTH-05 / D-11); undefined until the version(7) claim stamps it. */
  userId?: string;
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
  /** D-17 identity fork key (plan 06-07): read from the meta `ownerName` row; null when unset. */
  owner: string | null;
  meta: MetaRow[];
  attendedShows: AttendedShow[];
  /** The online-fallback setlist cache (plan 06-07). */
  archiveShows: ArchiveShowRow[];
  trackedShows: TrackedShow[];
  trackedEntries: TrackedEntry[];
  /** Persisted Gizz-Bingo cards (envelope v3, plan 15-02). Union-merged by stable `cardId`. */
  bingoCards: BingoCardRow[];
}

// ── GizzMap: friend presence + meeting pins (version(6)) ─────────────────────

/**
 * A friend's last-known decrypted beacon (GizzMap). One row per member,
 * upserted by the sync loop — NEVER a history (mirrors the relay's no-history
 * TTL ethos client-side). `receivedAt` is the RELAY's receipt stamp (the
 * honesty clock — device clocks drift); `updatedAt` is the sender's GPS-fix
 * stamp. Deliberately EXCLUDED from DbSnapshot/export: presence is ephemeral
 * by design and TTLs out everywhere — a backup must never resurrect it.
 */
export interface FriendBeaconRow {
  memberId: string;
  name: string;
  lat: number;
  lng: number;
  accuracyM: number | null;
  status: string | null;
  /** Gizz-set emoji; null = render the name initial. Not indexed — no schema bump needed. */
  avatar: string | null;
  updatedAt: number;
  receivedAt: number;
}

/**
 * A shared "meet here" pin (GizzMap), synced in lat/lng ALWAYS (each device
 * renders through its own georef fit). `synced` is a 0/1 flag (indexed —
 * Dexie can't index booleans): pins created offline stay 0 until the sync
 * loop pushes them. Excluded from DbSnapshot/export like beacons.
 */
export interface MapPinRow {
  pinId: string;
  createdBy: string;
  label: string;
  lat: number;
  lng: number;
  createdAt: number;
  synced: 0 | 1;
}

export class GuezzerDB extends Dexie {
  meta!: Table<MetaRow, string>;
  attendedShows!: Table<AttendedShow, number>;
  archiveShows!: Table<ArchiveShowRow, number>;
  trackedShows!: Table<TrackedShow, string>;
  trackedEntries!: Table<TrackedEntry, number>;
  bingoCards!: Table<BingoCardRow, string>;
  friendBeacons!: Table<FriendBeaconRow, string>;
  mapPins!: Table<MapPinRow, string>;

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

    // Version 4 (Phase 6 Pokédex): ADDITIVE only — v1/v2/v3 above are untouched,
    // so no destructive rewrite and no data loss. Adds a SINGLE new table,
    // `archiveShows`, the online-fallback setlist cache (DEX-02, plan 06-07),
    // keyed by the stable 10-digit `&show_id`. No `.upgrade` is needed: a new
    // table has no pre-existing rows to backfill.
    this.version(4).stores({
      archiveShows: "&show_id",
    });

    // Version 5 (Phase 15 Gizz Bingo): ADDITIVE only — v1/v2/v3/v4 above are
    // untouched, so a populated v4 DB upgrades in place losslessly (D-14, SC-4).
    // Adds a SINGLE new table, `bingoCards`, keyed by the stable inbound
    // `&cardId` (D-12, == sessionId — NOT the volatile ++id); `sessionId` is
    // indexed for replay lookup. No `.upgrade` is needed: a new table has no
    // pre-existing rows to backfill (the v4 precedent).
    this.version(5).stores({
      bingoCards: "&cardId, sessionId",
    });

    // Version 6 (GizzMap): ADDITIVE only — two new tables for friend presence
    // and shared meeting pins. `synced` indexed so the sync loop can query
    // offline-created pins cheaply. No `.upgrade` needed (new tables only).
    this.version(6).stores({
      friendBeacons: "&memberId",
      mapPins: "&pinId, synced",
    });

    // Version 7 (Phase 18 Accounts & Offline-Safe Identity, AUTH-05 / D-11):
    // ADDITIVE only — v1-v6 above are untouched, so a populated v6 DB upgrades in
    // place losslessly (SC-4). Adds a `userId` INDEX to the five domain tables so
    // later reads/exports (Plans 06/07) can scope by identity via
    // `.where("userId")`. Re-declaring each store's full index string keeps the
    // pre-existing indexes and appends `userId`; adding an index re-indexes
    // structurally with NO `.upgrade()` data transform. Deliberately NO stamping
    // here: the userId is UNKNOWN at DB-open (before sign-in), so the one-time
    // legacy-row claim lives in app code (`auth/claimDex.ts`), never this hook
    // (RESEARCH Pitfall 2). Pre-claim rows read back with `userId === undefined`.
    //
    // Accepted limitation (RESEARCH Pitfall 4 / T-18-02-I2): `attendedShows` and
    // `archiveShows` keep their `&show_id` UNIQUE primary keys, so a plain
    // `userId` field does NOT isolate two identities marking the same show on one
    // shared device — the second write upserts over the first. Accepted for v2.0
    // per D-09 ("a borrowed-phone dex is empty"); full compound-key isolation is
    // explicitly out of scope. `trackedShows`/`trackedEntries`/`bingoCards` keys
    // are UUID-derived and do not collide across users.
    this.version(7).stores({
      attendedShows: "&show_id, showDate, userId",
      archiveShows: "&show_id, userId",
      trackedShows: "&sessionId, status, date, showId, userId",
      trackedEntries: "++id, sessionId, [sessionId+position], source, userId",
      bingoCards: "&cardId, sessionId, userId",
    });
  }
}

export const db = new GuezzerDB();

// ── Write-side identity stamping (AUTH-05 write half / D-08/D-09/D-11, 18-07) ──
// Every create path across the five namespaced tables stamps the signed-in
// identity's `userId` via Dexie `creating`/`updating` hooks — the lowest-touch
// mechanism (NO write-helper signature change vs threading userId through six
// helpers). Without this, `startShow`/`logSong`/`adoptSuggestion`/
// `markShowAttended`/`saveDraftCard` would write rows with `userId === undefined`,
// which the scoped reads + scoped export (this plan) then EXCLUDE — silently
// losing the signed-in user's OWN post-claim activity (core-loop regression).
//
// `readIdentityRecord()` is a synchronous, zero-await localStorage read (Plan
// 03) and a LEAF module (no `db` import), so reading it at write time inside the
// hook introduces no import cycle.
//
// Guard strictly on `userId === undefined`:
//   - `creating`: stamp only when the created object has no userId, and only
//     when an identity is present (never invent one — a legacy pre-claim row
//     stays undefined for the one-time `claimLegacyDexOnce` to stamp).
//   - `updating`: the load-bearing self-erasure guard for the `.put`-replace
//     paths (`markShowAttended` re-mark, `saveDraftCard` reshuffle). A `.put`
//     whose literal omits userId over an existing row yields a diff that would
//     DROP the field (`getObjectDiff` → `userId: undefined`); re-stamp it so the
//     owner's own attendance/bingo is never self-erased on overwrite. Helpers
//     that explicitly set userId (the claim's `.modify`) or merge-preserve it
//     (`.update` — endShow/markSetBreak/bindShow/renameEntry/lockCard) already
//     resolve to a defined userId, so the guard leaves them untouched. Import
//     rows arrive already-stamped (importSnapshot), so they are never re-touched.
function registerUserIdStampingHooks(table: Table<{ userId?: string }>): void {
  table.hook("creating", (_primKey, obj) => {
    if (obj.userId === undefined) {
      const userId = readIdentityRecord()?.userId;
      if (userId != null) obj.userId = userId;
    }
  });
  table.hook("updating", (modifications, _primKey, row) => {
    const mods = modifications as { userId?: string };
    // The resulting userId after this update: the modification's value if the
    // key is being written, else the existing row's value.
    const resulting = "userId" in mods ? mods.userId : row.userId;
    if (resulting === undefined) {
      const userId = readIdentityRecord()?.userId;
      if (userId != null) return { userId };
    }
    return undefined; // no additional modifications
  });
}

// NOT registered on `meta`/`friendBeacons`/`mapPins` (not namespaced).
for (const table of [
  db.attendedShows,
  db.archiveShows,
  db.trackedShows,
  db.trackedEntries,
  db.bingoCards,
] as unknown as Table<{ userId?: string }>[]) {
  registerUserIdStampingHooks(table);
}

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

/**
 * ISO YYYY-MM-DD stamp for today, local time (D-01). Exported so the Settings
 * rotation-reset control (PRED-03, plan 11-05) can write a boundary date that is
 * COMMENSURATE with the `TrackedShow.date` values `currentRunShowSets` compares
 * against — the same helper that stamps `startShow`'s show date.
 */
export function todayIso(): string {
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
      // uuid.ts, NOT crypto.randomUUID directly — the native API is missing in
      // insecure contexts (plain-HTTP LAN testing), which silently broke Start
      // Show on real phones (debug session: start-show-not-clickable).
      sessionId: randomUUID(),
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

// ── Phase 15 Gizz-Bingo write helpers (persistence + lock, BINGO-07) ──────────
// Mirror the `startShow` transaction+assertion idiom. The `bingoCards` row is
// the frozen replayable artifact (D-08); replay stores NO marks — it re-derives
// from the persisted trail, so these helpers only ever write the card + its
// lock state (D-23).

/** The fields a caller supplies to deal/reshuffle a draft card (cardId is derived). */
export interface DraftCardInput {
  /** FK → TrackedShow.sessionId; also becomes the row's stable `cardId` (D-12). */
  sessionId: string;
  /** The pure core card to freeze onto the row (embeds resolved squares, D-08). */
  card: BingoCard;
  showDate: string;
  venueName: string | null;
  city: string | null;
}

/**
 * Write (or reshuffle) an UNLOCKED draft card for a session (D-08). `cardId` is
 * set equal to `sessionId` (D-12), so a pre-lock reshuffle with a new seed
 * OVERWRITES the same row in place — no orphaned drafts (RESEARCH Pattern 6).
 *
 * The D-10 reshuffle-rejection invariant is enforced HERE, app-side (RESEARCH
 * Pitfall 5 — never in packages/core, which stays DB-free): the write THROWS if
 * the session is `finalized` or the existing card is already locked
 * (`lockedAt != null`), mirroring `startShow`'s single-active throw. Locked
 * historical cards can never be re-dealt (SC-1).
 */
export async function saveDraftCard(input: DraftCardInput): Promise<void> {
  await db.transaction("rw", db.trackedShows, db.bingoCards, async () => {
    const show = await db.trackedShows.get(input.sessionId);
    if (show?.status === "finalized") {
      throw new Error(
        `Cannot deal a bingo card for a finalized show (session ${input.sessionId}) — reshuffle rejected (SC-1/D-10).`,
      );
    }
    const existing = await db.bingoCards.get(input.sessionId);
    if (existing?.lockedAt != null) {
      throw new Error(
        `Bingo card for session ${input.sessionId} is locked — reshuffle rejected (SC-1/D-10).`,
      );
    }
    await db.bingoCards.put({
      cardId: input.sessionId, // == sessionId (D-12): reshuffle overwrites in place
      sessionId: input.sessionId,
      card: input.card,
      caughtSnapshot: [], // frozen only at lock time (D-08)
      lockedAt: null,
      showDate: input.showDate,
      venueName: input.venueName,
      city: input.city,
    });
  });
}

/**
 * Lock a session's card (D-08/D-12): stamp `lockedAt` and FREEZE `caughtSnapshot`
 * to the caught songIds passed at lock time. Idempotent — a second call on an
 * already-locked card is a no-op (the first freeze wins, D-10). A no-op (not a
 * throw) when the session has no card row, so wiring this into a card-less Start
 * Show is safe (D-09: the same helper serves the Start-Show lock and the
 * late-deal lock-on-deal path; Phase 16 wires whichever trigger fires).
 *
 * The `caughtSongIds` the caller passes is derivable from
 * `deriveDex(...).perSong.keys()` at lock time (RESEARCH A1) — it MUST be the
 * frozen set as of the lock, never the live dex, or `neverCaught` drifts on
 * replay (RESEARCH Pitfall 1).
 */
export async function lockCard(
  sessionId: string,
  caughtSongIds: number[],
): Promise<void> {
  await db.transaction("rw", db.bingoCards, async () => {
    const card = await db.bingoCards.where("sessionId").equals(sessionId).first();
    if (!card) return; // no card dealt — safe no-op (card-less Start Show, D-09)
    if (card.lockedAt != null) return; // idempotent — first freeze wins (D-10)
    await db.bingoCards.update(card.cardId, {
      lockedAt: Date.now(),
      caughtSnapshot: caughtSongIds,
    });
  });
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

// ── Phase 6 retro mark/unmark helpers (DEX-02, plan 06-07) ───────────────────

/**
 * Mark a show as attended (DEX-02). Corpus-era marks pass NO `cachedSetlist` —
 * the bundled archive already holds their setlists, so only the `attendedShows`
 * attendance stub is written. Online-fallback marks (a post-corpus show pulled
 * from the live archive, absent from the bundle) pass `cachedSetlist`, which is
 * cached in `archiveShows` IN THE SAME transaction so the attendance stub and
 * its setlist are written atomically (Pitfall 5 — a forced failure writes
 * neither, so a fallback mark can never credit zero sightings after reload).
 * `&show_id` is a stable upsert key, so re-marking is idempotent.
 */
export async function markShowAttended(input: {
  show_id: number;
  showDate: string;
  cachedSetlist?: ArchiveShowRow;
}): Promise<void> {
  await db.transaction("rw", db.attendedShows, db.archiveShows, async () => {
    await db.attendedShows.put({
      show_id: input.show_id,
      showDate: input.showDate,
    });
    if (input.cachedSetlist) {
      await db.archiveShows.put(input.cachedSetlist);
    }
  });
}

/**
 * Un-mark a show (D-12). A plain two-table delete of the attendance stub and any
 * cached fallback setlist — derivation recomputes every dex stat from raw
 * attendance, so unmark needs no bookkeeping ("unmark is free"). Deleting a
 * `show_id` absent from either table is a harmless no-op.
 */
export async function unmarkShowAttended(show_id: number): Promise<void> {
  await db.transaction("rw", db.attendedShows, db.archiveShows, async () => {
    await db.attendedShows.delete(show_id);
    await db.archiveShows.delete(show_id);
  });
}

/** Drop the identity-local `userId` from a domain row (see `snapshot`). */
function stripUserId<T extends { userId?: string }>(row: T): Omit<T, "userId"> {
  const { userId: _userId, ...rest } = row;
  return rest;
}

/**
 * Read the full DB snapshot for export/merge, SCOPED to `userId` (AUTH-05 / D-09,
 * plan 18-07). Reads only the signed-in identity's rows from the five domain
 * tables (`meta` stays global) plus the `owner` identity (from the meta
 * `ownerName` row, null when unset). The single assembly path — `exportDownload`
 * and the import's local-snapshot read both route through here so the export
 * shape is defined in ONE place.
 *
 * The identity-local `userId` is STRIPPED from every domain row before it leaves
 * this function: the strict export-envelope schema (packages/core export-schema.ts
 * — every row is a `z.strictObject`) FORBIDS unknown keys, so a leaked `userId`
 * would make a backup fail its own re-import. The importing identity is
 * re-stamped by `importSnapshot` instead. Pre-claim rows with `userId ===
 * undefined` are excluded from a scoped export (they match no userId).
 */
export async function snapshot(userId: string): Promise<DbSnapshot> {
  const [
    meta,
    attendedShows,
    archiveShows,
    trackedShows,
    trackedEntries,
    bingoCards,
  ] = await Promise.all([
    db.meta.toArray(),
    db.attendedShows.where("userId").equals(userId).toArray(),
    db.archiveShows.where("userId").equals(userId).toArray(),
    db.trackedShows.where("userId").equals(userId).toArray(),
    db.trackedEntries.where("userId").equals(userId).toArray(),
    db.bingoCards.where("userId").equals(userId).toArray(),
  ]);
  const owner = (await getMeta<string>("ownerName")) ?? null;
  return {
    owner,
    meta,
    attendedShows: attendedShows.map(stripUserId),
    archiveShows: archiveShows.map(stripUserId),
    trackedShows: trackedShows.map(stripUserId),
    trackedEntries: trackedEntries.map(stripUserId),
    bingoCards: bingoCards.map(stripUserId),
  };
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
 * instead commit by full-replace SCOPED to the importing identity (review WR-02
 * / D-09): a `where("userId").equals(userId).delete()` of the importer's rows,
 * then re-add the merged snapshot's rows (`bulkPut` for `trackedShows`, whose
 * `sessionId` key is stable; `bulkAdd` for `trackedEntries`, whose id-less rows
 * need Dexie to assign fresh local ids). Scoping the delete (vs the former
 * unscoped `.clear()`) preserves the Phase-5 dedupe-drop / volatile-++id
 * semantics for THIS identity while leaving a co-resident identity's tracked
 * rows on a shared device intact. All five calls stay inside the SAME rw
 * transaction — that is the atomicity control: a mid-write throw rolls back
 * every delete too, so a failed import can never leave the dex half-wiped.
 */
export async function importSnapshot(
  snapshot: DbSnapshot,
  userId: string,
): Promise<void> {
  // Stamp the importing identity onto every domain row (AUTH-05 / D-09, plan
  // 18-07): the merged snapshot's rows are userId-stripped (see `snapshot`), so
  // an import re-owns them to the signed-in identity — a friend's backup restored
  // under YOUR identity becomes yours, and the scoped reads/export then include
  // them.
  const stamp = <T extends { userId?: string }>(rows: T[]): T[] =>
    rows.map((row) => ({ ...row, userId }));

  // Six tables now exceed Dexie's positional `transaction(mode, ...t5, cb)`
  // overload (max 5 stores), so pass the stores as an array — same single
  // atomic rw transaction, just the array-arity signature.
  await db.transaction(
    "rw",
    [
      db.meta,
      db.attendedShows,
      db.archiveShows,
      db.trackedShows,
      db.trackedEntries,
      db.bingoCards,
    ],
    async () => {
      await db.meta.bulkPut(snapshot.meta);
      await db.attendedShows.bulkPut(stamp(snapshot.attendedShows));
      // archiveShows has a stable `&show_id` key and is union-only (never
      // reduced by the merge, D-10) — commit via bulkPut upsert, NOT
      // clear-and-rewrite (plan 06-07). `owner` is deliberately NOT written into
      // meta here: it is a device-local fork key, not portable state (D-17).
      await db.archiveShows.bulkPut(stamp(snapshot.archiveShows));
      // bingoCards has a stable `&cardId` key and is union-only (the merge never
      // reduces it, D-13) — commit via bulkPut upsert, NOT the clear-and-rewrite
      // path used for trackedShows/trackedEntries. A locally-present card absent
      // from the merged snapshot therefore survives (no destructive clear).
      await db.bingoCards.bulkPut(stamp(snapshot.bingoCards));
      // Scope the destructive rewrite to the IMPORTING identity (WR-01 review
      // WR-02 / D-09): an unscoped `.clear()` here would wipe a co-resident
      // identity's tracked shows/entries on a shared device during a full
      // restore. Every row now carries `userId`, so delete only the importer's
      // rows before re-adding the merged snapshot — preserving the Phase-5
      // clear-and-rewrite semantic (drops dedupe-removed rows, resets the
      // volatile ++id) for THIS identity while leaving others' rows intact.
      await db.trackedShows.where("userId").equals(userId).delete();
      await db.trackedShows.bulkPut(stamp(snapshot.trackedShows));
      await db.trackedEntries.where("userId").equals(userId).delete();
      await db.trackedEntries.bulkAdd(stamp(snapshot.trackedEntries));
    },
  );
}

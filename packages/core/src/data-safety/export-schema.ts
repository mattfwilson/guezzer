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
import { config } from "../config.ts";
import { bingoCardSchema } from "../bingo/types.ts";

/** Generic key/value settings row (mirrors db.ts `MetaRow`). */
export const metaRow = z.strictObject({
  key: z.string(),
  value: z.unknown(),
});

/**
 * One cached online-fallback setlist row (mirrors db.ts `ArchiveShowRow`, plan
 * 06-07). This is the v2 `archiveShows` element: a show marked from the live
 * archive carries its setlist here so its sightings survive reload AND backup
 * round-trips (Pitfall 5 — the bundled corpus already holds corpus-era
 * setlists, so ONLY post-corpus fallback marks populate this cache). `n` is
 * enum-pinned to `"1"|"2"|"e"` EXACTLY like db.ts's `SetNumber` and
 * `setNumber`/`currentSetNumber` above — the inferred row type must stay
 * assignable to `Table<ArchiveShowRow>` at `db.importSnapshot`, or the app's
 * `tsc --noEmit` gate fails (the atomic-cluster contract).
 */
export const archiveShowRow = z.strictObject({
  show_id: z.number().int(),
  date: z.string(),
  venueName: z.string(),
  city: z.string(),
  sets: z.array(
    z.strictObject({
      n: z.enum(["1", "2", "e"]),
      songs: z.array(
        z.strictObject({
          songId: z.number().int(),
          songName: z.string(),
        }),
      ),
    }),
  ),
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
 * One persisted Gizz-Bingo card (envelope v3, plan 15-01). Mirrors the app's
 * `BingoCardRow` (packages/app/src/db/db.ts) but is RE-DECLARED here to keep
 * core app-free. The pure `BingoCard` is NESTED under `card:` so the shipped
 * `bingoCardSchema` — a `z.discriminatedUnion("kind", …)` on the squares
 * (bingo/types.ts) — validates the card verbatim (RESEARCH Pattern 2), so an
 * unknown square `kind` or a leaked extra key hard-fails at the import trust
 * boundary (T-15-01). `cardId` is the stable inbound PK (D-12) — unlike
 * `trackedEntryRow`'s volatile `++id`, it is never stripped on serialize.
 *
 * CRITICAL (RESEARCH Pitfall 1): `caughtSnapshot` is REQUIRED even though
 * CONTEXT D-11's field list omits it — it is the frozen catch-set (D-08/D-12)
 * the replay fold reads for `neverCaught`; without it `neverCaught` drifts on
 * replay. `lockedAt` is `null` for a draft, a ms-epoch stamp once locked. The
 * inferred row type must stay assignable to `Table<BingoCardRow>` at
 * `db.importSnapshot` (the app's `tsc --noEmit` cross-boundary contract) — do
 * NOT widen any field.
 */
export const bingoCardRow = z.strictObject({
  cardId: z.string(),
  sessionId: z.string(),
  card: bingoCardSchema,
  caughtSnapshot: z.array(z.number().int()),
  lockedAt: z.number().nullable(),
  showDate: z.string(),
  venueName: z.string().nullable(),
  city: z.string().nullable(),
});

/**
 * The export envelope (v2, plan 06-07): a versioned wrapper carrying all four
 * tables plus provenance metadata, the D-17 `owner` identity fork key, and the
 * `archiveShows` online-fallback setlist cache. `strictObject` at the top level
 * rejects any file with an unexpected top-level key (T-05-06). `schemaVersion`
 * drives the forward migration chain in merge.ts.
 *
 * `owner` and `archiveShows` use `.default(...)` — NOT plain required fields —
 * so a genuine v1 backup (written before 06-07, lacking these two keys) still
 * PARSES: the defaults fill in (owner null, archiveShows []), and the v1→v2
 * MIGRATIONS entry normalizes them explicitly. The inferred OUTPUT type keeps
 * both fields required (`string | null`, `ArchiveShowRow[]`) so serialize.ts /
 * merge.ts / the app snapshot never juggle `undefined`. `owner` is length-
 * clamped (ASVS V5, T-06-14) and rendered as escaped React text only (06-10).
 */
export const exportEnvelope = z.strictObject({
  schemaVersion: z.number().int(),
  exportedAt: z.string(),
  owner: z.string().max(config.dex.OWNER_NAME_MAX_LENGTH).nullable().default(null),
  meta: z.array(metaRow),
  attendedShows: z.array(attendedShowRow),
  archiveShows: z.array(archiveShowRow).default([]),
  trackedShows: z.array(trackedShowRow),
  trackedEntries: z.array(trackedEntryRow),
  // envelope v3 (plan 15-01): the persisted Gizz-Bingo cards. `.default([])`
  // mirrors `archiveShows` so a genuine v2 backup lacking this key still
  // PARSES (BINGO-07 / D-14); the v2→v3 MIGRATIONS[2] entry normalizes it.
  bingoCards: z.array(bingoCardRow).default([]),
});

/** The full validated export shape — inferred from the schema (single source of truth). */
export type ExportEnvelope = z.infer<typeof exportEnvelope>;

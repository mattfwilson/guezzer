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

export class GuezzerDB extends Dexie {
  meta!: Table<MetaRow, string>;
  attendedShows!: Table<AttendedShow, number>;

  constructor() {
    super(config.DB_NAME);

    // Version 1: thin-but-real schema (D-08). `&` = unique inbound primary key.
    this.version(1).stores({
      meta: "&key",
      attendedShows: "&show_id, showDate",
    });

    // Additive-migration pattern for Phase 4+ (D-08 — never rewrite version(1)):
    //   this.version(2).stores({ trackedShows: '&show_id, ...', /* only NEW/CHANGED tables */ });
    // Tables not listed in a later version().stores() call carry forward
    // unchanged automatically — do not re-declare `meta`/`attendedShows`
    // here unless their shape actually changes.
  }
}

export const db = new GuezzerDB();

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

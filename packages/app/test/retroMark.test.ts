import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { config } from "../src/config.ts";
import {
  db,
  markShowAttended,
  unmarkShowAttended,
  type ArchiveShowRow,
} from "../src/db/db.ts";

/**
 * Retro mark/unmark helpers (DEX-02, plan 06-07). Corpus-era marks write ONLY
 * the attendedShows stub (their setlists live in the bundled archive);
 * online-fallback marks additionally cache the setlist in archiveShows — both
 * in ONE transaction so a partial write is impossible (Pitfall 5). Unmark is a
 * plain two-table delete (D-12: derivation recomputes everything, so unmark is
 * free). Runs under fake-indexeddb (test/setup.ts).
 */

async function resetDb(): Promise<void> {
  db.close();
  await Dexie.delete(config.DB_NAME);
  await db.open();
}

const fallbackSetlist: ArchiveShowRow = {
  show_id: 1782000000,
  date: "2026-07-13",
  venueName: "Red Rocks Amphitheatre",
  city: "Morrison",
  sets: [
    { n: "1", songs: [{ songId: 42, songName: "Rattlesnake" }] },
    { n: "e", songs: [{ songId: 7, songName: "The River" }] },
  ],
};

describe("markShowAttended / unmarkShowAttended (DEX-02)", () => {
  beforeEach(resetDb);
  afterEach(resetDb);

  it("opens at the current Dexie version with the archiveShows table present", () => {
    // Phase 15 added the additive version(5) bingoCards table; GizzMap added the
    // version(6) friendBeacons/mapPins tables; Phase 18 added the userId index as
    // version(7). The DB now opens at verno 7. archiveShows (v4) is still present
    // and unchanged.
    expect(db.verno).toBe(7);
    expect(db.archiveShows).toBeDefined();
  });

  it("mark corpus-era: writes the attendedShows stub only, archiveShows stays empty", async () => {
    await markShowAttended({ show_id: 999, showDate: "2020-05-01" });

    expect(await db.attendedShows.get(999)).toEqual({
      show_id: 999,
      showDate: "2020-05-01",
    });
    expect(await db.archiveShows.count()).toBe(0);
  });

  it("mark online-fallback: writes attendedShows + the archiveShows cache row atomically", async () => {
    await markShowAttended({
      show_id: fallbackSetlist.show_id,
      showDate: fallbackSetlist.date,
      cachedSetlist: fallbackSetlist,
    });

    expect(await db.attendedShows.get(fallbackSetlist.show_id)).toEqual({
      show_id: fallbackSetlist.show_id,
      showDate: fallbackSetlist.date,
    });
    expect(await db.archiveShows.get(fallbackSetlist.show_id)).toEqual(
      fallbackSetlist,
    );
  });

  it("unmark removes BOTH the attendedShows stub and the archiveShows cache row", async () => {
    await markShowAttended({
      show_id: fallbackSetlist.show_id,
      showDate: fallbackSetlist.date,
      cachedSetlist: fallbackSetlist,
    });

    await unmarkShowAttended(fallbackSetlist.show_id);

    expect(await db.attendedShows.get(fallbackSetlist.show_id)).toBeUndefined();
    expect(await db.archiveShows.get(fallbackSetlist.show_id)).toBeUndefined();
  });

  it("unmark leaves other tables untouched", async () => {
    await db.meta.put({ key: "keepMe", value: "yes" });
    await markShowAttended({ show_id: 999, showDate: "2020-05-01" });

    await unmarkShowAttended(999);

    expect(await db.meta.get("keepMe")).toEqual({ key: "keepMe", value: "yes" });
  });

  it("re-marking the same show_id is idempotent (&show_id upsert, no duplicate row)", async () => {
    await markShowAttended({
      show_id: fallbackSetlist.show_id,
      showDate: fallbackSetlist.date,
      cachedSetlist: fallbackSetlist,
    });
    await markShowAttended({
      show_id: fallbackSetlist.show_id,
      showDate: fallbackSetlist.date,
      cachedSetlist: { ...fallbackSetlist, city: "Updated" },
    });

    expect(await db.attendedShows.count()).toBe(1);
    expect(await db.archiveShows.count()).toBe(1);
    expect((await db.archiveShows.get(fallbackSetlist.show_id))?.city).toBe(
      "Updated",
    );
  });
});

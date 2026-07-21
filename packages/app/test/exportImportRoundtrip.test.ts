import { exportEnvelope, serializeExport, type BingoCard } from "@guezzer/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "../src/config.ts";
import {
  db,
  importSnapshot,
  markShowAttended,
  setMeta,
  snapshot,
  type ArchiveShowRow,
  type AttendedShow,
  type MetaRow,
  type TrackedEntry,
  type TrackedShow,
} from "../src/db/db.ts";
import { exportBackup } from "../src/settings/exportDownload.ts";
import { pickAndImport } from "../src/settings/importPicker.ts";

/**
 * PWA-04 lose-a-phone guarantee: a full export→import round-trip through Dexie
 * preserves every row, and a corrupt file is rejected with ZERO DB mutation
 * (D-12 / Pitfall 5). Runs under jsdom + fake-indexeddb (test/setup.ts).
 *
 * The anchor-download side effect is stubbed via `URL.createObjectURL` so the
 * serialized Blob can be captured and asserted against the core envelope
 * schema, and re-fed as a `File` to `pickAndImport` for the round-trip.
 */

const seededMeta: MetaRow = { key: "persistStatus", value: "persisted" };
const seededAttended: AttendedShow = {
  show_id: 1234567890,
  showDate: "2026-08-15",
};
const seededShow: TrackedShow = {
  sessionId: "session-abc",
  date: "2026-08-15",
  status: "finalized",
  currentSetNumber: "e",
  startedAt: 1_700_000_000_000,
  showId: null,
  venueId: null,
  venueName: null,
  city: null,
};
const seededEntry: TrackedEntry = {
  id: 1,
  sessionId: "session-abc",
  position: 1,
  songId: 42,
  songName: "Rattlesnake",
  setNumber: "1",
  outcome: "hit",
  shownFanSongIds: [42, 7, 9],
  isPlaceholder: false,
  source: "manual",
  loggedAt: 1_700_000_000_500,
};

let capturedBlob: Blob | null = null;

async function seedAll(): Promise<void> {
  await db.meta.put(seededMeta);
  await db.attendedShows.put(seededAttended);
  await db.trackedShows.put(seededShow);
  await db.trackedEntries.put(seededEntry);
}

async function wipeAll(): Promise<void> {
  await db.meta.clear();
  await db.attendedShows.clear();
  await db.trackedShows.clear();
  await db.trackedEntries.clear();
  await db.archiveShows.clear();
}

async function tableCounts() {
  return {
    meta: await db.meta.count(),
    attendedShows: await db.attendedShows.count(),
    trackedShows: await db.trackedShows.count(),
    trackedEntries: await db.trackedEntries.count(),
  };
}

describe("export/import round-trip (PWA-04 lose-a-phone guarantee)", () => {
  beforeEach(async () => {
    await wipeAll();
    capturedBlob = null;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return "blob:mock-url";
    });
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exportBackup serializes a valid envelope and never throws", async () => {
    await seedAll();

    const result = await exportBackup();

    expect(result).toEqual({ ok: true });
    expect(capturedBlob).not.toBeNull();

    const json = await capturedBlob!.text();
    const parsed = exportEnvelope.parse(JSON.parse(json));
    expect(parsed.schemaVersion).toBe(config.dataSafety.SCHEMA_VERSION);
    expect(parsed.trackedEntries).toHaveLength(1);
    expect(parsed.trackedShows).toHaveLength(1);
  });

  it("re-imports an exported backup and preserves every seeded row", async () => {
    await seedAll();
    await exportBackup();
    const json = await capturedBlob!.text();

    // Simulate losing the phone: wipe everything, then import the backup file.
    await wipeAll();
    expect(await tableCounts()).toEqual({
      meta: 0,
      attendedShows: 0,
      trackedShows: 0,
      trackedEntries: 0,
    });

    const file = new File([json], "guezzer-backup.json", {
      type: "application/json",
    });
    const result = await pickAndImport(file);

    expect(result.ok).toBe(true);
    expect(await db.meta.get("persistStatus")).toEqual(seededMeta);
    expect(await db.attendedShows.get(1234567890)).toEqual(seededAttended);
    expect(await db.trackedShows.get("session-abc")).toEqual(seededShow);
    // trackedEntries now commits by logical identity (clear + bulkAdd), not by
    // the volatile ++id (CR-01 / T-05-07): clear() does not reset Dexie's id
    // generator, and seedAll()'s put({id:1,...}) already advanced it, so the
    // re-imported row lands at a fresh id (>= 2), not id 1. Resolve by
    // (sessionId, position) — the logical survival key — and compare fields
    // excluding the volatile id.
    const reimported = await db.trackedEntries
      .where("[sessionId+position]")
      .equals([seededEntry.sessionId, seededEntry.position])
      .first();
    const { id: _seededId, ...seededEntryWithoutId } = seededEntry;
    expect(reimported).toBeDefined();
    const { id: _reimportedId, ...reimportedWithoutId } = reimported!;
    expect(reimportedWithoutId).toEqual(seededEntryWithoutId);
  });

  it("round-trips the rotationRunResetDate marker unchanged (PRED-03, plan 11-05)", async () => {
    // The Settings reset control (PRED-03) writes this free-form db.meta row. It
    // must survive a full backup round-trip or a restored phone would silently
    // re-suppress a run the owner explicitly reset (T-11-05-02).
    await seedAll();
    await setMeta("rotationRunResetDate", "2026-08-16");

    await exportBackup();
    const json = await capturedBlob!.text();

    await wipeAll();
    expect(await db.meta.get("rotationRunResetDate")).toBeUndefined();

    const file = new File([json], "guezzer-backup.json", {
      type: "application/json",
    });
    const result = await pickAndImport(file);

    expect(result.ok).toBe(true);
    expect(await db.meta.get("rotationRunResetDate")).toEqual({
      key: "rotationRunResetDate",
      value: "2026-08-16",
    });
  });

  it("rejects a malformed file with ok:false and mutates nothing (D-12)", async () => {
    await seedAll();
    const before = await tableCounts();

    const file = new File(["this is not json {{{"], "corrupt.json", {
      type: "application/json",
    });
    const result = await pickAndImport(file);

    expect(result.ok).toBe(false);
    expect(await tableCounts()).toEqual(before);
    // The seeded rows are untouched — verify identity, not just counts.
    expect(await db.trackedEntries.get(1)).toEqual(seededEntry);
  });

  it("rejects a well-formed-but-not-a-backup file without mutation (D-12)", async () => {
    await seedAll();
    const before = await tableCounts();

    const file = new File([JSON.stringify({ hello: "world" })], "wrong.json", {
      type: "application/json",
    });
    const result = await pickAndImport(file);

    expect(result.ok).toBe(false);
    expect(await tableCounts()).toEqual(before);
  });
});

describe("import into a populated DB with overlapping ids preserves every local + incoming row (D-10)", () => {
  beforeEach(async () => {
    await wipeAll();
  });

  it("unions a local show and an incoming show whose trackedEntry ids collide, dropping nothing", async () => {
    // Seed the DB with a LOCAL tracked show holding trackedEntry ids 1 and 2 —
    // deliberately NOT wiped before import (this is the populated-DB case the
    // old bulkPut-by-id code silently collapsed, CR-01).
    const localShow: TrackedShow = {
      sessionId: "session-local",
      date: "2026-08-15",
      status: "finalized",
      currentSetNumber: "e",
      startedAt: 1_700_000_000_000,
      showId: null,
      venueId: null,
      venueName: null,
      city: null,
    };
    const localEntry1: TrackedEntry = {
      id: 1,
      sessionId: "session-local",
      position: 1,
      songId: 42,
      songName: "LocalOne",
      setNumber: "1",
      outcome: "hit",
      shownFanSongIds: [42],
      isPlaceholder: false,
      source: "manual",
      loggedAt: 1_700_000_000_100,
    };
    const localEntry2: TrackedEntry = {
      id: 2,
      sessionId: "session-local",
      position: 2,
      songId: 43,
      songName: "LocalTwo",
      setNumber: "1",
      outcome: "hit",
      shownFanSongIds: [43],
      isPlaceholder: false,
      source: "manual",
      loggedAt: 1_700_000_000_200,
    };
    await db.trackedShows.put(localShow);
    await db.trackedEntries.put(localEntry1);
    await db.trackedEntries.put(localEntry2);

    // Build an INCOMING backup for a DIFFERENT show whose trackedEntry ids
    // OVERLAP the seeded local ids (also 1 and 2) — the exact collision the
    // old bulkPut-by-id code would have collapsed via last-write-wins.
    const incomingShow: TrackedShow = {
      sessionId: "session-incoming",
      date: "2026-09-01",
      status: "finalized",
      currentSetNumber: "e",
      startedAt: 1_700_100_000_000,
      showId: null,
      venueId: null,
      venueName: null,
      city: null,
    };
    const incomingEntry1: TrackedEntry = {
      id: 1,
      sessionId: "session-incoming",
      position: 1,
      songId: 99,
      songName: "IncomingOne",
      setNumber: "1",
      outcome: "hit",
      shownFanSongIds: [99],
      isPlaceholder: false,
      source: "manual",
      loggedAt: 1_700_100_000_100,
    };
    const incomingEntry2: TrackedEntry = {
      id: 2,
      sessionId: "session-incoming",
      position: 2,
      songId: 100,
      songName: "IncomingTwo",
      setNumber: "1",
      outcome: "hit",
      shownFanSongIds: [100],
      isPlaceholder: false,
      source: "manual",
      loggedAt: 1_700_100_000_200,
    };
    const envelope = serializeExport(
      {
        owner: null,
        meta: [],
        attendedShows: [],
        archiveShows: [],
        trackedShows: [incomingShow],
        trackedEntries: [incomingEntry1, incomingEntry2],
        bingoCards: [],
      },
      config.dataSafety.SCHEMA_VERSION,
    );
    const file = new File([JSON.stringify(envelope)], "friend-backup.json", {
      type: "application/json",
    });

    // Import WITHOUT wiping — the populated-DB case.
    const result = await pickAndImport(file);
    expect(result.ok).toBe(true);

    // Union count: 2 local + 2 incoming = 4 (all (sessionId, position) pairs
    // are distinct across the two shows).
    expect(await db.trackedEntries.count()).toBe(4);

    const localOne = await db.trackedEntries
      .where("[sessionId+position]")
      .equals(["session-local", 1])
      .first();
    const localTwo = await db.trackedEntries
      .where("[sessionId+position]")
      .equals(["session-local", 2])
      .first();
    const incomingOne = await db.trackedEntries
      .where("[sessionId+position]")
      .equals(["session-incoming", 1])
      .first();
    const incomingTwo = await db.trackedEntries
      .where("[sessionId+position]")
      .equals(["session-incoming", 2])
      .first();

    expect(localOne?.songName).toBe("LocalOne");
    expect(localTwo?.songName).toBe("LocalTwo");
    expect(incomingOne?.songName).toBe("IncomingOne");
    expect(incomingTwo?.songName).toBe("IncomingTwo");

    // Both trackedShows survive — distinct sessionIds, distinct dates, so no
    // same-show dedupe collapse.
    expect(await db.trackedShows.get("session-local")).toBeDefined();
    expect(await db.trackedShows.get("session-incoming")).toBeDefined();
    expect(await db.trackedShows.count()).toBe(2);
  });

  it("a same-show dedupe collapse removes the dropped local trackedShow instead of leaving an orphaned duplicate (D-11)", async () => {
    // Seed a LOCAL show already bound to a show_id, with only 1 entry — the
    // "partially tracked, then a friend sends a richer backup for the same
    // night" scenario D-11 exists to collapse into ONE attendance record.
    const localThinShow: TrackedShow = {
      sessionId: "session-local-thin",
      date: "2026-08-20",
      status: "finalized",
      currentSetNumber: "e",
      startedAt: 1_700_200_000_000,
      showId: 999,
      venueId: 5,
      venueName: "Red Rocks",
      city: "Morrison",
    };
    const localThinEntry: TrackedEntry = {
      id: 1,
      sessionId: "session-local-thin",
      position: 1,
      songId: 1,
      songName: "ThinOne",
      setNumber: "1",
      outcome: "hit",
      shownFanSongIds: [1],
      isPlaceholder: false,
      source: "manual",
      loggedAt: 1_700_200_000_100,
    };
    await db.trackedShows.put(localThinShow);
    await db.trackedEntries.put(localThinEntry);

    // Incoming backup: a DIFFERENT sessionId bound to the SAME show_id, with
    // MORE entries — same attendance group (D-11), strictly richer, so it wins
    // the dedupe and the local session is the dropped duplicate.
    const incomingRichShow: TrackedShow = {
      sessionId: "session-incoming-rich",
      date: "2026-08-20",
      status: "finalized",
      currentSetNumber: "e",
      startedAt: 1_700_200_100_000,
      showId: 999,
      venueId: 5,
      venueName: "Red Rocks",
      city: "Morrison",
    };
    const incomingRichEntry1: TrackedEntry = {
      id: 1,
      sessionId: "session-incoming-rich",
      position: 1,
      songId: 1,
      songName: "RichOne",
      setNumber: "1",
      outcome: "hit",
      shownFanSongIds: [1],
      isPlaceholder: false,
      source: "manual",
      loggedAt: 1_700_200_100_100,
    };
    const incomingRichEntry2: TrackedEntry = {
      id: 2,
      sessionId: "session-incoming-rich",
      position: 2,
      songId: 2,
      songName: "RichTwo",
      setNumber: "1",
      outcome: "hit",
      shownFanSongIds: [2],
      isPlaceholder: false,
      source: "manual",
      loggedAt: 1_700_200_100_200,
    };
    const envelope = serializeExport(
      {
        owner: null,
        meta: [],
        attendedShows: [],
        archiveShows: [],
        trackedShows: [incomingRichShow],
        trackedEntries: [incomingRichEntry1, incomingRichEntry2],
        bingoCards: [],
      },
      config.dataSafety.SCHEMA_VERSION,
    );
    const file = new File([JSON.stringify(envelope)], "friend-rich-backup.json", {
      type: "application/json",
    });

    // Import WITHOUT wiping — the populated-DB case.
    const result = await pickAndImport(file);
    expect(result.ok).toBe(true);

    // The dedupe collapses both sessions into ONE canonical attendance — the
    // richer incoming show. The dropped local session must be REMOVED from
    // trackedShows, not left behind as an orphaned zero-entry duplicate.
    expect(await db.trackedShows.count()).toBe(1);
    expect(await db.trackedShows.get("session-local-thin")).toBeUndefined();
    expect(await db.trackedShows.get("session-incoming-rich")).toBeDefined();

    // Only the surviving canonical show's entries remain.
    expect(await db.trackedEntries.count()).toBe(2);
    const survivingEntries = await db.trackedEntries
      .where("sessionId")
      .equals("session-incoming-rich")
      .toArray();
    expect(survivingEntries).toHaveLength(2);
    const droppedEntries = await db.trackedEntries
      .where("sessionId")
      .equals("session-local-thin")
      .toArray();
    expect(droppedEntries).toHaveLength(0);
  });
});

describe("envelope v2 round-trip: archiveShows + owner (plan 06-07 / Pitfall 5)", () => {
  beforeEach(async () => {
    await wipeAll();
    capturedBlob = null;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return "blob:mock-url";
    });
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await wipeAll();
  });

  const cachedSetlist: ArchiveShowRow = {
    show_id: 1782000000,
    date: "2026-07-13",
    venueName: "Red Rocks Amphitheatre",
    city: "Morrison",
    sets: [{ n: "1", songs: [{ songId: 42, songName: "Rattlesnake" }] }],
  };

  it("a fallback-marked show's archiveShows cache row survives snapshot → clear → importSnapshot (Pitfall 5)", async () => {
    // Mark a show from the online archive, caching its setlist.
    await markShowAttended({
      show_id: cachedSetlist.show_id,
      showDate: cachedSetlist.date,
      cachedSetlist,
    });

    // Snapshot (the backup shape), then simulate losing the phone.
    const snap = await snapshot();
    expect(snap.archiveShows).toHaveLength(1);
    await wipeAll();
    expect(await db.archiveShows.count()).toBe(0);

    // Restore from the snapshot — the cached setlist must come back, or the
    // fallback mark would credit zero sightings after reload (data loss).
    await importSnapshot(snap);
    expect(await db.archiveShows.get(cachedSetlist.show_id)).toEqual(
      cachedSetlist,
    );
    expect(await db.attendedShows.get(cachedSetlist.show_id)).toBeDefined();
  });

  it("snapshot().owner reflects the meta ownerName (set → value, unset → null)", async () => {
    expect((await snapshot()).owner).toBeNull();

    await setMeta("ownerName", "Matt");
    expect((await snapshot()).owner).toBe("Matt");
  });

  it("importSnapshot does NOT write owner into meta (owner is a fork key, not merged state)", async () => {
    const snap = await snapshot();
    await importSnapshot({ ...snap, owner: "Friend" });

    // No ownerName meta row was created by the import.
    expect(await db.meta.get("ownerName")).toBeUndefined();
  });

  it("a full exportBackup envelope is schemaVersion 2 and carries owner + archiveShows", async () => {
    await setMeta("ownerName", "Matt");
    await markShowAttended({
      show_id: cachedSetlist.show_id,
      showDate: cachedSetlist.date,
      cachedSetlist,
    });

    await exportBackup();
    const json = await capturedBlob!.text();
    const parsed = exportEnvelope.parse(JSON.parse(json));

    expect(parsed.schemaVersion).toBe(config.dataSafety.SCHEMA_VERSION);
    expect(parsed.owner).toBe("Matt");
    expect(parsed.archiveShows).toHaveLength(1);
    expect(parsed.archiveShows[0].show_id).toBe(cachedSetlist.show_id);
  });
});

describe("envelope v3 round-trip: bingoCards (BINGO-07, plan 15-02)", () => {
  beforeEach(async () => {
    await wipeAll();
    await db.bingoCards.clear();
    capturedBlob = null;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return "blob:mock-url";
    });
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await wipeAll();
    await db.bingoCards.clear();
  });

  function makeCard(seed = "seed-1"): BingoCard {
    const squares = Array.from({ length: 16 }, (_, i) =>
      i === 12
        ? ({ kind: "free" } as const)
        : ({ kind: "song", songId: i + 1, label: `Song ${i + 1}` } as const),
    );
    return {
      schemaVersion: 1,
      seed,
      vibe: "balanced",
      corpusVersion: "test-corpus",
      freeIndex: 12,
      squares,
    };
  }

  it("the export envelope is stamped SCHEMA_VERSION 3", () => {
    expect(config.dataSafety.SCHEMA_VERSION).toBe(3);
  });

  it("a seeded bingoCards row survives a full export -> import round-trip", async () => {
    await db.bingoCards.put({
      cardId: "session-abc",
      sessionId: "session-abc",
      card: makeCard("rocket-seed"),
      caughtSnapshot: [42, 7],
      lockedAt: 1_700_000_000_000,
      showDate: "2026-08-15",
      venueName: "Red Rocks",
      city: "Morrison",
    });

    await exportBackup();
    const json = await capturedBlob!.text();
    const parsed = exportEnvelope.parse(JSON.parse(json));
    expect(parsed.schemaVersion).toBe(3);
    expect(parsed.bingoCards).toHaveLength(1);

    // Lose the phone, then restore from the backup file.
    await db.bingoCards.clear();
    expect(await db.bingoCards.count()).toBe(0);

    const file = new File([json], "guezzer-backup.json", {
      type: "application/json",
    });
    const result = await pickAndImport(file);
    expect(result.ok).toBe(true);

    const restored = await db.bingoCards.get("session-abc");
    expect(restored).toBeDefined();
    expect(restored?.card.seed).toBe("rocket-seed");
    expect(restored?.caughtSnapshot).toEqual([42, 7]);
    expect(restored?.lockedAt).toBe(1_700_000_000_000);
    expect(restored?.venueName).toBe("Red Rocks");
  });

  it("a v2 backup with no bingoCards key still imports (MIGRATIONS[2] / .default([]))", async () => {
    // Hand-build a genuine pre-v3 envelope: schemaVersion 2, no bingoCards key.
    const v2Envelope = {
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      owner: null,
      meta: [{ key: "persistStatus", value: "persisted" }],
      attendedShows: [{ show_id: 1234567890, showDate: "2026-08-15" }],
      archiveShows: [],
      trackedShows: [],
      trackedEntries: [],
    };
    const file = new File([JSON.stringify(v2Envelope)], "v2-backup.json", {
      type: "application/json",
    });

    const result = await pickAndImport(file);
    expect(result.ok).toBe(true);
    // The pre-v3 backup carried no cards; the field defaults to [] cleanly.
    expect(await db.bingoCards.count()).toBe(0);
    expect(await db.meta.get("persistStatus")).toBeDefined();
  });
});

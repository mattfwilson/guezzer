import { exportEnvelope, serializeExport } from "@guezzer/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "../src/config.ts";
import {
  db,
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
        meta: [],
        attendedShows: [],
        trackedShows: [incomingShow],
        trackedEntries: [incomingEntry1, incomingEntry2],
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
});

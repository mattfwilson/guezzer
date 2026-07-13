import { exportEnvelope } from "@guezzer/core";
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

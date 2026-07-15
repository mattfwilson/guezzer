import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { config } from "../src/config.ts";
import {
  db,
  setMeta,
  snapshot,
  type TrackedEntry,
  type TrackedShow,
} from "../src/db/db.ts";
import { classifyImport, pickAndImport } from "../src/settings/importPicker.ts";

/**
 * Import fork (D-17, RESEARCH Pattern 5, plan 06-10). `classifyImport` runs the
 * strict zod gate FIRST, then forks on `envelope.owner` vs the local owner name
 * BEFORE any merge code is reachable — so a friend's file structurally never
 * reaches parseAndMergeImport/importSnapshot (the two functions that write). The
 * zero-writes proof (snapshot before/after) is the D-17 guarantee: classifying a
 * friend file mutates NOTHING. Runs under jsdom + fake-indexeddb (test/setup.ts).
 */

async function resetDb(): Promise<void> {
  db.close();
  await Dexie.delete(config.DB_NAME);
  await db.open();
}

/** A valid v2 envelope object; override any field (owner defaults to null). */
function envelope(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 2,
    exportedAt: "2026-07-14T00:00:00.000Z",
    owner: null,
    meta: [],
    attendedShows: [],
    archiveShows: [],
    trackedShows: [],
    trackedEntries: [],
    ...over,
  };
}

/** A genuine v1 file: no `owner` / `archiveShows` keys at all (schemaVersion 1). */
function v1Envelope(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    exportedAt: "2025-01-01T00:00:00.000Z",
    meta: [],
    attendedShows: [],
    trackedShows: [],
    trackedEntries: [],
  };
}

const jsonOf = (o: unknown): string => JSON.stringify(o);

describe("classifyImport — the D-17 compare-vs-merge fork (Pattern 5)", () => {
  beforeEach(resetDb);
  afterEach(resetDb);

  it("kind=invalid for non-JSON and for a well-formed non-backup", () => {
    expect(classifyImport("not json {{{", null).kind).toBe("invalid");
    expect(classifyImport(jsonOf({ hello: "world" }), null).kind).toBe("invalid");
  });

  it("kind=mine when the file owner matches the local owner (case/space-insensitive)", () => {
    const result = classifyImport(jsonOf(envelope({ owner: "  Matt  " })), "matt");
    expect(result.kind).toBe("mine");
  });

  it("kind=friend when the file owner differs from the local owner", () => {
    const result = classifyImport(jsonOf(envelope({ owner: "Alice" })), "Matt");
    expect(result.kind).toBe("friend");
    if (result.kind === "friend") expect(result.envelope.owner).toBe("Alice");
  });

  it("kind=friend when the file is owned but the local owner is unset", () => {
    expect(classifyImport(jsonOf(envelope({ owner: "Alice" })), null).kind).toBe("friend");
  });

  it("kind=unowned when the file owner is null", () => {
    expect(classifyImport(jsonOf(envelope({ owner: null })), "Matt").kind).toBe("unowned");
  });

  it("kind=unowned for a genuine v1 file (no owner key) — the prompt path", () => {
    expect(classifyImport(jsonOf(v1Envelope()), "Matt").kind).toBe("unowned");
  });

  it("D-17 zero-writes proof: classifying a friend file mutates NO table", async () => {
    // Seed representative local state across every table.
    await setMeta("ownerName", "Matt");
    await db.attendedShows.put({ show_id: 111, showDate: "2020-01-01" });
    const before = await snapshot();

    const friendJson = jsonOf(
      envelope({
        owner: "Alice",
        attendedShows: [{ show_id: 222, showDate: "2021-02-02" }],
      }),
    );
    const result = classifyImport(friendJson, "Matt");
    expect(result.kind).toBe("friend");

    // The friend path NEVER calls importSnapshot — every table is byte-identical.
    const after = await snapshot();
    expect(after).toEqual(before);
  });

  it("the merge path is still green for a 'mine' file (parseAndMergeImport commits)", async () => {
    await setMeta("ownerName", "Matt");

    const trackedShow: TrackedShow = {
      sessionId: "s-mine",
      date: "2026-07-14",
      status: "finalized",
      currentSetNumber: "1",
      startedAt: 1,
      showId: null,
      venueId: null,
      venueName: null,
      city: null,
    };
    const trackedEntry: Omit<TrackedEntry, "id"> = {
      sessionId: "s-mine",
      position: 1,
      songId: 42,
      songName: "Rattlesnake",
      setNumber: "1",
      outcome: "hit",
      shownFanSongIds: [],
      isPlaceholder: false,
      source: "manual",
      loggedAt: 1,
    };
    const mineJson = jsonOf(
      envelope({ owner: "Matt", trackedShows: [trackedShow], trackedEntries: [trackedEntry] }),
    );

    const result = classifyImport(mineJson, "Matt");
    expect(result.kind).toBe("mine");

    const file = new File([mineJson], "mine.json", { type: "application/json" });
    const outcome = await pickAndImport(file);
    expect(outcome.ok).toBe(true);
    expect(await db.trackedShows.get("s-mine")).toBeDefined();
  });
});

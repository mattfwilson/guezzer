import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { config } from "../src/config.ts";
import {
  db,
  getMeta,
  setMeta,
  snapshot,
  type TrackedEntry,
  type TrackedShow,
} from "../src/db/db.ts";
import { classifyImport, pickAndImport } from "../src/settings/importPicker.ts";
import { isTypedNameMine } from "../src/settings/ownerMatch.ts";
import { writeIdentityRecord } from "../src/auth/identityRecord.ts";

// The signed-in identity pickAndImport self-sources (plan 18-07): seeded local
// rows are stamped with it so the userId-scoped local snapshot includes them.
const FORK_USER = "user-fork";

// pickAndImport reads readIdentityRecord() — set an identity before every test.
beforeEach(() => {
  writeIdentityRecord({ userId: FORK_USER, displayName: "Fork Tester" });
});

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

  it("kind=unowned when the file is owned but the local owner is unset (WARNING-1: evicted-DB restore must reach the 'Whose dex is this?' prompt, not silent friend-compare)", () => {
    const result = classifyImport(jsonOf(envelope({ owner: "Alice" })), null);
    expect(result.kind).toBe("unowned");
    // Envelope carries through so the prompt's "It's mine, restore it" path works.
    if (result.kind === "unowned") expect(result.envelope.owner).toBe("Alice");
    // A blank/whitespace local owner is treated the same as null.
    expect(classifyImport(jsonOf(envelope({ owner: "Alice" })), "   ").kind).toBe("unowned");
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
    const before = await snapshot("user-fork");

    const friendJson = jsonOf(
      envelope({
        owner: "Alice",
        attendedShows: [{ show_id: 222, showDate: "2021-02-02" }],
      }),
    );
    const result = classifyImport(friendJson, "Matt");
    expect(result.kind).toBe("friend");

    // The friend path NEVER calls importSnapshot — every table is byte-identical.
    const after = await snapshot("user-fork");
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

  it("evicted DB + typed own name: union merge preserves local data — PWA-05", async () => {
    // Evicted-DB state: NO ownerName meta row (clearTables/resetDb leaves it unset).
    // Seed local rows across two tables (stamped with the signed-in identity so
    // the userId-scoped local snapshot includes them) so the union is proven
    // across the schema.
    await db.attendedShows.put({ show_id: 111, showDate: "2020-01-01", userId: FORK_USER });
    const localShow: TrackedShow = {
      sessionId: "s-local",
      date: "2020-01-01",
      status: "finalized",
      currentSetNumber: "1",
      startedAt: 1,
      showId: null,
      venueId: null,
      venueName: null,
      city: null,
      userId: FORK_USER,
    };
    await db.trackedShows.put(localShow);

    // The backup is owned by "Matt" and carries a DIFFERENT attended show (222).
    const fileJson = jsonOf(
      envelope({
        owner: "Matt",
        attendedShows: [{ show_id: 222, showDate: "2021-02-02" }],
      }),
    );

    // The decision leg wired to the merge leg: this is exactly what
    // resolveNamePrompt evaluates before calling mergeFile on the evicted-DB
    // typed-name path — local owner unset (null), file owner "Matt".
    expect(isTypedNameMine("matt", null, "Matt")).toBe(true);

    // Run the REAL (unmocked) merge + atomic commit.
    const outcome = await pickAndImport(
      new File([fileJson], "mine.json", { type: "application/json" }),
    );
    expect(outcome.ok).toBe(true);

    // Union, zero drops: the seeded local rows survive AND the file's row is added.
    expect(await db.attendedShows.get(111)).toBeDefined(); // local kept
    expect(await db.attendedShows.get(222)).toBeDefined(); // file added
    expect(await db.trackedShows.get("s-local")).toBeDefined(); // second-table local kept

    // Owner is a device-local fork key, never written to meta on import (06-07).
    expect(await getMeta<string>("ownerName")).toBeUndefined();
  });
});

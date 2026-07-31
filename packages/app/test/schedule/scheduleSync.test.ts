import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Schedule-picks fence + toggle path (owner request 2026-07-30). The Supabase
 * singleton is mocked (no network); Dexie runs on fake-indexeddb. These pin
 * the validateFriendRow-style row validation, the offline-first own-row
 * policy (local truth never clobbered by a pull; adopted only on a fresh
 * device), the friend-slice wholesale replace, and the local toggle flow.
 */

const mock = vi.hoisted(() => {
  const capture = {
    selectResult: { data: [] as unknown[] | null, error: null as unknown },
  };
  const upsertSpy = vi.fn((..._args: unknown[]) => Promise.resolve({ error: null as unknown }));
  const selectSpy = vi.fn(() => Promise.resolve(capture.selectResult));
  const fromSpy = vi.fn(() => ({ upsert: upsertSpy, select: selectSpy }));
  const subscribeSpy = vi.fn(() => ({ __channel: "schedule-feed" }));
  const builder = {
    on: vi.fn((_e: unknown, _f: unknown, _cb: () => void) => builder),
    subscribe: subscribeSpy,
  };
  return {
    capture,
    upsertSpy,
    selectSpy,
    fromSpy,
    channelSpy: vi.fn(() => builder),
    removeChannelSpy: vi.fn(() => Promise.resolve()),
  };
});

vi.mock("../../src/db/supabase.ts", () => ({
  supabase: {
    from: mock.fromSpy,
    channel: mock.channelSpy,
    removeChannel: mock.removeChannelSpy,
  },
}));

const { refreshAllPicks, validatePicksRow } = await import("../../src/schedule/scheduleSync.ts");
const { toggleOwnPick } = await import("../../src/schedule/useScheduleSync.ts");
const { scheduleEventIds } = await import("../../src/schedule/scheduleArtifact.ts");
const { db } = await import("../../src/db/db.ts");

const VALID = new Set(["fri-main-2000", "sat-main-2000", "sun-main-1900"]);
const ME = { userId: "me", displayName: "Max" };

async function resetDb(): Promise<void> {
  await db.delete();
  await db.open();
}

beforeEach(resetDb);
afterEach(resetDb);

describe("validatePicksRow", () => {
  const row = {
    user_id: "friend-1",
    display_name: "Tim",
    event_ids: ["fri-main-2000", "not-an-event"],
    updated_at: "2026-08-14T20:00:00Z",
  };

  it("keeps known ids, drops unknown, carries identity columns", () => {
    expect(validatePicksRow(row, VALID)).toEqual({
      userId: "friend-1",
      displayName: "Tim",
      eventIds: ["fri-main-2000"],
      updatedAt: "2026-08-14T20:00:00Z",
    });
  });

  it("skips structurally hostile rows (empty name, non-array picks)", () => {
    expect(validatePicksRow({ ...row, display_name: "" }, VALID)).toBeNull();
    expect(validatePicksRow({ ...row, event_ids: "nope" }, VALID)).toBeNull();
    expect(validatePicksRow(null, VALID)).toBeNull();
  });
});

describe("refreshAllPicks (offline-first own-row policy)", () => {
  it("replaces the friend slice wholesale and NEVER clobbers a local own row", async () => {
    await db.schedulePicks.bulkPut([
      { userId: "me", displayName: "Max", eventIds: ["sun-main-1900"], updatedAt: null, fetchedAt: 1 },
      { userId: "departed", displayName: "Gone", eventIds: [], updatedAt: null, fetchedAt: 1 },
    ]);
    mock.capture.selectResult = {
      data: [
        { user_id: "me", display_name: "Max", event_ids: ["fri-main-2000"], updated_at: null },
        { user_id: "friend-1", display_name: "Tim", event_ids: ["sat-main-2000"], updated_at: null },
      ],
      error: null,
    };

    await refreshAllPicks("me", VALID);

    const own = await db.schedulePicks.get("me");
    expect(own?.eventIds).toEqual(["sun-main-1900"]); // local truth, not the server echo
    expect(await db.schedulePicks.get("departed")).toBeUndefined(); // wholesale replace
    expect((await db.schedulePicks.get("friend-1"))?.eventIds).toEqual(["sat-main-2000"]);
  });

  it("adopts the server's own row on a fresh device (no local row)", async () => {
    mock.capture.selectResult = {
      data: [{ user_id: "me", display_name: "Max", event_ids: ["fri-main-2000"], updated_at: null }],
      error: null,
    };
    await refreshAllPicks("me", VALID);
    expect((await db.schedulePicks.get("me"))?.eventIds).toEqual(["fri-main-2000"]);
  });

  it("returns null on a select error and leaves the cache untouched", async () => {
    await db.schedulePicks.put({
      userId: "friend-1", displayName: "Tim", eventIds: [], updatedAt: null, fetchedAt: 1,
    });
    mock.capture.selectResult = { data: null, error: { message: "boom" } };
    expect(await refreshAllPicks("me", VALID)).toBeNull();
    expect(await db.schedulePicks.get("friend-1")).toBeDefined();
  });
});

describe("toggleOwnPick (local-first)", () => {
  it("adds then removes an id on the own Dexie row, instantly, via real artifact ids", async () => {
    const [realId] = [...scheduleEventIds()];
    await toggleOwnPick(ME, realId);
    expect((await db.schedulePicks.get("me"))?.eventIds).toEqual([realId]);
    await toggleOwnPick(ME, realId);
    expect((await db.schedulePicks.get("me"))?.eventIds).toEqual([]);
  });

  it("ignores an id the bundled artifact doesn't know", async () => {
    await toggleOwnPick(ME, "totally-fake-event");
    expect(await db.schedulePicks.get("me")).toBeUndefined();
  });
});

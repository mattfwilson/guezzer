import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DexStats, SharedProgress } from "@guezzer/core";

/**
 * Phase-19 sync PRIMITIVES + shared store (PROG-02/05, D-15/D-18/D-19). The
 * Supabase singleton is mocked so NO network I/O happens: `.from().upsert`,
 * `.from().select`, and `.channel().on().subscribe()` are spies. These pin the
 * identity-safe write discipline (content vs identity-only), the validated
 * own-excluded re-pull with malformed-row skipping, the subscription filter, and
 * the external-store seam the app-wide engine writes.
 */

const mock = vi.hoisted(() => {
  const capture = {
    onChange: null as null | (() => void),
    selectResult: { data: [] as unknown[] | null, error: null as unknown },
  };
  const upsertSpy = vi.fn((..._args: unknown[]) => Promise.resolve({ error: null as unknown }));
  const selectSpy = vi.fn(() => Promise.resolve(capture.selectResult));
  const fromSpy = vi.fn(() => ({ upsert: upsertSpy, select: selectSpy }));
  const subscribeSpy = vi.fn(() => ({ __channel: "progress-feed" }));
  const onSpy = vi.fn((_evt: unknown, _filter: unknown, cb: () => void) => {
    capture.onChange = cb;
    return { subscribe: subscribeSpy };
  });
  const channelSpy = vi.fn(() => ({ on: onSpy }));
  const removeChannelSpy = vi.fn(() => Promise.resolve());
  return {
    capture,
    upsertSpy,
    selectSpy,
    fromSpy,
    subscribeSpy,
    onSpy,
    channelSpy,
    removeChannelSpy,
  };
});

vi.mock("../../src/db/supabase.ts", () => ({
  supabase: {
    from: mock.fromSpy,
    channel: mock.channelSpy,
    removeChannel: mock.removeChannelSpy,
  },
}));

const {
  upsertOwnProgress,
  upsertIdentity,
  refreshAllFriends,
  subscribeProgress,
  getSyncState,
  setSyncState,
  subscribeSyncState,
  resetSyncState,
} = await import("../../src/sync/progressSync.ts");
const { readFriendCache } = await import("../../src/sync/friendCache.ts");
const { db } = await import("../../src/db/db.ts");

const MY_ID = "me-user-id";

function fakeDex(): DexStats {
  const perSong: DexStats["perSong"] = new Map();
  perSong.set(1, { songId: 1, sightings: 1, lastSeenDate: null, personalGap: null, tier: "rare" });
  perSong.set(2, { songId: 2, sightings: 1, lastSeenDate: null, personalGap: null, tier: "common" });
  return {
    completion: { caught: 2, total: 100, pct: 2 },
    perSong,
    neverSeen: [],
    rarestCatch: { songId: 1, tier: "rare" },
    showCount: 1,
    perAlbum: new Map(),
  };
}

function validSummary(caught: number): SharedProgress {
  return {
    v: 1,
    completion: { caught, total: 100, pct: caught },
    showCount: 1,
    rarest: caught > 0 ? { songId: 1, tier: "rare" } : null,
    tierCounts: { common: caught, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
    perAlbum: [],
    caughtSongIds: caught > 0 ? [1] : [],
  };
}

beforeEach(async () => {
  mock.upsertSpy.mockClear();
  mock.selectSpy.mockClear();
  mock.fromSpy.mockClear();
  mock.subscribeSpy.mockClear();
  mock.onSpy.mockClear();
  mock.channelSpy.mockClear();
  mock.removeChannelSpy.mockClear();
  mock.capture.onChange = null;
  mock.capture.selectResult = { data: [], error: null };
  resetSyncState();
  await db.friendProgressCache.clear();
});
afterEach(() => vi.restoreAllMocks());

describe("upsertOwnProgress / upsertIdentity — identity-safe writes (PROG-02, D-15, T-19-identity)", () => {
  it("content write includes a full fresh summary + identity + updated_at", async () => {
    await upsertOwnProgress(MY_ID, "Ada", fakeDex());
    expect(mock.fromSpy).toHaveBeenCalledWith("progress");
    const payload = mock.upsertSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.user_id).toBe(MY_ID);
    expect(payload.display_name).toBe("Ada");
    expect(payload).toHaveProperty("summary");
    expect(payload).toHaveProperty("updated_at");
    // onConflict keeps RLS write-own idempotent by user_id.
    expect(mock.upsertSpy.mock.calls[0][1]).toEqual({ onConflict: "user_id" });
  });

  it("identity-only write touches {user_id, display_name} ONLY — never summary (Pitfall 4)", async () => {
    await upsertIdentity(MY_ID, "Ada");
    const payload = mock.upsertSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toEqual({ user_id: MY_ID, display_name: "Ada" });
    expect(payload).not.toHaveProperty("summary");
  });

  it("surfaces (throws) a supabase write error instead of swallowing it (WR-02)", async () => {
    // supabase-js RESOLVES on RLS/DB errors — the returned `{ error }` must be
    // read + thrown so a persistent failure is not indistinguishable from success.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mock.upsertSpy.mockResolvedValueOnce({ error: { message: "row violates RLS policy" } });
    await expect(upsertOwnProgress(MY_ID, "Ada", fakeDex())).rejects.toMatchObject({
      message: "row violates RLS policy",
    });
    expect(warn).toHaveBeenCalled();
  });
});

describe("refreshAllFriends — validated own-excluded re-pull (PROG-05, D-19)", () => {
  it("skips malformed rows + the own row, returns survivors, and caches them", async () => {
    mock.capture.selectResult = {
      data: [
        { user_id: "friend-1", display_name: "Bob", summary: validSummary(5), updated_at: "2026-07-23T00:00:00Z" },
        { user_id: MY_ID, display_name: "Me", summary: validSummary(9), updated_at: null },
        { user_id: "friend-2", display_name: "Eve", summary: { bogus: true }, updated_at: null },
      ],
      error: null,
    };
    const rows = await refreshAllFriends(MY_ID);
    expect(mock.selectSpy).toHaveBeenCalledTimes(1);
    expect(rows).not.toBeNull();
    expect(rows!.map((r) => r.userId)).toEqual(["friend-1"]); // own + malformed dropped
    // Cache written (offline backstop, D-18).
    const cached = await readFriendCache();
    expect(cached.rows.map((r) => r.userId)).toEqual(["friend-1"]);
    expect(cached.fetchedAt).toBeTypeOf("number");
  });

  it("skips a row whose display_name / user_id is null, non-string, or empty (CR-01, D-19)", async () => {
    // RLS is write-own → a friend controls their OWN row's columns; a null
    // display_name would crash the (error-boundary-less) Friends tab via .trim().
    mock.capture.selectResult = {
      data: [
        { user_id: "friend-ok", display_name: "Bob", summary: validSummary(5), updated_at: null },
        { user_id: "friend-null-name", display_name: null, summary: validSummary(3), updated_at: null },
        { user_id: null, display_name: "Ghost", summary: validSummary(2), updated_at: null },
        { user_id: "friend-empty-name", display_name: "", summary: validSummary(1), updated_at: null },
        { user_id: "friend-num-name", display_name: 42, summary: validSummary(1), updated_at: null },
      ],
      error: null,
    };
    const rows = await refreshAllFriends(MY_ID);
    expect(rows).not.toBeNull();
    // Only the fully-valid row survives; every hostile column shape is skipped.
    expect(rows!.map((r) => r.userId)).toEqual(["friend-ok"]);
    // And the crash-vector rows never reach the offline cache either.
    expect((await readFriendCache()).rows.map((r) => r.userId)).toEqual(["friend-ok"]);
  });

  it("returns null on a whole-select error (keeps last-known cache)", async () => {
    mock.capture.selectResult = { data: null, error: { message: "network" } };
    const rows = await refreshAllFriends(MY_ID);
    expect(rows).toBeNull();
  });

  it("prunes friends absent from a later non-empty pull — no dimmed ghosts (WR-03, D-18)", async () => {
    mock.capture.selectResult = {
      data: [
        { user_id: "friend-1", display_name: "Bob", summary: validSummary(5), updated_at: null },
        { user_id: "friend-2", display_name: "Eve", summary: validSummary(3), updated_at: null },
      ],
      error: null,
    };
    await refreshAllFriends(MY_ID);
    expect((await readFriendCache()).rows.map((r) => r.userId).sort()).toEqual([
      "friend-1",
      "friend-2",
    ]);

    // A later pull no longer includes friend-2 (row deleted/reset) → it must be
    // EVICTED from the offline cache, not linger as a stale last-known ghost.
    mock.capture.selectResult = {
      data: [
        { user_id: "friend-1", display_name: "Bob", summary: validSummary(5), updated_at: null },
      ],
      error: null,
    };
    await refreshAllFriends(MY_ID);
    expect((await readFriendCache()).rows.map((r) => r.userId)).toEqual(["friend-1"]);
  });

  it("leaves the last-known cache intact on an empty pull (offline backstop, WR-03)", async () => {
    mock.capture.selectResult = {
      data: [
        { user_id: "friend-1", display_name: "Bob", summary: validSummary(5), updated_at: null },
      ],
      error: null,
    };
    await refreshAllFriends(MY_ID);
    // An empty pull must NOT wipe the last-known friends the venue relies on.
    mock.capture.selectResult = { data: [], error: null };
    await refreshAllFriends(MY_ID);
    expect((await readFriendCache()).rows.map((r) => r.userId)).toEqual(["friend-1"]);
  });
});

describe("subscribeProgress — app-wide postgres_changes subscription (PROG-05, D-16)", () => {
  it("registers the '*' event on public.progress and relays events to onChange", () => {
    const onChange = vi.fn();
    subscribeProgress(onChange);
    expect(mock.channelSpy).toHaveBeenCalledWith("progress-feed");
    expect(mock.onSpy).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "*", schema: "public", table: "progress" },
      expect.any(Function),
    );
    expect(mock.subscribeSpy).toHaveBeenCalledTimes(1);
    // A live change event fans out to the caller's onChange.
    mock.capture.onChange?.();
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("shared sync store — the single engine→read-hook seam (D-16)", () => {
  it("merges partials, notifies subscribers, and keeps a stable ref between writes", () => {
    const before = getSyncState();
    const cb = vi.fn();
    const unsub = subscribeSyncState(cb);
    setSyncState({ offline: true, asOf: 123 });
    expect(cb).toHaveBeenCalledTimes(1);
    const after = getSyncState();
    expect(after).not.toBe(before); // new object on a real change
    expect(after.offline).toBe(true);
    expect(after.asOf).toBe(123);
    expect(getSyncState()).toBe(after); // stable ref until the next write
    unsub();
    setSyncState({ error: "x" });
    expect(cb).toHaveBeenCalledTimes(1); // unsubscribed → no further notifications
  });
});

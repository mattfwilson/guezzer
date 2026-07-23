import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SharedProgress } from "@guezzer/core";

/**
 * Phase-19 PURE read hook + `buildFriendRows` (PROG-03/04, D-03/D-05, D-16/D-18).
 * `buildFriendRows` is pure (no Supabase, no DOM) — self-exclusion + the D-05
 * ordering are provable in isolation. `useFriendsProgress` is a thin reader over
 * the shared store the engine publishes; here it is exercised by writing the store
 * directly (the engine's job) and asserting the hook re-renders to that state,
 * incl. the offline cached-rows path — WITHOUT the hook opening any subscription.
 *
 * The supabase singleton is mocked only so importing `progressSync.ts` (which
 * imports the singleton) does not construct a real client / hit the network.
 */

vi.mock("../../src/db/supabase.ts", () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}));

const { useFriendsProgress, buildFriendRows } = await import(
  "../../src/sync/useFriendsProgress.ts"
);
const { setSyncState, resetSyncState } = await import("../../src/sync/progressSync.ts");
import type { FriendRowData } from "../../src/sync/friendCache.ts";

function summary(caught: number, pct: number): SharedProgress {
  return {
    v: 1,
    completion: { caught, total: 100, pct },
    showCount: 1,
    rarest: caught > 0 ? { songId: 1, tier: "rare" } : null,
    tierCounts: { common: caught, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
    perAlbum: [],
    caughtSongIds: Array.from({ length: caught }, (_, i) => i + 1),
  };
}

function friend(userId: string, displayName: string, caught: number, pct: number): FriendRowData {
  return { userId, displayName, summary: summary(caught, pct), updatedAt: null };
}

beforeEach(() => resetSyncState());
afterEach(cleanup);

describe("buildFriendRows — deterministic order (PROG-03/04, D-03/D-05)", () => {
  it("excludes the own row and sorts completion desc → caught desc → name, 0-catch last", () => {
    const rows: FriendRowData[] = [
      friend("me", "Me", 50, 50), // own — excluded
      friend("f-zero", "Zed", 0, 0), // 0-catch → last (D-05)
      friend("f-mid", "Cal", 20, 20),
      friend("f-top", "Ann", 40, 40),
      friend("f-tieB", "Bea", 20, 20), // same 20% as Cal → name tie-break (Bea < Cal)
    ];
    const ordered = buildFriendRows(rows, "me");
    expect(ordered.map((r) => r.userId)).toEqual([
      "f-top", // 40%
      "f-tieB", // 20%, name "Bea"
      "f-mid", // 20%, name "Cal"
      "f-zero", // 0-catch last
    ]);
  });

  it("is pure — does not mutate its input array", () => {
    const rows = [friend("a", "A", 10, 10), friend("b", "B", 30, 30)];
    const snapshot = rows.map((r) => r.userId);
    buildFriendRows(rows, "none");
    expect(rows.map((r) => r.userId)).toEqual(snapshot);
  });
});

describe("useFriendsProgress — pure read over the shared store (D-16/D-18)", () => {
  it("re-renders to the shared sync state the engine publishes", () => {
    const { result } = renderHook(() => useFriendsProgress());
    expect(result.current.friends).toEqual([]);
    expect(result.current.offline).toBe(false);

    act(() => {
      setSyncState({
        friends: [friend("f-1", "Bob", 4, 4)],
        offline: true,
        asOf: 1_700_000_000_000,
      });
    });
    expect(result.current.friends.map((f) => f.userId)).toEqual(["f-1"]);
    expect(result.current.offline).toBe(true);
    expect(result.current.asOf).toBe(1_700_000_000_000); // "as of {time}" clock (D-18)
  });

  it("surfaces the degraded-read error the engine pushes (D-19), keeping last friends", () => {
    const { result } = renderHook(() => useFriendsProgress());
    act(() => {
      setSyncState({ friends: [friend("f-1", "Bob", 4, 4)] });
    });
    act(() => {
      setSyncState({ error: "Can't reach friends right now — showing the last sync." });
    });
    expect(result.current.error).toBe(
      "Can't reach friends right now — showing the last sync.",
    );
    expect(result.current.friends.map((f) => f.userId)).toEqual(["f-1"]); // not cleared
  });
});

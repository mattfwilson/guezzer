import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DexStats } from "@guezzer/core";
import { config } from "../../src/config.ts";

/**
 * Phase-19 app-wide-mount ACCEPTANCE test (D-16, PROG-02/05 — THE CRUX). This
 * pins the defect an isolated-hook test cannot catch: the engine must own the
 * subscription + the debounced own-row upsert INDEPENDENT of the Friends view, so
 * mounting a component whose ONLY sync surface is `useProgressSync()` — no
 * `FriendsList`, no Friends segment — still subscribes and still upserts as the
 * dex changes (the residency payoff while the user is in Show Mode / LiveGizz).
 *
 * The supabase singleton, `useAuthIdentity`, `useDexStats`, and `useOnlineStatus`
 * are all mocked so no network / no Dexie-derivation runs; `vi.useFakeTimers`
 * drives the ~5s debounce deterministically.
 */

const mock = vi.hoisted(() => {
  const capture = {
    onChange: null as null | (() => void),
    selectResult: { data: [] as unknown[] | null, error: null as unknown },
  };
  const state = {
    identity: { userId: "me", displayName: "Me" } as
      | { userId: string; displayName: string }
      | null,
    // A `DexStatsResult`-shaped value (loosely typed — the vi.mock factory is not
    // signature-checked against the real hook).
    dex: null as unknown,
    online: true,
    hidden: false,
  };
  const upsertSpy = vi.fn((..._args: unknown[]) => Promise.resolve({ error: null }));
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
    state,
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
vi.mock("../../src/auth/useAuthIdentity.ts", () => ({
  useAuthIdentity: () => mock.state.identity,
}));
vi.mock("../../src/dex/useDexStats.ts", () => ({
  useDexStats: () => mock.state.dex,
}));
vi.mock("../../src/live/useOnlineStatus.ts", () => ({
  useOnlineStatus: () => mock.state.online,
}));
vi.mock("../../src/sync/useVisibilityHidden.ts", () => ({
  useVisibilityHidden: () => mock.state.hidden,
}));

const { useProgressSync } = await import("../../src/sync/useProgressSync.ts");
const { resetSyncState, getSyncState } = await import("../../src/sync/progressSync.ts");
const { writeFriendCache } = await import("../../src/sync/friendCache.ts");
const { db } = await import("../../src/db/db.ts");

function fakeDex(caught: number): DexStats {
  const perSong: DexStats["perSong"] = new Map();
  for (let i = 1; i <= caught; i++) {
    perSong.set(i, { songId: i, sightings: 1, lastSeenDate: null, personalGap: null, tier: "common" });
  }
  return {
    completion: { caught, total: 100, pct: caught },
    perSong,
    neverSeen: [],
    rarestCatch: caught > 0 ? { songId: 1, tier: "common" } : null,
    showCount: 1,
    perAlbum: new Map(),
  };
}

/** A ready `DexStatsResult` wrapping a fresh dex reference (drives the debounce dep). */
function readyDex(caught: number) {
  return { ready: true, error: null, dex: fakeDex(caught), rarity: null, archive: null, albums: null };
}

/** The single sync surface under test — NO Friends UI is rendered. */
function EngineOnly() {
  useProgressSync();
  return <div>engine-only</div>;
}

beforeEach(async () => {
  // Clear Dexie with REAL timers first — fake-indexeddb schedules its callbacks
  // through timers/microtasks that `vi.useFakeTimers()` would freeze, hanging the
  // await. Enable fake timers only AFTER the async cache reset.
  await db.friendProgressCache.clear();
  vi.useFakeTimers();
  mock.upsertSpy.mockClear();
  mock.selectSpy.mockClear();
  mock.fromSpy.mockClear();
  mock.subscribeSpy.mockClear();
  mock.onSpy.mockClear();
  mock.channelSpy.mockClear();
  mock.removeChannelSpy.mockClear();
  mock.capture.onChange = null;
  mock.capture.selectResult = { data: [], error: null };
  mock.state.identity = { userId: "me", displayName: "Me" };
  mock.state.dex = readyDex(3);
  mock.state.online = true;
  mock.state.hidden = false;
  resetSyncState();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useProgressSync — app-wide engine (D-16, THE CRUX)", () => {
  it("(a) establishes the postgres_changes subscription with NO Friends view rendered", () => {
    render(<EngineOnly />);
    // The engine subscribed at the shell — independent of any Friends segment.
    expect(mock.channelSpy).toHaveBeenCalledWith("progress-feed");
    expect(mock.subscribeSpy).toHaveBeenCalledTimes(1);
    // First-sync full re-pull fired too.
    expect(mock.selectSpy).toHaveBeenCalled();
  });

  it("(b) a dex change fires exactly ONE debounced content upsert (coalesced), no Friends UI", () => {
    const { rerender } = render(<EngineOnly />); // schedules the initial (debounced) upsert timer
    // Drive a rapid dex change BEFORE the debounce elapses — the pending timer is
    // cleared and replaced (coalescing), so only one write survives.
    act(() => {
      mock.state.dex = readyDex(5);
      rerender(<EngineOnly />);
    });
    expect(mock.upsertSpy).not.toHaveBeenCalled(); // still within the debounce window
    act(() => {
      vi.advanceTimersByTime(config.friends.DEBOUNCE_MS);
    });
    expect(mock.upsertSpy).toHaveBeenCalledTimes(1);
    const payload = mock.upsertSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.user_id).toBe("me");
    expect(payload).toHaveProperty("summary"); // a CONTENT write (PROG-02)
  });

  it("(c) no signed-in identity → NO subscription, NO upsert (signed-in gate)", () => {
    mock.state.identity = null;
    render(<EngineOnly />);
    act(() => {
      vi.advanceTimersByTime(config.friends.DEBOUNCE_MS * 2);
    });
    expect(mock.channelSpy).not.toHaveBeenCalled();
    expect(mock.subscribeSpy).not.toHaveBeenCalled();
    expect(mock.upsertSpy).not.toHaveBeenCalled();
    expect(mock.selectSpy).not.toHaveBeenCalled();
  });

  it("a live postgres_changes event triggers a fresh full re-pull (PROG-05)", () => {
    render(<EngineOnly />);
    mock.selectSpy.mockClear();
    act(() => {
      mock.capture.onChange?.(); // simulate a friend's row moving
    });
    expect(mock.selectSpy).toHaveBeenCalledTimes(1);
  });

  it("offline → NO upsert / NO select; the store hydrates from the Dexie cache (D-18)", async () => {
    vi.useRealTimers(); // the offline hydrate reads Dexie (async) — real timers + waitFor
    await writeFriendCache(
      [
        {
          userId: "friend-1",
          displayName: "Bob",
          summary: {
            v: 1,
            completion: { caught: 4, total: 100, pct: 4 },
            showCount: 1,
            rarest: { songId: 1, tier: "rare" },
            tierCounts: { common: 0, uncommon: 0, rare: 1, epic: 0, legendary: 0 },
            perAlbum: [],
            caughtSongIds: [1],
          },
          updatedAt: null,
        },
      ],
      1_700_000_000_000,
    );
    mock.state.online = false;
    render(<EngineOnly />);
    await waitFor(() => {
      expect(getSyncState().offline).toBe(true);
      expect(getSyncState().friends.map((f) => f.userId)).toEqual(["friend-1"]);
    });
    expect(getSyncState().asOf).toBe(1_700_000_000_000);
    // Offline: the engine attempts no network writes/reads.
    expect(mock.upsertSpy).not.toHaveBeenCalled();
    expect(mock.selectSpy).not.toHaveBeenCalled();
    expect(mock.channelSpy).not.toHaveBeenCalled();
  });

  it("(g) re-subscribes + re-pulls on a background→foreground transition (IN-04)", () => {
    const { rerender } = render(<EngineOnly />);
    expect(mock.subscribeSpy).toHaveBeenCalledTimes(1);
    expect(mock.channelSpy).toHaveBeenCalledTimes(1);

    // Backgrounding (visible→hidden) must NOT re-open the subscription.
    act(() => {
      mock.state.hidden = true;
      rerender(<EngineOnly />);
    });
    expect(mock.subscribeSpy).toHaveBeenCalledTimes(1);
    expect(mock.channelSpy).toHaveBeenCalledTimes(1);

    // Foregrounding (hidden→visible) bumps visibleEpoch → tear the prior channel
    // down and re-subscribe + re-pull (reconciles stale friend rows).
    mock.selectSpy.mockClear();
    act(() => {
      mock.state.hidden = false;
      rerender(<EngineOnly />);
    });
    expect(mock.subscribeSpy).toHaveBeenCalledTimes(2); // re-subscribe
    expect(mock.channelSpy).toHaveBeenCalledTimes(2);
    expect(mock.removeChannelSpy).toHaveBeenCalledTimes(1); // prior channel torn down
    expect(mock.selectSpy).toHaveBeenCalled(); // re-pull fired again
  });

  it("(h) an in-app re-render with no visibility edge does NOT re-subscribe (no churn)", () => {
    const { rerender } = render(<EngineOnly />);
    expect(mock.subscribeSpy).toHaveBeenCalledTimes(1);
    expect(mock.channelSpy).toHaveBeenCalledTimes(1);
    act(() => {
      rerender(<EngineOnly />); // no visibility edge crossed (hidden stays false)
    });
    // Zero subscription churn — the lifecycle effect did not re-run.
    expect(mock.subscribeSpy).toHaveBeenCalledTimes(1);
    expect(mock.channelSpy).toHaveBeenCalledTimes(1);
  });

  it("(i) a foreground edge alone does NOT re-trigger the debounced own-row upsert", () => {
    const { rerender } = render(<EngineOnly />);
    // Let the initial debounce elapse so the first-sync upsert fires once.
    act(() => {
      vi.advanceTimersByTime(config.friends.DEBOUNCE_MS);
    });
    const upsertsAfterInitial = mock.upsertSpy.mock.calls.length;
    expect(upsertsAfterInitial).toBe(1);

    // A genuine hidden→visible edge (background then foreground rerenders).
    act(() => {
      mock.state.hidden = true;
      rerender(<EngineOnly />);
    });
    act(() => {
      mock.state.hidden = false;
      rerender(<EngineOnly />);
    });
    act(() => {
      vi.advanceTimersByTime(config.friends.DEBOUNCE_MS);
    });
    // The upsert effect deps exclude visibleEpoch (and the dex reference is
    // unchanged), so the foreground edge schedules NO new debounced write.
    expect(mock.upsertSpy.mock.calls.length).toBe(upsertsAfterInitial);
  });
});

import { renderHook } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import type { LatestSetlistRow } from "@guezzer/core";
import { config } from "../src/config.ts";

/**
 * useLatestPoll — the single, gated, tolerant `latest` poll loop (SYNC-01 /
 * SYNC-03 / D-06, plan 05-04 Task 1). Core `pollLatest` is mocked so these tests
 * exercise ONLY the app-owned lifecycle/timing: the ≤1/60s single-timer cadence,
 * the active-show gate, the online/visible gate, unmount cleanup, error
 * tolerance, and adaptive backoff. Fake timers drive the self-scheduling loop.
 */
vi.mock("@guezzer/core", () => ({
  pollLatest: vi.fn(),
}));

const { pollLatest } = (await import("@guezzer/core")) as unknown as {
  pollLatest: Mock;
};
const { useLatestPoll } = await import("../src/live/useLatestPoll.ts");

const INTERVAL = config.live.POLL_INTERVAL_MS;

/** A single fake latest row — enough for the diff/dedupe paths downstream. */
function row(songId: number): LatestSetlistRow {
  return { song_id: songId, position: songId } as unknown as LatestSetlistRow;
}

/** Force `navigator.onLine` for the duration of a test. */
function setOnline(online: boolean): void {
  Object.defineProperty(navigator, "onLine", {
    value: online,
    configurable: true,
  });
}

/** Force `document.visibilityState`. */
function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  });
}

/** Advance fake timers by `ms` and flush any awaited microtasks between ticks. */
async function advance(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

describe("useLatestPoll (SYNC-01 / SYNC-03 / D-06)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    pollLatest.mockReset();
    pollLatest.mockResolvedValue([]);
    setOnline(true);
    setVisibility("visible");
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    setOnline(true);
    setVisibility("visible");
  });

  it("schedules NO poll while there is no active show (SYNC-01)", async () => {
    const onRows = vi.fn();
    renderHook(() => useLatestPoll(undefined, onRows));

    await advance(INTERVAL * 5);

    expect(pollLatest).not.toHaveBeenCalled();
    expect(onRows).not.toHaveBeenCalled();
  });

  it("fires at most one poll per POLL_INTERVAL_MS across several intervals (≤1/60s)", async () => {
    const onRows = vi.fn();
    // Rows on every poll keep the cadence pinned at the floor (no backoff), so
    // this isolates the single-timer ≤1/60s guarantee from the backoff path.
    pollLatest.mockResolvedValue([row(101)]);
    renderHook(() => useLatestPoll({ sessionId: "s1" }, onRows));

    // No immediate burst on mount — the first tick is one interval out.
    expect(pollLatest).not.toHaveBeenCalled();

    await advance(INTERVAL); // tick 1
    await advance(INTERVAL); // tick 2
    await advance(INTERVAL); // tick 3

    // Exactly one poll per interval — never a burst (single-timer guarantee).
    expect(pollLatest).toHaveBeenCalledTimes(3);
    expect(onRows).toHaveBeenCalledTimes(3);
  });

  it("skips a tick while offline and resumes when back online (SYNC-03)", async () => {
    const onRows = vi.fn();
    setOnline(false);
    renderHook(() => useLatestPoll({ sessionId: "s1" }, onRows));

    await advance(INTERVAL); // ineligible → no fetch, reschedules at floor
    expect(pollLatest).not.toHaveBeenCalled();
    expect(onRows).not.toHaveBeenCalled();

    setOnline(true);
    await advance(INTERVAL); // now eligible → polls
    expect(pollLatest).toHaveBeenCalledTimes(1);
    expect(onRows).toHaveBeenCalledTimes(1);
  });

  it("skips a tick while the document is hidden (SYNC-03 / iOS background)", async () => {
    const onRows = vi.fn();
    setVisibility("hidden");
    renderHook(() => useLatestPoll({ sessionId: "s1" }, onRows));

    await advance(INTERVAL * 2);
    expect(pollLatest).not.toHaveBeenCalled();

    setVisibility("visible");
    await advance(INTERVAL);
    expect(pollLatest).toHaveBeenCalledTimes(1);
  });

  it("clears the pending timer on unmount — no post-unmount poll (Pitfall 3)", async () => {
    const onRows = vi.fn();
    const { unmount } = renderHook(() =>
      useLatestPoll({ sessionId: "s1" }, onRows),
    );

    await advance(INTERVAL); // one poll fires
    expect(pollLatest).toHaveBeenCalledTimes(1);

    unmount();
    await advance(INTERVAL * 5);

    // No further polls after cleanup.
    expect(pollLatest).toHaveBeenCalledTimes(1);
    expect(onRows).toHaveBeenCalledTimes(1);
  });

  it("swallows a thrown pollLatest and keeps scheduling (tolerant, D-06)", async () => {
    const onRows = vi.fn();
    pollLatest
      .mockRejectedValueOnce(new Error("network blew up"))
      .mockResolvedValue([row(101)]);
    renderHook(() => useLatestPoll({ sessionId: "s1" }, onRows));

    await advance(INTERVAL); // throws — swallowed
    expect(pollLatest).toHaveBeenCalledTimes(1);
    expect(onRows).not.toHaveBeenCalled();

    await advance(INTERVAL); // loop still alive → next tick succeeds
    expect(pollLatest).toHaveBeenCalledTimes(2);
    expect(onRows).toHaveBeenCalledTimes(1);
    expect(onRows).toHaveBeenLastCalledWith([row(101)]);
  });

  it("adaptive backoff grows the delay after empty polls but never below the floor (D-06)", async () => {
    const onRows = vi.fn();
    pollLatest.mockResolvedValue([]); // always empty → idle streak grows
    renderHook(() => useLatestPoll({ sessionId: "s1" }, onRows));

    // Tick 1 at the base floor.
    await advance(INTERVAL);
    expect(pollLatest).toHaveBeenCalledTimes(1);

    // After one empty poll the next delay is 2×floor: advancing only one floor
    // is NOT enough to fire the next tick.
    await advance(INTERVAL);
    expect(pollLatest).toHaveBeenCalledTimes(1); // still backing off

    await advance(INTERVAL); // now the 2×floor delay elapses
    expect(pollLatest).toHaveBeenCalledTimes(2);
  });

  it("backoff snaps back to the floor the moment rows arrive", async () => {
    const onRows = vi.fn();
    pollLatest.mockResolvedValueOnce([]); // tick 1 empty → streak = 1
    pollLatest.mockResolvedValue([row(101)]); // subsequent ticks have rows
    renderHook(() => useLatestPoll({ sessionId: "s1" }, onRows));

    await advance(INTERVAL); // tick 1 (empty)
    expect(pollLatest).toHaveBeenCalledTimes(1);

    await advance(INTERVAL * 2); // 2×floor delay → tick 2 (rows → streak reset)
    expect(pollLatest).toHaveBeenCalledTimes(2);

    await advance(INTERVAL); // back at the floor → tick 3
    expect(pollLatest).toHaveBeenCalledTimes(3);
  });
});

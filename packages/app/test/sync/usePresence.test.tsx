import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phase-20 plan 03, Task 2 — the singleton `usePresence()` ENGINE (the SOLE
 * `gizz-room` owner, PRES-01/02/03/04). Structural mirror of the
 * `useProgressSync` engine acceptance test: the supabase singleton, identity,
 * connectivity, the activity trio, the active-show liveQuery, and `showWaveToast`
 * are all mocked so no network / no Dexie runs. The single sync surface under
 * test is a component whose ONLY presence wiring is `usePresence()` — proving the
 * engine opens the channel, tracks activity, publishes the store, routes
 * validated waves, re-tracks on activity change WITHOUT re-opening, and tears
 * down cleanly on sign-out / offline.
 */

const mock = vi.hoisted(() => {
  const capture = {
    // The presence `sync` listener is a ZERO-arg wrapper that reads
    // `channel.presenceState()`; the broadcast `wave` listener destructures
    // `{ payload }`. We capture both exactly as `openPresenceChannel` wires them.
    onSync: null as null | (() => void),
    onWave: null as null | ((arg: { payload: unknown }) => void),
    presenceStateValue: {} as Record<string, ReadonlyArray<unknown>>,
  };
  const state = {
    identity: { userId: "me", displayName: "Me" } as
      | { userId: string; displayName: string }
      | null,
    online: true,
    route: "dex" as string,
    hidden: false,
    active: undefined as unknown,
  };
  const trackSpy = vi.fn((..._args: unknown[]) => Promise.resolve("ok"));
  const sendSpy = vi.fn((..._args: unknown[]) => Promise.resolve("ok"));
  const presenceStateSpy = vi.fn(() => capture.presenceStateValue);
  const channelObj = {
    track: trackSpy,
    send: sendSpy,
    presenceState: presenceStateSpy,
  };
  const subscribeSpy = vi.fn(() => channelObj);
  const builder: { on: unknown; subscribe: unknown } = {
    on: null,
    subscribe: subscribeSpy,
  };
  const onSpy = vi.fn((type: string, _filter: unknown, cb: (arg: never) => void) => {
    if (type === "presence") capture.onSync = cb as unknown as () => void;
    if (type === "broadcast")
      capture.onWave = cb as unknown as (arg: { payload: unknown }) => void;
    return builder;
  });
  builder.on = onSpy;
  const channelSpy = vi.fn((..._args: unknown[]) => builder);
  const removeChannelSpy = vi.fn(() => Promise.resolve());
  const showWaveToastSpy = vi.fn();
  return {
    capture,
    state,
    trackSpy,
    sendSpy,
    subscribeSpy,
    onSpy,
    channelSpy,
    removeChannelSpy,
    showWaveToastSpy,
  };
});

vi.mock("../../src/db/supabase.ts", () => ({
  supabase: {
    channel: mock.channelSpy,
    removeChannel: mock.removeChannelSpy,
    from: vi.fn(),
  },
}));
vi.mock("../../src/auth/useAuthIdentity.ts", () => ({
  useAuthIdentity: () => mock.state.identity,
}));
vi.mock("../../src/live/useOnlineStatus.ts", () => ({
  useOnlineStatus: () => mock.state.online,
}));
vi.mock("../../src/routing/useHashRoute.ts", () => ({
  useHashRoute: () => mock.state.route,
}));
vi.mock("../../src/sync/useVisibilityHidden.ts", () => ({
  useVisibilityHidden: () => mock.state.hidden,
}));
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: () => mock.state.active,
}));
vi.mock("../../src/components/WaveToast.tsx", () => ({
  showWaveToast: mock.showWaveToastSpy,
}));

const { usePresence } = await import("../../src/sync/usePresence.ts");
const { getPresenceState, resetPresenceState, sendWave } = await import(
  "../../src/sync/presenceSync.ts"
);

/** The single presence surface under test — NO Friends UI is rendered. */
function EngineOnly() {
  usePresence();
  return <div>presence-engine</div>;
}

beforeEach(() => {
  mock.trackSpy.mockClear();
  mock.sendSpy.mockClear();
  mock.subscribeSpy.mockClear();
  mock.onSpy.mockClear();
  mock.channelSpy.mockClear();
  mock.removeChannelSpy.mockClear();
  mock.showWaveToastSpy.mockClear();
  mock.capture.onSync = null;
  mock.capture.onWave = null;
  mock.capture.presenceStateValue = {};
  mock.state.identity = { userId: "me", displayName: "Me" };
  mock.state.online = true;
  mock.state.route = "dex";
  mock.state.hidden = false;
  mock.state.active = undefined;
  resetPresenceState();
});
afterEach(cleanup);

describe("usePresence — the singleton gizz-room engine (PRES-01/02/03/04)", () => {
  it("(a) opens gizz-room ONCE, tracks activity, registers a bound wave sender", () => {
    render(<EngineOnly />);
    expect(mock.channelSpy).toHaveBeenCalledTimes(1);
    expect(mock.channelSpy.mock.calls[0][0]).toBe("gizz-room");
    expect(mock.subscribeSpy).toHaveBeenCalledTimes(1);
    // Tracks the derived activity for the current route (dex → GizzDex).
    expect(mock.trackSpy).toHaveBeenCalledWith({ tab: "GizzDex" });
    // The bound sender stamps from:me on the live channel (broadcast wave).
    act(() => sendWave("🔥", null));
    expect(mock.sendSpy).toHaveBeenCalledTimes(1);
    expect(mock.sendSpy.mock.calls[0][0]).toEqual({
      type: "broadcast",
      event: "wave",
      payload: { from: "me", to: null, emoji: "🔥" },
    });
  });

  it("(b) signed out → NO channel, store stays pristine, sendWave is a no-op", () => {
    mock.state.identity = null;
    render(<EngineOnly />);
    expect(mock.channelSpy).not.toHaveBeenCalled();
    expect(getPresenceState().onlineIds.size).toBe(0);
    act(() => sendWave("🔥", null));
    expect(mock.sendSpy).not.toHaveBeenCalled();
  });

  it("(c) a presence:sync event publishes onlineIds + reduced activity to the store", () => {
    render(<EngineOnly />);
    act(() => {
      mock.capture.presenceStateValue = {
        "f-1": [{ tab: "LiveGizz", atShow: true }],
        "f-2": [{ tab: "GizzDex" }],
      };
      mock.capture.onSync?.();
    });
    const s = getPresenceState();
    expect([...s.onlineIds].sort()).toEqual(["f-1", "f-2"]);
    expect(s.activityByUser.get("f-1")).toEqual({ tab: "LiveGizz", atShow: true });
  });

  it("(d) a valid inbound wave routes to showWaveToast; self/other-targeted dropped", () => {
    render(<EngineOnly />);
    // Valid broadcast wave from a friend.
    act(() => mock.capture.onWave?.({ payload: { from: "f-1", to: null, emoji: "👋" } }));
    expect(mock.showWaveToastSpy).toHaveBeenCalledWith({
      from: "f-1",
      emoji: "👋",
      targeted: false,
    });
    // Targeted at me → targeted:true.
    mock.showWaveToastSpy.mockClear();
    act(() => mock.capture.onWave?.({ payload: { from: "f-1", to: "me", emoji: "🎯" } }));
    expect(mock.showWaveToastSpy).toHaveBeenCalledWith({
      from: "f-1",
      emoji: "🎯",
      targeted: true,
    });
    // Reflected self-wave + targeted-elsewhere + unknown emoji → all dropped.
    mock.showWaveToastSpy.mockClear();
    act(() => {
      mock.capture.onWave?.({ payload: { from: "me", to: null, emoji: "👋" } });
      mock.capture.onWave?.({ payload: { from: "f-1", to: "other", emoji: "👋" } });
      mock.capture.onWave?.({ payload: { from: "f-1", to: null, emoji: "💣" } });
      mock.capture.onWave?.({ payload: "not-an-object" });
    });
    expect(mock.showWaveToastSpy).not.toHaveBeenCalled();
  });

  it("(e) an activity change re-tracks WITHOUT re-opening the channel", () => {
    const { rerender } = render(<EngineOnly />);
    expect(mock.channelSpy).toHaveBeenCalledTimes(1);
    mock.trackSpy.mockClear();
    act(() => {
      mock.state.route = "show";
      mock.state.active = { sessionId: "s1", status: "active" };
      rerender(<EngineOnly />);
    });
    // Re-tracked the new activity, no second channel open.
    expect(mock.trackSpy).toHaveBeenCalledWith({ tab: "LiveGizz", atShow: true });
    expect(mock.channelSpy).toHaveBeenCalledTimes(1);
  });

  it("(f) offline → tears the channel down, clears the sender, resets the store", () => {
    const { rerender } = render(<EngineOnly />);
    // Seed some presence, then go offline (the real still-mounted transition).
    act(() => {
      mock.capture.presenceStateValue = { "f-1": [{ tab: "GizzDex" }] };
      mock.capture.onSync?.();
    });
    expect(getPresenceState().onlineIds.size).toBe(1);
    mock.sendSpy.mockClear();

    act(() => {
      mock.state.online = false;
      rerender(<EngineOnly />); // online flips → effect re-runs the teardown branch
    });
    expect(mock.removeChannelSpy).toHaveBeenCalledTimes(1);
    expect(getPresenceState().onlineIds.size).toBe(0); // pristine (D-16/17/20)
    act(() => sendWave("🔥", null)); // sender cleared → no-op
    expect(mock.sendSpy).not.toHaveBeenCalled();
  });
});

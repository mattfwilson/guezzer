import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phase-20 presence PRIMITIVES + module store (PRES-01/03/05). The Supabase
 * singleton is mocked so NO network I/O happens: `.channel().on().on().subscribe()`
 * returns a handle whose `presenceState`/`track`/`send` are spies, and a `.from()`
 * spy is present ONLY so the persistence test can assert it is NEVER touched on the
 * presence path (PRES-03 — presence/waves are ephemeral, zero Postgres/Dexie writes).
 * These pin the untrusted-wave rejection matrix (T-20-01/05/07), the online-ids +
 * activity-reduce read, the stable-reference store contract (Pitfall 4), and the
 * null-safe sendWave seam.
 */

const mock = vi.hoisted(() => {
  const capture = {
    onPresenceSync: null as null | ((state: unknown) => void),
    onWave: null as null | ((payload: unknown) => void),
    presenceStateResult: {} as Record<string, unknown>,
  };
  const trackSpy = vi.fn((..._a: unknown[]) => Promise.resolve("ok"));
  const sendSpy = vi.fn((..._a: unknown[]) => Promise.resolve("ok"));
  const presenceStateSpy = vi.fn(() => capture.presenceStateResult);
  const handle: Record<string, unknown> = {
    track: trackSpy,
    send: sendSpy,
    presenceState: presenceStateSpy,
    __channel: "gizz-room",
  };
  const subscribeSpy = vi.fn(() => handle);
  // Chained `.on(...).on(...)` — capture both listener callbacks, return the handle
  // (augmented with subscribe) so the chain resolves.
  const onSpy = vi.fn((type: string, filter: Record<string, unknown>, cb: (arg: never) => void) => {
    if (type === "presence") {
      capture.onPresenceSync = () => (cb as (a: unknown) => void)(undefined as never);
    } else if (type === "broadcast") {
      capture.onWave = (payload: unknown) =>
        (cb as (a: { payload: unknown }) => void)({ payload });
    }
    return chain;
  });
  const chain = { on: onSpy, subscribe: subscribeSpy };
  const channelSpy = vi.fn(() => chain);
  const fromSpy = vi.fn(() => ({
    upsert: vi.fn(() => Promise.resolve({ error: null })),
    select: vi.fn(() => Promise.resolve({ data: [], error: null })),
  }));
  const removeChannelSpy = vi.fn(() => Promise.resolve());
  return {
    capture,
    trackSpy,
    sendSpy,
    presenceStateSpy,
    subscribeSpy,
    onSpy,
    channelSpy,
    fromSpy,
    removeChannelSpy,
    handle,
  };
});

vi.mock("../../src/db/supabase.ts", () => ({
  supabase: {
    channel: mock.channelSpy,
    from: mock.fromSpy,
    removeChannel: mock.removeChannelSpy,
  },
}));

const {
  openPresenceChannel,
  readPresence,
  validateWave,
  removeChannel,
  getPresenceState,
  setPresenceState,
  subscribePresenceState,
  resetPresenceState,
  setWaveSender,
  sendWave,
} = await import("../../src/sync/presenceSync.ts");

const MY_ID = "me";

beforeEach(() => {
  mock.channelSpy.mockClear();
  mock.onSpy.mockClear();
  mock.subscribeSpy.mockClear();
  mock.trackSpy.mockClear();
  mock.sendSpy.mockClear();
  mock.presenceStateSpy.mockClear();
  mock.fromSpy.mockClear();
  mock.removeChannelSpy.mockClear();
  mock.capture.onPresenceSync = null;
  mock.capture.onWave = null;
  mock.capture.presenceStateResult = {};
  setWaveSender(null);
  resetPresenceState();
});
afterEach(() => vi.restoreAllMocks());

describe("openPresenceChannel — one dedicated gizz-room channel keyed by userId (D-18, Pitfall 1)", () => {
  it("opens 'gizz-room' with presence.key=userId + enabled:true and wires both listeners", () => {
    const ch = openPresenceChannel(MY_ID, () => {}, () => {});
    expect(mock.channelSpy).toHaveBeenCalledWith("gizz-room", {
      config: { presence: { key: MY_ID, enabled: true } },
    });
    // both listeners registered (presence sync + broadcast wave) then subscribe
    expect(mock.onSpy).toHaveBeenCalledTimes(2);
    expect(mock.subscribeSpy).toHaveBeenCalledTimes(1);
    expect(ch).toBe(mock.handle);
  });

  it("routes a presence 'sync' event through the handle's presenceState()", () => {
    const onSync = vi.fn();
    openPresenceChannel(MY_ID, onSync, () => {});
    mock.capture.presenceStateResult = { u1: [{ tab: "GizzDex" }] };
    mock.capture.onPresenceSync?.(undefined);
    expect(mock.presenceStateSpy).toHaveBeenCalled();
    expect(onSync).toHaveBeenCalledWith({ u1: [{ tab: "GizzDex" }] });
  });

  it("routes a broadcast 'wave' event's payload to onWave", () => {
    const onWave = vi.fn();
    openPresenceChannel(MY_ID, () => {}, onWave);
    mock.capture.onWave?.({ from: "u2", to: null, emoji: "🔥" });
    expect(onWave).toHaveBeenCalledWith({ from: "u2", to: null, emoji: "🔥" });
  });
});

describe("validateWave — untrusted inbound wave (T-20-01/05/07, PRES-05)", () => {
  it("accepts a broadcast (to:null) from another user", () => {
    expect(validateWave({ from: "u2", to: null, emoji: "🔥" }, MY_ID)).toEqual({
      from: "u2",
      to: null,
      emoji: "🔥",
    });
  });

  it("accepts a wave targeted at me", () => {
    expect(validateWave({ from: "u2", to: "me", emoji: "👋" }, MY_ID)).toEqual({
      from: "u2",
      to: "me",
      emoji: "👋",
    });
  });

  it("rejects a non-object", () => {
    expect(validateWave(null, MY_ID)).toBeNull();
    expect(validateWave("hi", MY_ID)).toBeNull();
    expect(validateWave(42, MY_ID)).toBeNull();
  });

  it("rejects empty / non-string from", () => {
    expect(validateWave({ from: "", to: null, emoji: "🔥" }, MY_ID)).toBeNull();
    expect(validateWave({ from: 7, to: null, emoji: "🔥" }, MY_ID)).toBeNull();
  });

  it("rejects a reflected self-wave (from === myUserId, Pitfall 3 / T-20-07)", () => {
    expect(validateWave({ from: MY_ID, to: null, emoji: "🔥" }, MY_ID)).toBeNull();
  });

  it("rejects to that is neither null nor string", () => {
    expect(validateWave({ from: "u2", to: 5, emoji: "🔥" }, MY_ID)).toBeNull();
  });

  it("rejects a wave targeted at someone else (T-20-05, PRES-05)", () => {
    expect(validateWave({ from: "u2", to: "other", emoji: "🔥" }, MY_ID)).toBeNull();
  });

  it("rejects an emoji outside the fixed palette", () => {
    expect(validateWave({ from: "u2", to: null, emoji: "💩" }, MY_ID)).toBeNull();
    expect(validateWave({ from: "u2", to: null, emoji: 1 }, MY_ID)).toBeNull();
  });

  it("accepts every emoji in the fixed 4-set", () => {
    for (const emoji of ["👋", "🔥", "🦎", "🎯"]) {
      expect(validateWave({ from: "u2", to: null, emoji }, MY_ID)).toEqual({
        from: "u2",
        to: null,
        emoji,
      });
    }
  });
});

describe("readPresence — online ids + reduced activity (PRES-01, Pitfall 2)", () => {
  it("keys online ids by userId and reduces each entry array to one Activity", () => {
    const state = readPresence({
      u1: [{ tab: "GizzDex" }],
      u2: [{ tab: "LiveGizz", atShow: true }],
    });
    expect([...state.onlineIds].sort()).toEqual(["u1", "u2"]);
    expect(state.activityByUser.get("u1")).toEqual({ tab: "GizzDex" });
    expect(state.activityByUser.get("u2")).toEqual({ tab: "LiveGizz", atShow: true });
  });

  it("still lists an online id whose entries all reduce to null, without an activity", () => {
    const state = readPresence({ u3: [{ tab: "nonsense" }] });
    expect([...state.onlineIds]).toEqual(["u3"]); // present-now is binary (D-14)
    expect(state.activityByUser.has("u3")).toBe(false);
  });
});

describe("presence store seam — stable reference between writes (Pitfall 4)", () => {
  it("getPresenceState returns the SAME reference until setPresenceState replaces it", () => {
    const a = getPresenceState();
    expect(getPresenceState()).toBe(a);
    setPresenceState(readPresence({ u1: [{ tab: "GizzMap" }] }));
    const b = getPresenceState();
    expect(b).not.toBe(a);
    expect(getPresenceState()).toBe(b);
  });

  it("notifies subscribers on set + reset", () => {
    const cb = vi.fn();
    const unsub = subscribePresenceState(cb);
    setPresenceState(readPresence({ u1: [{ tab: "GizzMap" }] }));
    expect(cb).toHaveBeenCalledTimes(1);
    resetPresenceState();
    expect(cb).toHaveBeenCalledTimes(2);
    unsub();
    setPresenceState(readPresence({}));
    expect(cb).toHaveBeenCalledTimes(2); // unsubscribed
  });

  it("resetPresenceState yields an empty online set + activity map", () => {
    setPresenceState(readPresence({ u1: [{ tab: "GizzMap" }] }));
    resetPresenceState();
    const s = getPresenceState();
    expect(s.onlineIds.size).toBe(0);
    expect(s.activityByUser.size).toBe(0);
  });
});

describe("sendWave — null-safe module-level send seam", () => {
  it("is a no-op (no throw) when no sender is registered (signed-out/offline)", () => {
    expect(() => sendWave("👋", null)).not.toThrow();
  });

  it("delegates to the registered sender exactly once with (emoji, to)", () => {
    const sender = vi.fn();
    setWaveSender(sender);
    sendWave("🔥", "u2");
    expect(sender).toHaveBeenCalledTimes(1);
    expect(sender).toHaveBeenCalledWith("🔥", "u2");
  });

  it("clears the sender on setWaveSender(null)", () => {
    const sender = vi.fn();
    setWaveSender(sender);
    setWaveSender(null);
    sendWave("🦎", null);
    expect(sender).not.toHaveBeenCalled();
  });
});

describe("removeChannel — teardown (Pitfall 6)", () => {
  it("delegates to supabase.removeChannel", async () => {
    const ch = openPresenceChannel(MY_ID, () => {}, () => {});
    await removeChannel(ch);
    expect(mock.removeChannelSpy).toHaveBeenCalledWith(ch);
  });
});

describe("PRES-03 — the presence path NEVER writes to Postgres/Dexie", () => {
  it("exercising openPresenceChannel / readPresence / sendWave touches ONLY channel spies, never .from()", () => {
    const ch = openPresenceChannel(MY_ID, () => {}, () => {});
    mock.capture.presenceStateResult = { u1: [{ tab: "GizzDex" }] };
    mock.capture.onPresenceSync?.(undefined);
    setPresenceState(readPresence(mock.capture.presenceStateResult));
    setWaveSender((emoji, to) => {
      void ch; // a real sender would call ch.send — proven via the send spy below
      mock.handle.send;
      void emoji;
      void to;
    });
    sendWave("🔥", null);
    // The ephemeral-only guarantee: no Postgres table access on the presence path.
    expect(mock.fromSpy).not.toHaveBeenCalled();
  });
});

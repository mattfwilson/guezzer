import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phase-20 plan 03, Task 1 — the PURE presence readers `usePresenceFor` and
 * `useSelfPresence` (PRES-01/02, D-16/D-17, Open Q3). Mirrors the
 * `useFriendsProgress` reader test: the store is written directly (the engine's
 * job) and the hook is asserted to re-render to that state WITHOUT opening any
 * channel. The offline gate (D-16/D-17) is proven by flipping the mocked
 * `useOnlineStatus`. `useSelfPresence` is proven to derive from LOCAL sources
 * (route/visibility/active-show) via `deriveActivity` — never a round-trip
 * through the presence store (Open Q3).
 *
 * The supabase singleton is mocked so importing `presenceSync.ts` constructs no
 * real client; the local signal hooks + dexie liveQuery are mocked so the
 * readers are exercised deterministically with zero network / Dexie.
 */

const mock = vi.hoisted(() => ({
  online: true,
  route: "dex" as string,
  hidden: false,
  active: undefined as unknown,
}));

vi.mock("../../src/db/supabase.ts", () => ({
  supabase: { from: vi.fn(), channel: vi.fn(), removeChannel: vi.fn() },
}));
vi.mock("../../src/live/useOnlineStatus.ts", () => ({
  useOnlineStatus: () => mock.online,
}));
vi.mock("../../src/routing/useHashRoute.ts", () => ({
  useHashRoute: () => mock.route,
}));
vi.mock("../../src/sync/useVisibilityHidden.ts", () => ({
  useVisibilityHidden: () => mock.hidden,
}));
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: () => mock.active,
}));

const { usePresenceFor, useSelfPresence } = await import(
  "../../src/sync/usePresenceReaders.ts"
);
const { setPresenceState, resetPresenceState } = await import(
  "../../src/sync/presenceSync.ts"
);

beforeEach(() => {
  mock.online = true;
  mock.route = "dex";
  mock.hidden = false;
  mock.active = undefined;
  resetPresenceState();
});
afterEach(cleanup);

describe("usePresenceFor — pure store reader gated on online (D-16)", () => {
  it("reads online + activity for a userId from the store the engine publishes", () => {
    const { result } = renderHook(() => usePresenceFor("f-1"));
    expect(result.current).toEqual({ online: false, activity: null });

    act(() => {
      setPresenceState({
        onlineIds: new Set(["f-1"]),
        activityByUser: new Map([["f-1", { tab: "LiveGizz", atShow: true }]]),
      });
    });
    expect(result.current).toEqual({
      online: true,
      activity: { tab: "LiveGizz", atShow: true },
    });
  });

  it("an online user with no reduced activity reads online:true, activity:null", () => {
    const { result } = renderHook(() => usePresenceFor("f-2"));
    act(() => {
      setPresenceState({
        onlineIds: new Set(["f-2"]),
        activityByUser: new Map(),
      });
    });
    expect(result.current).toEqual({ online: true, activity: null });
  });

  it("viewer offline hides EVERY dot regardless of store contents (D-16)", () => {
    mock.online = false;
    const { result } = renderHook(() => usePresenceFor("f-1"));
    act(() => {
      setPresenceState({
        onlineIds: new Set(["f-1"]),
        activityByUser: new Map([["f-1", { tab: "GizzDex" }]]),
      });
    });
    expect(result.current).toEqual({ online: false, activity: null });
  });
});

describe("useSelfPresence — LOCAL-derived, gated on online (D-17, Open Q3)", () => {
  it("derives {online:true, activity} from route/visibility/active-show, not the store", () => {
    // Store says self is offline/idle — the self reader must IGNORE it (Open Q3).
    resetPresenceState();
    mock.route = "dex";
    const { result } = renderHook(() => useSelfPresence());
    expect(result.current).toEqual({ online: true, activity: { tab: "GizzDex" } });
  });

  it("stamps atShow only on the show route with an active tracked show", () => {
    mock.route = "show";
    mock.active = { sessionId: "s1", status: "active" };
    const { result } = renderHook(() => useSelfPresence());
    expect(result.current).toEqual({
      online: true,
      activity: { tab: "LiveGizz", atShow: true },
    });
  });

  it("a backgrounded tab reads idle (hidden wins, D-02)", () => {
    mock.route = "show";
    mock.active = { sessionId: "s1", status: "active" };
    mock.hidden = true;
    const { result } = renderHook(() => useSelfPresence());
    expect(result.current).toEqual({ online: true, activity: { tab: "idle" } });
  });

  it("viewer offline → {online:false, activity:null} (D-17)", () => {
    mock.online = false;
    const { result } = renderHook(() => useSelfPresence());
    expect(result.current).toEqual({ online: false, activity: null });
  });
});

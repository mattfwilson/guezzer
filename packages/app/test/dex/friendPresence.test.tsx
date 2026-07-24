import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RarityTier, SharedProgress } from "@guezzer/core";

/**
 * Phase-20 plan 04, Task 1 — the PRES-07 slot-fill fusion (D-13/D-15/D-16/D-17).
 * Proves the already-reserved `FriendRow`/`SelfRow` presence slots fill from the
 * pure presence readers: an 8px `#22C55E` online dot + the coarse activity label
 * (with the residency-defining `At a show 🎸` emphasis), the self row's own
 * dot/activity vs. `offline`, and — the hard constraint — that when the VIEWER is
 * offline EVERY friend dot + activity label is hidden while the dimmed cached PROG
 * rows still render (D-16). No online-only placeholder rows are ever added (D-13).
 *
 * The low-level local signals (`useOnlineStatus`/route/visibility/active-show) and
 * the shared stores are mocked so the readers are exercised deterministically with
 * zero network / Dexie; `usePresenceFor`/`useSelfPresence` themselves stay REAL so
 * the offline gate is proven end-to-end through the row markup.
 */

const mock = vi.hoisted(() => ({
  online: true,
  route: "dex" as string,
  hidden: false,
  active: undefined as unknown,
  identity: { userId: "me", displayName: "Me" } as { userId: string; displayName: string } | null,
  friendsState: {
    friends: [] as unknown[],
    offline: false,
    asOf: null as number | null,
    error: null as string | null,
  },
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
vi.mock("../../src/auth/useAuthIdentity.ts", () => ({
  useAuthIdentity: () => mock.identity,
}));
vi.mock("../../src/dex/useDexStats.ts", () => ({
  useDexStats: () => ({
    ready: true,
    error: null,
    dex: {
      completion: { caught: 12, total: 100, pct: 12 },
      rarestCatch: { songId: 1, tier: "rare" as RarityTier },
    },
  }),
}));
vi.mock("../../src/sync/useFriendsProgress.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/sync/useFriendsProgress.ts")>();
  return { ...actual, useFriendsProgress: () => mock.friendsState };
});

const { FriendRow } = await import("../../src/dex/FriendRow.tsx");
const { SelfRow } = await import("../../src/dex/SelfRow.tsx");
const { FriendsList } = await import("../../src/dex/FriendsList.tsx");
const { setPresenceState, resetPresenceState } = await import(
  "../../src/sync/presenceSync.ts"
);
const { config } = await import("../../src/config.ts");

const presence = config.copy.presence;

/** The rendered online dot lives as the child of the reserved presence-online slot. */
function onlineDot(root: HTMLElement): HTMLElement | null {
  const slot = root.querySelector('[data-slot="presence-online"]');
  return (slot?.firstElementChild as HTMLElement | null) ?? null;
}

function makeFriend(userId: string, displayName: string, caught: number): {
  userId: string;
  displayName: string;
  summary: SharedProgress;
  updatedAt: string | null;
} {
  return {
    userId,
    displayName,
    summary: {
      v: 1,
      completion: { caught, total: 100, pct: caught },
      showCount: 1,
      rarest: caught > 0 ? { songId: 1, tier: "rare" } : null,
      tierCounts: { common: caught, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
      perAlbum: [],
      caughtSongIds: [],
    } as SharedProgress,
    updatedAt: null,
  };
}

beforeEach(() => {
  mock.online = true;
  mock.route = "dex";
  mock.hidden = false;
  mock.active = undefined;
  mock.identity = { userId: "me", displayName: "Me" };
  mock.friendsState = { friends: [], offline: false, asOf: null, error: null };
  resetPresenceState();
});
afterEach(cleanup);

describe("FriendRow — online dot fills the reserved presence-online slot (PRES-07)", () => {
  it("renders an 8px #22C55E dot when online, nothing when offline", () => {
    const { container, rerender } = render(
      <FriendRow userId="f1" displayName="Ada" pct={10} caught={10} rarest={null} online activity={null} onClick={() => {}} />,
    );
    const dot = onlineDot(container);
    expect(dot).not.toBeNull();
    expect(dot!.style.backgroundColor).toBe("rgb(34, 197, 94)"); // #22C55E

    rerender(
      <FriendRow userId="f1" displayName="Ada" pct={10} caught={10} rarest={null} online={false} activity={null} onClick={() => {}} />,
    );
    expect(onlineDot(container)).toBeNull();
  });
});

describe("FriendRow — activity label fills the reserved presence-activity slot", () => {
  it("renders the tab brand token (muted) for a plain activity", () => {
    render(
      <FriendRow userId="f1" displayName="Ada" pct={10} caught={10} rarest={null} online activity={{ tab: "GizzVerse" }} onClick={() => {}} />,
    );
    expect(screen.getByText("GizzVerse")).toBeInTheDocument();
  });

  it("renders `At a show 🎸` with text-primary emphasis for an atShow activity", () => {
    render(
      <FriendRow userId="f1" displayName="Ada" pct={10} caught={10} rarest={null} online activity={{ tab: "LiveGizz", atShow: true }} onClick={() => {}} />,
    );
    const label = screen.getByText(presence.atShow);
    expect(label).toBeInTheDocument();
    expect(label.className).toContain("text-text-primary");
  });

  it("renders no activity label when activity is null", () => {
    render(
      <FriendRow userId="f1" displayName="Ada" pct={10} caught={10} rarest={null} online activity={null} onClick={() => {}} />,
    );
    expect(screen.queryByText("GizzVerse")).not.toBeInTheDocument();
    expect(screen.queryByText(presence.atShow)).not.toBeInTheDocument();
  });

  it("a present friend row shows BOTH the dot and the text label (WCAG 1.4.1)", () => {
    const { container } = render(
      <FriendRow userId="f1" displayName="Ada" pct={10} caught={10} rarest={null} online activity={{ tab: "GizzDex" }} onClick={() => {}} />,
    );
    expect(onlineDot(container)).not.toBeNull();
    expect(screen.getByText("GizzDex")).toBeInTheDocument();
  });
});

describe("SelfRow — own live dot + activity, offline hides the dot (D-15/D-17)", () => {
  it("shows the own dot + local activity label when online", () => {
    mock.route = "dex";
    const { container } = render(<SelfRow onClick={() => {}} />);
    const dot = onlineDot(container);
    expect(dot).not.toBeNull();
    expect(dot!.style.backgroundColor).toBe("rgb(34, 197, 94)");
    expect(screen.getByText("GizzDex")).toBeInTheDocument();
  });

  it("stamps `At a show 🎸` on the show route with an active tracked show", () => {
    mock.route = "show";
    mock.active = { sessionId: "s1", status: "active" };
    render(<SelfRow onClick={() => {}} />);
    expect(screen.getByText(presence.atShow)).toBeInTheDocument();
  });

  it("hides the dot and reads `offline` when the viewer is offline (D-17)", () => {
    mock.online = false;
    const { container } = render(<SelfRow onClick={() => {}} />);
    expect(onlineDot(container)).toBeNull();
    expect(screen.getByText(presence.offline)).toBeInTheDocument();
  });
});

describe("FriendsList — per-row presence, offline hides all dots but keeps dimmed rows (D-13/D-16)", () => {
  it("fills each friend row's dot + activity from the store while online", () => {
    mock.friendsState = {
      friends: [makeFriend("f1", "Ada", 40), makeFriend("f2", "Bo", 20)],
      offline: false,
      asOf: null,
      error: null,
    };
    setPresenceState({
      onlineIds: new Set(["f1"]),
      activityByUser: new Map([["f1", { tab: "LiveGizz", atShow: true }]]),
    });

    render(<FriendsList onOpenFriend={() => {}} onOpenSelf={() => {}} />);

    const adaRow = screen.getByText("Ada").closest('[data-testid="friend-row"]') as HTMLElement;
    expect(onlineDot(adaRow)).not.toBeNull();
    expect(within(adaRow).getByText(presence.atShow)).toBeInTheDocument();

    // f2 is not in onlineIds → no dot, no activity label.
    const boRow = screen.getByText("Bo").closest('[data-testid="friend-row"]') as HTMLElement;
    expect(onlineDot(boRow)).toBeNull();
  });

  it("viewer offline hides EVERY friend dot + label while dimmed cached rows persist (D-16)", () => {
    mock.online = false;
    mock.friendsState = {
      friends: [makeFriend("f1", "Ada", 40), makeFriend("f2", "Bo", 20)],
      offline: true,
      asOf: Date.now(),
      error: null,
    };
    // Store still holds last-known online friends — the offline gate must ignore it.
    setPresenceState({
      onlineIds: new Set(["f1", "f2"]),
      activityByUser: new Map([["f1", { tab: "LiveGizz", atShow: true }]]),
    });

    render(<FriendsList onOpenFriend={() => {}} onOpenSelf={() => {}} />);

    // Dimmed cached rows still render (never blank).
    const adaRow = screen.getByText("Ada").closest('[data-testid="friend-row"]') as HTMLElement;
    const boRow = screen.getByText("Bo").closest('[data-testid="friend-row"]') as HTMLElement;
    expect(adaRow.className).toContain("opacity-50");
    expect(boRow.className).toContain("opacity-50");

    // No green dot anywhere; no activity label.
    expect(onlineDot(adaRow)).toBeNull();
    expect(onlineDot(boRow)).toBeNull();
    expect(screen.queryByText(presence.atShow)).not.toBeInTheDocument();
  });

  it("adds NO online-only placeholder rows — membership stays PROG-owned (D-13)", () => {
    mock.friendsState = {
      friends: [makeFriend("f1", "Ada", 40)],
      offline: false,
      asOf: null,
      error: null,
    };
    // The store lists an online user with NO PROG row — it must NOT appear as a row.
    setPresenceState({
      onlineIds: new Set(["ghost", "f1"]),
      activityByUser: new Map(),
    });

    render(<FriendsList onOpenFriend={() => {}} onOpenSelf={() => {}} />);

    expect(screen.getAllByTestId("friend-row")).toHaveLength(1);
    expect(screen.getByText("Ada")).toBeInTheDocument();
  });
});

import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The dex data-foundation + shelf contract test (plan 06-05, extended in 06-06).
 * Guarantees pinned here:
 *
 *  1. `useDexStats` is a LIVE derivation — Dexie is the single source of truth
 *     (no stored counts). Writing an `attendedShows` row recomputes the derived
 *     `showCount`/completion with no manual refresh (DEX-03, `useLiveQuery` +
 *     `useMemo(deriveDex)`).
 *  2. The bundled-artifact loaders GUARD `schemaVersion` and return a handled
 *     `{ ok: false }` sentinel on drift — never a throw that bricks the dex
 *     (T-06-12).
 *  3. `DexView` renders the collection's face (06-06): completion headline from
 *     derived data, the album shelf sorted alphabetically with Miscellaneous +
 *     Covers pinned last, the green completion check, §B4 zero-catch dimming,
 *     the Albums|Shows segment toggle, and the empty-dex state.
 *
 * The 141 KB real artifacts are replaced with tiny `vi.mock` fixtures so the
 * tests stay fast and shape-focused.
 */
const { stubArchive, stubAlbums } = vi.hoisted(() => ({
  stubArchive: {
    schemaVersion: 1,
    latestShowDate: "2025-01-01",
    songs: {
      "101": "Rattlesnake",
      "102": "Robot Stop",
      "201": "Apple Song A",
      "202": "Apple Song B",
      "203": "Zebra Song A",
      "204": "Zebra Song B",
    },
    shows: [
      {
        id: 1000000001,
        date: "2025-01-01",
        venue: "Test Venue",
        city: "Test City",
        state: null,
        country: "US",
        sets: [{ n: "1", songs: [101, 102] }],
      },
    ],
  },
  stubAlbums: {
    schemaVersion: 1,
    albums: [
      // Deliberately NOT in alphabetical order — DexView must sort them.
      {
        albumUrl: "/albums/zzz",
        title: "Zebra",
        releaseDate: "2021-01-01",
        tracks: [
          { songId: 203, slug: "z-a", title: "Zebra Song A", position: 1, inMatrix: true },
          { songId: 204, slug: "z-b", title: "Zebra Song B", position: 2, inMatrix: true },
        ],
      },
      {
        albumUrl: "/albums/aaa",
        title: "Apple",
        releaseDate: "2020-01-01",
        tracks: [
          { songId: 201, slug: "a-a", title: "Apple Song A", position: 1, inMatrix: true },
          { songId: 202, slug: "a-b", title: "Apple Song B", position: 2, inMatrix: true },
        ],
      },
      {
        albumUrl: "/albums/test",
        title: "Test Album",
        releaseDate: "2019-01-01",
        tracks: [
          { songId: 101, slug: "rattlesnake", title: "Rattlesnake", position: 1, inMatrix: true },
          { songId: 102, slug: "robot-stop", title: "Robot Stop", position: 2, inMatrix: true },
        ],
      },
    ],
    buckets: { covers: [], miscellaneous: [] },
  },
}));

vi.mock("@archive", () => ({ default: stubArchive }));
vi.mock("@dexAlbums", () => ({ default: stubAlbums }));

const { config } = await import("../src/config.ts");
const { db } = await import("../src/db/db.ts");
const { useDexStats } = await import("../src/dex/useDexStats.ts");
const { DexView } = await import("../src/dex/DexView.tsx");
const { AlbumGrid } = await import("../src/dex/AlbumGrid.tsx");

const copy = config.copy.dex;

async function clearTables() {
  await db.attendedShows.clear();
  await db.trackedShows.clear();
  await db.trackedEntries.clear();
}

describe("useDexStats: live dex derivation (DEX-03, no stored counts)", () => {
  beforeEach(clearTables);

  it("recomputes showCount + completion when an attendedShows row is written", async () => {
    const { result } = renderHook(() => useDexStats());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.dex?.showCount).toBe(0);
    expect(result.current.dex?.completion.caught).toBe(0);

    // A single retro-mark of a fixture archive show — no refresh call.
    await act(async () => {
      await db.attendedShows.put({ show_id: 1000000001, showDate: "2025-01-01" });
    });

    await waitFor(() => expect(result.current.dex?.showCount).toBe(1));
    // The archive setlist (101, 102) is now caught — completion is derived, live.
    expect(result.current.dex?.completion.caught).toBe(2);
    expect(result.current.dex?.perAlbum.get("/albums/test")).toEqual({
      caught: 2,
      total: 2,
    });
  });
});

describe("DexView: the album shelf (06-06, D-01/D-02/D-07)", () => {
  beforeEach(clearTables);
  afterEach(cleanup);

  async function markTestShow() {
    await db.attendedShows.put({ show_id: 1000000001, showDate: "2025-01-01" });
  }

  it("renders the completion headline from derived data + 'caught' caption", async () => {
    await markTestShow();
    render(<DexView />);

    // caught=2 (101,102 marked), total=6 (catalog), pct=33.
    await screen.findByText(/2\/6/);
    expect(screen.getByText(copy.caughtCaption)).toBeInTheDocument();
  });

  it("sorts album cards alphabetically with Miscellaneous + Covers pinned last", async () => {
    await markTestShow();
    render(<DexView />);

    await waitFor(() =>
      expect(screen.getAllByTestId("album-card").length).toBe(5),
    );
    const cards = screen.getAllByTestId("album-card");
    const titles = cards.map((c) => c.getAttribute("data-album-title"));
    expect(titles).toEqual([
      "Apple",
      "Test Album",
      "Zebra",
      copy.bucketMiscellaneous,
      copy.bucketCovers,
    ]);
  });

  it("shows the green completion check on a fully-caught album", async () => {
    await markTestShow();
    render(<DexView />);

    await waitFor(() => expect(screen.getAllByTestId("album-card").length).toBe(5));
    const cards = screen.getAllByTestId("album-card");
    const testCard = cards.find((c) => c.getAttribute("data-album-title") === "Test Album")!;
    const appleCard = cards.find((c) => c.getAttribute("data-album-title") === "Apple")!;

    // Test Album: 2/2 caught → complete. Apple: 0/2 → not complete.
    expect(testCard).toHaveAttribute("data-complete", "true");
    expect(appleCard).toHaveAttribute("data-complete", "false");
  });

  it("dims the cover of a zero-catch album (§B4)", async () => {
    await markTestShow();
    render(<DexView />);

    await waitFor(() => expect(screen.getAllByTestId("album-card").length).toBe(5));
    const appleCard = screen
      .getAllByTestId("album-card")
      .find((c) => c.getAttribute("data-album-title") === "Apple")!;
    const cover = within(appleCard).getByTestId("album-cover");
    expect(cover.className).toContain("opacity-40");
    expect(cover.className).toContain("grayscale");
  });

  it("toggles between Albums and Shows segments (component state, no route change)", async () => {
    await markTestShow();
    render(<DexView />);

    await waitFor(() => expect(screen.getAllByTestId("album-card").length).toBe(5));

    // Switching to Shows now lists the marked show (06-09) instead of the empty
    // state — the album cards leave the DOM (component-state toggle, no route).
    fireEvent.click(screen.getByRole("button", { name: copy.segmentShows }));
    await screen.findByTestId("show-row");
    expect(screen.queryAllByTestId("album-card").length).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: copy.segmentAlbums }));
    await waitFor(() => expect(screen.getAllByTestId("album-card").length).toBe(5));
  });

  it("renders the 'No catches yet' empty state when nothing is caught", async () => {
    render(<DexView />);
    await screen.findByText(copy.emptyHeading);
  });
});

describe("AlbumGrid: cover img → initials fallback (06-12 gap 1, UAT test 2)", () => {
  afterEach(cleanup);

  // A REAL committed cover slug (nonagon-infinity.webp exists on disk) so
  // coverUrlFor resolves a bundled URL and the <img> branch renders.
  const coveredAlbums = {
    schemaVersion: 1,
    albums: [
      {
        albumUrl: "/albums/nonagon-infinity",
        title: "Nonagon Infinity",
        releaseDate: "2016-04-29",
        tracks: [],
      },
    ],
    buckets: { covers: [], miscellaneous: [] },
  } as unknown as Parameters<typeof AlbumGrid>[0]["albums"];

  // Empty perAlbum → tally defaults to { caught: 0 } → zero-catch → §B4 dimmed.
  const emptyDex = {
    perAlbum: new Map(),
  } as unknown as Parameters<typeof AlbumGrid>[0]["dex"];

  function renderCoveredCard() {
    render(<AlbumGrid dex={emptyDex} albums={coveredAlbums} onOpen={() => {}} />);
    return screen
      .getAllByTestId("album-card")
      .find((c) => c.getAttribute("data-album-title") === "Nonagon Infinity")!;
  }

  it("degrades a broken cover img to the initials placeholder under the SAME testid", () => {
    const card = renderCoveredCard();

    // With a committed cover, the img branch renders first.
    const cover = within(card).getByTestId("album-cover");
    expect(cover.tagName).toBe("IMG");

    // Simulate the offline/404 load failure (UAT test 2's broken-image "?").
    fireEvent.error(cover);

    // Same testid re-renders as the initials placeholder — no broken img remains.
    const fallback = within(card).getByTestId("album-cover");
    expect(fallback.tagName).not.toBe("IMG");
    expect(fallback.textContent).toBe("NI");
    expect(card.querySelector("img")).toBeNull();
  });

  it("keeps §B4 dim classes on the error-fallback placeholder of a zero-catch album", () => {
    const card = renderCoveredCard();

    fireEvent.error(within(card).getByTestId("album-cover"));

    const fallback = within(card).getByTestId("album-cover");
    // Must be the PLACEHOLDER carrying the dim classes — not a lingering img.
    expect(fallback.tagName).not.toBe("IMG");
    expect(fallback.className).toContain("opacity-40");
    expect(fallback.className).toContain("grayscale");
  });
});

describe("artifact loaders guard schemaVersion (T-06-12, never throw)", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@archive");
    vi.doUnmock("@dexAlbums");
  });

  it("loadArchive returns { ok: false } on a schemaVersion-2 stub", async () => {
    vi.resetModules();
    vi.doMock("@archive", () => ({ default: { ...stubArchive, schemaVersion: 2 } }));
    const { loadArchive } = await import("../src/dex/archive-loader.ts");

    const res = loadArchive();

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("schemaVersion");
  });

  it("loadDexAlbums returns { ok: false } on a schemaVersion-2 stub", async () => {
    vi.resetModules();
    vi.doMock("@dexAlbums", () => ({ default: { ...stubAlbums, schemaVersion: 2 } }));
    const { loadDexAlbums } = await import("../src/dex/dex-albums-loader.ts");

    const res = loadDexAlbums();

    expect(res.ok).toBe(false);
  });
});

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The dex data-foundation contract test (plan 06-05, extended in 06-06). Two
 * guarantees are pinned here:
 *
 *  1. `useDexStats` is a LIVE derivation — Dexie is the single source of truth
 *     (no stored counts). Writing an `attendedShows` row recomputes the derived
 *     `showCount`/completion with no manual refresh (DEX-03, `useLiveQuery` +
 *     `useMemo(deriveDex)`).
 *  2. The bundled-artifact loaders GUARD `schemaVersion` and return a handled
 *     `{ ok: false }` sentinel on drift — never a throw that bricks the dex
 *     (T-06-12). The 141 KB real artifacts are replaced with tiny `vi.mock`
 *     fixtures so the test stays fast and shape-focused.
 */
const { stubArchive, stubAlbums } = vi.hoisted(() => ({
  stubArchive: {
    schemaVersion: 1,
    latestShowDate: "2025-01-01",
    songs: { "101": "Rattlesnake", "102": "Robot Stop" },
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
      {
        albumUrl: "/albums/test",
        title: "Test Album",
        releaseDate: "2020-01-01",
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

const { db } = await import("../src/db/db.ts");
const { useDexStats } = await import("../src/dex/useDexStats.ts");

describe("useDexStats: live dex derivation (DEX-03, no stored counts)", () => {
  beforeEach(async () => {
    await db.attendedShows.clear();
    await db.trackedShows.clear();
    await db.trackedEntries.clear();
  });

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

/**
 * Regression tests for the fetch-covers release-group selection (06-12 gap 2,
 * UAT test 5). Root cause of the Phantom Island wrong-art bug: MusicBrainz
 * returned the 2024 Single and the 2025 Album both at score 100, Single first,
 * and `findReleaseGroupMbid` took `groups[0].id` unfiltered.
 *
 * Contract pinned here:
 *  1. An Album-typed release group is preferred over an earlier-listed Single.
 *  2. With NO Album-typed group (EPs etc. — several committed covers are
 *     intentionally non-Album release groups), the top-scored `groups[0].id`
 *     fallback is load-bearing and preserved.
 *  3. An empty result still returns null (the placeholder contract).
 *
 * No real network: `fetch` is stubbed with canned MbSearchResponse JSON.
 * Importing the module is safe — the `isMain` guard prevents script execution
 * and top-level code only computes paths (no sharp invocation).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { findReleaseGroupMbid } from "../scripts/fetch-covers.ts";

/** Stub global fetch to answer with a canned MB search body. */
function stubMbSearch(releaseGroups: Array<Record<string, unknown>>): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ "release-groups": releaseGroups }),
    })),
  );
}

describe("findReleaseGroupMbid: primary-type Album preference (06-12 gap 2)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the Album's id when a Single is listed first (both score 100)", async () => {
    stubMbSearch([
      { id: "single-mbid", score: 100, "primary-type": "Single" },
      { id: "album-mbid", score: 100, "primary-type": "Album" },
    ]);

    await expect(findReleaseGroupMbid("Phantom Island")).resolves.toBe("album-mbid");
  });

  it("falls back to the top-scored groups[0].id when no Album-typed group exists", async () => {
    stubMbSearch([
      { id: "ep-mbid", score: 100, "primary-type": "EP" },
      { id: "other-mbid", score: 97, "primary-type": "Single" },
    ]);

    await expect(findReleaseGroupMbid("Willoughby's Beach")).resolves.toBe("ep-mbid");
  });

  it("returns null on an empty release-groups result (placeholder contract)", async () => {
    stubMbSearch([]);

    await expect(findReleaseGroupMbid("Not A Real Album")).resolves.toBeNull();
  });
});

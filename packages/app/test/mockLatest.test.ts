import { pollLatest } from "@guezzer/core";
import { afterEach, describe, expect, it } from "vitest";
import { getMockLatestFetch } from "../src/live/mockLatest.ts";

/**
 * The `?mockLatest=1` UAT harness (quick task 260713-wjd) must stay inert on
 * normal loads and, when active, produce fixture rows that survive the REAL
 * pipeline — latestSetlistRow zod validation + the artist_id gate inside
 * pollLatest. If the fixture ever drifts from the schema, this test goes red
 * instead of the harness silently yielding an empty strip.
 */

const ORIGINAL_URL = "/";

describe("getMockLatestFetch", () => {
  afterEach(() => {
    history.replaceState(null, "", ORIGINAL_URL);
  });

  it("returns null without the ?mockLatest=1 flag (normal loads untouched)", () => {
    history.replaceState(null, "", "/");
    expect(getMockLatestFetch()).toBeNull();
    history.replaceState(null, "", "/?mockLatest=0");
    expect(getMockLatestFetch()).toBeNull();
  });

  it("fixture rows pass the real pollLatest pipeline (schema + artist gate)", async () => {
    history.replaceState(null, "", "/?mockLatest=1");
    const mockFetch = getMockLatestFetch();
    expect(mockFetch).not.toBeNull();

    const rows = await pollLatest({ fetch: mockFetch! });
    // All 4 fixture rows validate and clear the artist_id === 1 gate.
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.songname)).toEqual([
      "Rattlesnake",
      "Robot Stop",
      "Gaia",
      "Mars for the Rich",
    ]);
    expect(rows.every((r) => r.artist_id === 1)).toBe(true);
    // Dated today (local) so the D-07 auto-bind date guard can match.
    expect(rows[0].showdate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

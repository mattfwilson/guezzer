import { describe, expect, it, vi } from "vitest";
import showyear2013 from "../../../../data/samples/showyear2013.json" with { type: "json" };
import { config } from "../../src/config.ts";
import { archiveShowSchema } from "../../src/dex/archive-types.ts";
import {
  fetchRecentShows,
  type RecentShowsDeps,
} from "../../src/dex/recent-shows.ts";

/** A real KGLW (artist_id 1) showyear-shape base row — the committed sample row. */
const baseRow = { ...(showyear2013.data[0] as Record<string, unknown>) };

function makeRow(overrides: Record<string, unknown>): unknown {
  return { ...baseRow, ...overrides };
}

function jsonEnvelope(data: unknown[]): { error: boolean; error_message: string; data: unknown[] } {
  return { error: false, error_message: "", data };
}

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

function depsFor(mockFetch: unknown): RecentShowsDeps {
  return { fetch: mockFetch as typeof fetch };
}

const YEAR = 2026;
const SINCE = "2025-12-13";

describe("fetchRecentShows — tolerant online fallback (D-09, Pitfall 9)", () => {
  it("groups two post-corpus shows into ArchiveShape with ordered sets + a full songs record", async () => {
    const rows = [
      // Show A — one main set, two songs (position order preserved).
      makeRow({ show_id: 900, showdate: "2026-06-26", showyear: YEAR, songname: "Robot Stop", song_id: 500, setnumber: "1", position: 1, venuename: "Red Rocks", city: "Morrison", state: "CO", country: "USA" }),
      makeRow({ show_id: 900, showdate: "2026-06-26", showyear: YEAR, songname: "Gamma Knife", song_id: 501, setnumber: "1", position: 2, venuename: "Red Rocks", city: "Morrison", state: "CO", country: "USA" }),
      // Show A — encore.
      makeRow({ show_id: 900, showdate: "2026-06-26", showyear: YEAR, songname: "Float Along", song_id: 502, setnumber: "e", position: 3, venuename: "Red Rocks", city: "Morrison", state: "CO", country: "USA" }),
      // Show B — a single song.
      makeRow({ show_id: 901, showdate: "2026-06-27", showyear: YEAR, songname: "The River", song_id: 503, setnumber: "1", position: 1, venuename: "The Gorge", city: "George", state: "WA", country: "USA" }),
    ];
    const mockFetch = vi.fn(async () => okResponse(jsonEnvelope(rows)));

    const { shows, songs } = await fetchRecentShows(YEAR, SINCE, depsFor(mockFetch));

    expect(shows.map((s) => s.id).sort((a, b) => a - b)).toEqual([900, 901]);

    const showA = shows.find((s) => s.id === 900)!;
    expect(showA.venue).toBe("Red Rocks");
    expect(showA.city).toBe("Morrison");
    expect(showA.sets.map((set) => set.n)).toEqual(["1", "e"]);
    expect(showA.sets[0].songs).toEqual([500, 501]);
    expect(showA.sets[1].songs).toEqual([502]);

    // The songs record names every songId referenced in the returned shows' sets.
    for (const show of shows) {
      for (const set of show.sets) {
        for (const songId of set.songs) {
          expect(songs[songId]).toBeTypeOf("string");
        }
      }
    }
    expect(songs[500]).toBe("Robot Stop");
    expect(songs[503]).toBe("The River");
  });

  it("returns structurally valid ArchiveShow rows (archiveShowSchema parses)", async () => {
    const rows = [
      makeRow({ show_id: 900, showdate: "2026-06-26", showyear: YEAR, song_id: 500, setnumber: "1", position: 1 }),
    ];
    const mockFetch = vi.fn(async () => okResponse(jsonEnvelope(rows)));
    const { shows } = await fetchRecentShows(YEAR, SINCE, depsFor(mockFetch));
    for (const show of shows) {
      expect(() => archiveShowSchema.parse(show)).not.toThrow();
    }
  });

  it("returns an empty result and does NOT throw on a non-OK HTTP status", async () => {
    const mockFetch = vi.fn(async () => new Response("", { status: 500 }));
    await expect(fetchRecentShows(YEAR, SINCE, depsFor(mockFetch))).resolves.toEqual({ shows: [], songs: {} });
  });

  it("returns an empty result and does NOT throw on a network/timeout rejection", async () => {
    const mockFetch = vi.fn(async () => {
      throw new DOMException("aborted", "TimeoutError");
    });
    await expect(fetchRecentShows(YEAR, SINCE, depsFor(mockFetch))).resolves.toEqual({ shows: [], songs: {} });
  });

  it("filters out foreign-artist rows (artist_id !== 1)", async () => {
    const rows = [
      makeRow({ show_id: 900, showdate: "2026-06-26", showyear: YEAR, song_id: 500, setnumber: "1", position: 1, artist_id: 1 }),
      makeRow({ show_id: 999, showdate: "2026-06-26", showyear: YEAR, song_id: 700, setnumber: "1", position: 1, artist_id: 4 }),
    ];
    const mockFetch = vi.fn(async () => okResponse(jsonEnvelope(rows)));
    const { shows } = await fetchRecentShows(YEAR, SINCE, depsFor(mockFetch));
    expect(shows.map((s) => s.id)).toEqual([900]);
  });

  it("soft-fails to an empty result when the filter assertion trips (silent-filter-ignore)", async () => {
    // artist_id === 1 rows but a wrong showyear — the API ignored the filter.
    const rows = [
      makeRow({ show_id: 900, showdate: "2019-06-26", showyear: 2019, song_id: 500, setnumber: "1", position: 1, artist_id: 1 }),
    ];
    const mockFetch = vi.fn(async () => okResponse(jsonEnvelope(rows)));
    await expect(fetchRecentShows(YEAR, SINCE, depsFor(mockFetch))).resolves.toEqual({ shows: [], songs: {} });
  });

  it("excludes shows dated on or before sinceDate (never duplicates corpus shows)", async () => {
    const rows = [
      makeRow({ show_id: 800, showdate: SINCE, showyear: YEAR, song_id: 500, setnumber: "1", position: 1 }), // == boundary → excluded
      makeRow({ show_id: 901, showdate: "2026-06-27", showyear: YEAR, song_id: 503, setnumber: "1", position: 1 }), // after → kept
    ];
    const mockFetch = vi.fn(async () => okResponse(jsonEnvelope(rows)));
    const { shows } = await fetchRecentShows(YEAR, SINCE, depsFor(mockFetch));
    expect(shows.map((s) => s.id)).toEqual([901]);
  });

  it("carries a post-corpus debut song's name — a songId absent from any bundled archive", async () => {
    const debutId = 99999; // never in the bundled archive.songs map
    const rows = [
      makeRow({ show_id: 901, showdate: "2026-06-27", showyear: YEAR, song_id: debutId, songname: "Brand New Debut", setnumber: "1", position: 1 }),
    ];
    const mockFetch = vi.fn(async () => okResponse(jsonEnvelope(rows)));
    const { shows, songs } = await fetchRecentShows(YEAR, SINCE, depsFor(mockFetch));
    expect(shows[0].sets[0].songs).toContain(debutId);
    expect(songs[debutId]).toBe("Brand New Debut");
  });

  it("performs exactly one GET to the showyear endpoint with the config User-Agent", async () => {
    const mockFetch = vi.fn(async () => okResponse(jsonEnvelope([])));
    await fetchRecentShows(YEAR, SINCE, depsFor(mockFetch));
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${config.apiBase}/setlists/showyear/${YEAR}.json`);
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe(config.userAgent);
  });
});

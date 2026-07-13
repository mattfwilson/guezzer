import { describe, expect, it, vi } from "vitest";
import latestSample from "../../../data/samples/latest.sample.json" with { type: "json" };
import { config } from "../src/config.ts";
import { pollLatest, type PollDeps } from "../src/live/poll-latest.ts";

/** A real KGLW (artist_id 1) latest-shape base row: the committed foreign-band
 *  sample row with its artist re-scoped to KGLW. Keeps every present key so it
 *  parses under latestSetlistRow. */
const kglwRow = { ...(latestSample.data[0] as Record<string, unknown>), artist_id: 1 };

function makeRow(overrides: Record<string, unknown>): unknown {
  return { ...kglwRow, ...overrides };
}

function jsonEnvelope(data: unknown[]): { error: boolean; error_message: string; data: unknown[] } {
  return { error: false, error_message: "", data };
}

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

function depsFor(mockFetch: unknown): PollDeps {
  return { fetch: mockFetch as typeof fetch };
}

describe("pollLatest — tolerant live poller (SYNC-01 / D-06)", () => {
  it("returns the parsed LatestSetlistRow[] ordered as received on a valid 200 envelope", async () => {
    const rows = [
      makeRow({ song_id: 10, position: 1 }),
      makeRow({ song_id: 20, position: 2 }),
      makeRow({ song_id: 30, position: 3 }),
    ];
    const mockFetch = vi.fn(async () => okResponse(jsonEnvelope(rows)));

    const result = await pollLatest(depsFor(mockFetch));

    expect(result.map((r) => r.song_id)).toEqual([10, 20, 30]);
  });

  it("returns [] and does NOT throw on a non-OK HTTP status (tolerant, D-06)", async () => {
    const mockFetch = vi.fn(async () => new Response("", { status: 500 }));
    await expect(pollLatest(depsFor(mockFetch))).resolves.toEqual([]);
  });

  it("returns [] and does NOT throw on an error:true envelope", async () => {
    const mockFetch = vi.fn(async () =>
      okResponse({ error: true, error_message: "boom", data: [] }),
    );
    await expect(pollLatest(depsFor(mockFetch))).resolves.toEqual([]);
  });

  it("returns [] and does NOT throw on a network/timeout rejection from fetch", async () => {
    const mockFetch = vi.fn(async () => {
      throw new DOMException("aborted", "TimeoutError");
    });
    await expect(pollLatest(depsFor(mockFetch))).resolves.toEqual([]);
  });

  it("treats data: [] (valid empty result) as success, returning []", async () => {
    const mockFetch = vi.fn(async () => okResponse(jsonEnvelope([])));
    await expect(pollLatest(depsFor(mockFetch))).resolves.toEqual([]);
  });

  it("discards artist_id !== 1 rows while keeping artist_id === 1 rows (T-05-02 / DATA-03)", async () => {
    const rows = [
      makeRow({ song_id: 10, position: 1, artist_id: 1 }),
      makeRow({ song_id: 99, position: 2, artist_id: 4 }), // Stu Mackenzie solo — foreign band
      makeRow({ song_id: 20, position: 3, artist_id: 1 }),
    ];
    const mockFetch = vi.fn(async () => okResponse(jsonEnvelope(rows)));

    const result = await pollLatest(depsFor(mockFetch));

    expect(result.map((r) => r.song_id)).toEqual([10, 20]);
    expect(result.every((r) => r.artist_id === 1)).toBe(true);
  });

  it("never throws on a malformed row — it is skipped, valid rows still returned", async () => {
    const rows = [
      makeRow({ song_id: 10, position: 1 }),
      makeRow({ song_id: "not-a-number", position: 2 }), // malformed (type violation)
      makeRow({ song_id: 20, position: 3 }),
    ];
    const mockFetch = vi.fn(async () => okResponse(jsonEnvelope(rows)));

    const result = await pollLatest(depsFor(mockFetch));

    expect(result.map((r) => r.song_id)).toEqual([10, 20]);
  });

  it("sends the descriptive config.userAgent header", async () => {
    const mockFetch = vi.fn(async () => okResponse(jsonEnvelope([])));
    await pollLatest(depsFor(mockFetch));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe(config.userAgent);
  });

  it("performs exactly one GET to config.apiBase + config.latestPath (T-05-03 cadence)", async () => {
    const mockFetch = vi.fn(async () => okResponse(jsonEnvelope([])));
    await pollLatest(depsFor(mockFetch));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0] as unknown as [string];
    expect(url).toBe(`${config.apiBase}${config.latestPath}`);
  });
});

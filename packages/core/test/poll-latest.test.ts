import { afterEach, describe, expect, it, vi } from "vitest";
import latestSample from "../../../data/samples/latest.sample.json" with { type: "json" };
import { config } from "../src/config.ts";
import { pollLatest, type PollDeps, type PollResult } from "../src/live/poll-latest.ts";

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

const EMPTY_RESULT: PollResult = { rows: [], schemaDrift: false };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("pollLatest — tolerant live poller (SYNC-01 / D-06)", () => {
  it("resolves { rows, schemaDrift:false } with the parsed rows as received on a valid 200 envelope", async () => {
    const rows = [
      makeRow({ song_id: 10, position: 1 }),
      makeRow({ song_id: 20, position: 2 }),
      makeRow({ song_id: 30, position: 3 }),
    ];
    const mockFetch = vi.fn(async () => okResponse(jsonEnvelope(rows)));

    const result = await pollLatest(depsFor(mockFetch));

    expect(result.rows.map((r) => r.song_id)).toEqual([10, 20, 30]);
    expect(result.schemaDrift).toBe(false);
    expect(result.novelKeys).toBeUndefined();
  });

  it("returns the empty soft-fail result and does NOT throw on a non-OK HTTP status (tolerant, D-06)", async () => {
    const mockFetch = vi.fn(async () => new Response("", { status: 500 }));
    await expect(pollLatest(depsFor(mockFetch))).resolves.toEqual(EMPTY_RESULT);
  });

  it("returns the empty soft-fail result and does NOT throw on an error:true envelope", async () => {
    const mockFetch = vi.fn(async () =>
      okResponse({ error: true, error_message: "boom", data: [] }),
    );
    await expect(pollLatest(depsFor(mockFetch))).resolves.toEqual(EMPTY_RESULT);
  });

  it("returns the empty soft-fail result and does NOT throw on a network/timeout rejection (V7)", async () => {
    const mockFetch = vi.fn(async () => {
      throw new DOMException("aborted", "TimeoutError");
    });
    await expect(pollLatest(depsFor(mockFetch))).resolves.toEqual(EMPTY_RESULT);
  });

  it("treats data: [] (valid empty result) as success, returning the empty soft-fail result", async () => {
    const mockFetch = vi.fn(async () => okResponse(jsonEnvelope([])));
    await expect(pollLatest(depsFor(mockFetch))).resolves.toEqual(EMPTY_RESULT);
  });

  it("LIVE-02 REGRESSION: a mixed-artist payload surfaces only artist_id === 1 rows, never a foreign band", async () => {
    const rows = [
      makeRow({ song_id: 10, position: 1, artist_id: 1 }),
      makeRow({ song_id: 99, position: 2, artist_id: 4 }), // Stu Mackenzie solo — foreign band (SCHEMA §9)
      makeRow({ song_id: 20, position: 3, artist_id: 1 }),
      makeRow({ song_id: 77, position: 4, artist_id: 12 }), // another non-KGLW act
    ];
    const mockFetch = vi.fn(async () => okResponse(jsonEnvelope(rows)));

    const result = await pollLatest(depsFor(mockFetch));

    expect(result.rows.map((r) => r.song_id)).toEqual([10, 20]);
    expect(result.rows.every((r) => r.artist_id === 1)).toBe(true);
  });

  it("never throws on a wrong-typed CONSUMED field — the row is skipped, valid rows still returned", async () => {
    const rows = [
      makeRow({ song_id: 10, position: 1 }),
      makeRow({ song_id: "not-a-number", position: 2 }), // malformed (type violation)
      makeRow({ song_id: 20, position: 3 }),
    ];
    const mockFetch = vi.fn(async () => okResponse(jsonEnvelope(rows)));

    const result = await pollLatest(depsFor(mockFetch));

    expect(result.rows.map((r) => r.song_id)).toEqual([10, 20]);
  });

  it("flags schemaDrift + lists novelKeys when a row carries an additive key (LIVE-03)", async () => {
    const rows = [
      makeRow({ song_id: 10, position: 1, new_api_field: 1 }),
      makeRow({ song_id: 20, position: 2, another_new_field: "x" }),
    ];
    const mockFetch = vi.fn(async () => okResponse(jsonEnvelope(rows)));

    const result = await pollLatest(depsFor(mockFetch));

    // Rows stay usable (never emptied by drift).
    expect(result.rows.map((r) => r.song_id)).toEqual([10, 20]);
    expect(result.schemaDrift).toBe(true);
    expect([...(result.novelKeys ?? [])].sort()).toEqual(["another_new_field", "new_api_field"]);
  });

  it("logs drift EXACTLY ONCE per poll, not once per row (aggregate discipline)", async () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const rows = [
      makeRow({ song_id: 10, position: 1, new_api_field: 1 }),
      makeRow({ song_id: 20, position: 2, new_api_field: 2 }),
      makeRow({ song_id: 30, position: 3, new_api_field: 3 }),
    ];
    const mockFetch = vi.fn(async () => okResponse(jsonEnvelope(rows)));

    await pollLatest(depsFor(mockFetch));

    // No malformed rows here, so the ONLY debug line is the single drift log.
    expect(debugSpy).toHaveBeenCalledTimes(1);
  });

  it("the drift log carries key NAMES only — never an editor-supplied value (T-11-02-03 / SCHEMA §12)", async () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const editorValue = "<script>alert(1)</script>";
    const rows = [makeRow({ song_id: 10, position: 1, evil_field: editorValue })];
    const mockFetch = vi.fn(async () => okResponse(jsonEnvelope(rows)));

    await pollLatest(depsFor(mockFetch));

    const logged = debugSpy.mock.calls.map((c) => String(c[0])).join("|");
    expect(logged).toContain("evil_field");
    expect(logged).not.toContain(editorValue);
  });

  it("a clean payload does NOT flag drift and logs nothing", async () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const rows = [makeRow({ song_id: 10, position: 1 }), makeRow({ song_id: 20, position: 2 })];
    const mockFetch = vi.fn(async () => okResponse(jsonEnvelope(rows)));

    const result = await pollLatest(depsFor(mockFetch));

    expect(result.schemaDrift).toBe(false);
    expect(result.novelKeys).toBeUndefined();
    expect(debugSpy).not.toHaveBeenCalled();
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

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import rr1010 from "../../../data/samples/rr1010.json" with { type: "json" };
import { config } from "../src/config.ts";
import { fetchCorpus, fetchJson, type FetchDeps } from "../src/cli/fetch-corpus.ts";
import { parseRefreshArgs } from "../src/cli/refresh.ts";

/** A minimal, valid base row (real rr1010.json data[0] shape) for building synthetic rows. */
const baseRow = { ...rr1010.data[0] };

function makeRow(overrides: Record<string, unknown>): unknown {
  return { ...baseRow, ...overrides };
}

function jsonEnvelope(data: unknown[]): { error: boolean; error_message: string; data: unknown[] } {
  return { error: false, error_message: "", data };
}

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "guezzer-fetch-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("fetchCorpus — pacing, sequencing, User-Agent (mocked fetch, zero real network calls)", () => {
  it("Test 1: strictly sequential requests; sleep hook called between EVERY pair of consecutive requests with config.fetchDelayMs", async () => {
    let inFlight = 0;
    let overlapDetected = false;
    const mockFetch = vi.fn(async () => {
      inFlight++;
      if (inFlight > 1) overlapDetected = true;
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return okResponse(jsonEnvelope([]));
    });
    const mockSleep = vi.fn(async () => {});
    const deps: FetchDeps = { fetch: mockFetch as unknown as typeof fetch, sleep: mockSleep };

    await fetchCorpus({ years: [2012, 2013], outputDir: tempDir }, deps);

    expect(overlapDetected).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockSleep).toHaveBeenCalledTimes(1);
    expect(mockSleep).toHaveBeenCalledWith(config.fetchDelayMs);
  });

  it("Test 2: every request carries the descriptive User-Agent header", async () => {
    const mockFetch = vi.fn(async () => okResponse(jsonEnvelope([])));
    const mockSleep = vi.fn(async () => {});
    const deps: FetchDeps = { fetch: mockFetch as unknown as typeof fetch, sleep: mockSleep };

    await fetchCorpus({ years: [2012], outputDir: tempDir }, deps);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe("Guezzer setlist tool (matt.f.wilson@gmail.com)");
  });

  it("Test 3a: an error envelope throws naming the endpoint and error_message", async () => {
    const mockFetch = vi.fn(async () =>
      okResponse({ error: true, error_message: "boom, invalid request", data: [] }),
    );
    const mockSleep = vi.fn(async () => {});
    const deps: FetchDeps = { fetch: mockFetch as unknown as typeof fetch, sleep: mockSleep };

    await expect(fetchJson("/setlists/showyear/2012.json", deps)).rejects.toThrow(
      /setlists\/showyear\/2012\.json.*boom, invalid request/s,
    );
  });

  it("Test 3b: HTTP 500 throws naming status + path; NOT retried (mockFetch called exactly once)", async () => {
    const mockFetch = vi.fn(async () => new Response("", { status: 500 }));
    const mockSleep = vi.fn(async () => {});
    const deps: FetchDeps = { fetch: mockFetch as unknown as typeof fetch, sleep: mockSleep };

    await expect(fetchJson("/setlists/showyear/2012.json", deps)).rejects.toThrow(
      /500.*setlists\/showyear\/2012\.json/s,
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("Test 4: data: [] for a year is tolerated as valid, written as an empty rows file, never thrown", async () => {
    const mockFetch = vi.fn(async () => okResponse(jsonEnvelope([])));
    const mockSleep = vi.fn(async () => {});
    const deps: FetchDeps = { fetch: mockFetch as unknown as typeof fetch, sleep: mockSleep };

    await expect(fetchCorpus({ years: [2011], outputDir: tempDir }, deps)).resolves.not.toThrow();

    const written = JSON.parse(await readFile(join(tempDir, "setlists-2011.json"), "utf8"));
    expect(written).toEqual([]);
  });

  it("Test 5: a row with the wrong showyear throws via assertFilterApplied naming the endpoint and both year values", async () => {
    const rows = [makeRow({ show_id: 555, showdate: "2012-06-01", showyear: 2013, position: 1 })];
    const mockFetch = vi.fn(async () => okResponse(jsonEnvelope(rows)));
    const mockSleep = vi.fn(async () => {});
    const deps: FetchDeps = { fetch: mockFetch as unknown as typeof fetch, sleep: mockSleep };

    await expect(fetchCorpus({ years: [2012], outputDir: tempDir }, deps)).rejects.toThrow(
      /setlists\/showyear\/2012.*showyear.*2012.*2013/s,
    );
  });

  it("Test 6: a year response with more than config.maxRowsPerYearSanity rows throws (silent-filter-ignore tripwire)", async () => {
    const tooManyRows = Array.from({ length: config.maxRowsPerYearSanity + 1 }, (_, i) =>
      makeRow({ show_id: 900000 + i, showdate: "2012-06-01", showyear: 2012, position: 1 }),
    );
    const mockFetch = vi.fn(async () => okResponse(jsonEnvelope(tooManyRows)));
    const mockSleep = vi.fn(async () => {});
    const deps: FetchDeps = { fetch: mockFetch as unknown as typeof fetch, sleep: mockSleep };

    await expect(fetchCorpus({ years: [2012], outputDir: tempDir }, deps)).rejects.toThrow(
      /maxRowsPerYearSanity|sanity/i,
    );
  });
});

describe("refresh CLI — --year arg validation (security V5: validated before URL/path construction)", () => {
  it("Test 7a: --year 1999 is rejected naming the valid range 2010-2100", () => {
    expect(() => parseRefreshArgs(["--year", "1999"], 2026)).toThrow(/2010.*2100/s);
  });

  it("Test 7b: --year banana is rejected (not an integer)", () => {
    expect(() => parseRefreshArgs(["--year", "banana"], 2026)).toThrow(/2010.*2100/s);
  });

  it("Test 7c: --year 2013 is accepted", () => {
    const options = parseRefreshArgs(["--year", "2013"], 2026);
    expect(options.mode).toBe("year");
    expect(options.years).toEqual([2013]);
  });
});

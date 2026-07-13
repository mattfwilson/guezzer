import { describe, expect, it } from "vitest";
import type { ZodError } from "zod";
import latestSample from "../../../data/samples/latest.sample.json" with { type: "json" };
import { rawSetlistRowCensus } from "../src/ingest/api-types.ts";
import {
  formatRowError,
  latestSetlistRow,
  type LatestSetlistRow,
} from "../src/ingest/latest-types.ts";
import { config } from "../src/config.ts";

const firstRow = latestSample.data[0] as unknown;

describe("latestSetlistRow — the latest-endpoint-specific schema (SYNC-01)", () => {
  it("parses the committed real-shape latest.sample.json first row without throwing", () => {
    expect(() => latestSetlistRow.parse(firstRow)).not.toThrow();
  });

  it("parses every row of the committed sample", () => {
    for (const row of latestSample.data) {
      expect(() => latestSetlistRow.parse(row)).not.toThrow();
    }
  });

  it("the committed sample's rows do NOT carry the 5 latest-absent keys (SCHEMA §11)", () => {
    for (const row of latestSample.data as Record<string, unknown>[]) {
      for (const absent of ["css_class", "isrecommended", "tracktime", "timezone", "showtime"]) {
        expect(absent in row).toBe(false);
      }
    }
  });

  it("PROVES THE FIX: the same real latest row throws under rawSetlistRowCensus (5 missing keys)", () => {
    // This is why latestSetlistRow must exist — reusing the census schema
    // hard-fails on a live latest row because css_class/isrecommended/
    // tracktime/timezone/showtime are required-but-absent (RESEARCH Pitfall 1).
    expect(() => rawSetlistRowCensus.parse(firstRow)).toThrow();
  });

  it("rejects a row carrying an unexpected/unknown key (strictObject drift detection)", () => {
    const row = { ...(firstRow as object), bogus_new_field: 1 };
    expect(() => latestSetlistRow.parse(row)).toThrow();
  });

  it("rejects a row whose song_id is a string (type enforcement)", () => {
    const row = { ...(firstRow as object), song_id: "133" };
    expect(() => latestSetlistRow.parse(row)).toThrow();
  });

  it("rejects a row whose showdate is not YYYY-MM-DD", () => {
    const row = { ...(firstRow as object), showdate: "10/10/2022" };
    expect(() => latestSetlistRow.parse(row)).toThrow();
  });

  it("formatRowError appends show_id/showdate context to a latest-row parse failure", () => {
    const row = { ...(firstRow as object), song_id: "not-a-number" };
    let thrown: unknown;
    try {
      latestSetlistRow.parse(row);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeDefined();
    const message = formatRowError(thrown as ZodError, row);
    const showId = (firstRow as { show_id: number }).show_id;
    const showDate = (firstRow as { showdate: string }).showdate;
    expect(message).toContain(String(showId));
    expect(message).toContain(showDate);
  });

  it("config.latestPath is the latest endpoint path", () => {
    expect(config.latestPath).toBe("/latest.json");
  });

  it("infers a LatestSetlistRow type usable downstream", () => {
    const row: LatestSetlistRow = latestSetlistRow.parse(firstRow);
    expect(typeof row.song_id).toBe("number");
    expect(typeof row.songname).toBe("string");
  });
});

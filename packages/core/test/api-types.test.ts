import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import rr1010 from "../../../data/samples/rr1010.json" with { type: "json" };
import showyear2013 from "../../../data/samples/showyear2013.json" with { type: "json" };
import census from "../../../data/census.json" with { type: "json" };
import {
  apiEnvelope,
  formatRowError,
  rawSetlistRowCensus,
  rawSetlistRowLocked,
  setnumberLocked,
  settypeLocked,
  transitionIdLocked,
} from "../src/ingest/api-types.ts";

// setlists-2025.json is a committed bare row array (not an envelope) — the
// "spot-checked recent year file" required by Task 1's behavior spec.
const setlists2025 = JSON.parse(
  readFileSync(new URL("../../../data/raw/setlists-2025.json", import.meta.url), "utf8"),
) as unknown[];

/**
 * data/census.json's `settype` field is intentionally KGLW-scoped
 * (artist_id === 1 only, per 01-03-SUMMARY.md decisions) — it does not
 * capture side-project settype variants ("DJ Set", "Act") that exist
 * elsewhere in the committed multi-artist raw corpus. Since
 * `rawSetlistRowLocked` validates every raw row BEFORE the artist_id
 * filter runs (normalize.ts), its settype vocabulary must cover the FULL
 * raw corpus across all artist_ids — scan it directly rather than trusting
 * the KGLW-scoped census field for this one check.
 */
const dataRawDir = fileURLToPath(new URL("../../../data/raw", import.meta.url));
const allRawSettypeValues = new Set<string>();
for (const fileName of readdirSync(dataRawDir)) {
  if (!fileName.startsWith("setlists-")) continue;
  const rows = JSON.parse(readFileSync(`${dataRawDir}/${fileName}`, "utf8")) as Array<{
    settype: string;
  }>;
  for (const row of rows) allRawSettypeValues.add(row.settype);
}

describe("apiEnvelope", () => {
  it("parses the rr1010 sample envelope", () => {
    expect(() => apiEnvelope.parse(rr1010)).not.toThrow();
  });

  it("parses the showyear2013 sample envelope", () => {
    expect(() => apiEnvelope.parse(showyear2013)).not.toThrow();
  });
});

describe("rawSetlistRowCensus", () => {
  it("has exactly 41 keys", () => {
    expect(Object.keys(rawSetlistRowCensus.shape).length).toBe(41);
  });

  it("parses all 27 rr1010 rows with zero errors", () => {
    for (const row of rr1010.data) {
      expect(() => rawSetlistRowCensus.parse(row)).not.toThrow();
    }
  });

  it("parses all 149 showyear2013 rows with zero errors", () => {
    for (const row of showyear2013.data) {
      expect(() => rawSetlistRowCensus.parse(row)).not.toThrow();
    }
  });

  it("rejects a row with an unknown extra key (API drift)", () => {
    const row = { ...rr1010.data[0], bogus_new_field: 1 };
    expect(() => rawSetlistRowCensus.parse(row)).toThrow();
  });

  it("rejects a row where setnumber is a number instead of a string", () => {
    const row = { ...rr1010.data[0], setnumber: 2 };
    expect(() => rawSetlistRowCensus.parse(row)).toThrow();
  });

  it("rejects a row where showyear is a string instead of a number", () => {
    const row = { ...rr1010.data[0], showyear: "2013" };
    expect(() => rawSetlistRowCensus.parse(row)).toThrow();
  });
});

describe("rawSetlistRowLocked (stage 2 — census-locked enums, D-11)", () => {
  it("Test 1: parses every row of both samples AND setlists-2025.json with zero errors", () => {
    for (const row of rr1010.data) {
      expect(() => rawSetlistRowLocked.parse(row)).not.toThrow();
    }
    for (const row of showyear2013.data) {
      expect(() => rawSetlistRowLocked.parse(row)).not.toThrow();
    }
    for (const row of setlists2025) {
      expect(() => rawSetlistRowLocked.parse(row)).not.toThrow();
    }
  });

  it("Test 2: a row with setnumber \"x\" fails naming the field, the value, and (via formatRowError) the show identifier", () => {
    const row = { ...rr1010.data[0], setnumber: "x" };
    let thrown: unknown;
    try {
      rawSetlistRowLocked.parse(row);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeDefined();
    const message = formatRowError(thrown as import("zod").ZodError, row);
    expect(message).toContain("setnumber");
    expect(message).toContain("x");
    expect(message).toMatch(/1678309429|2022-10-10/);
  });

  it("Test 3: a row with transition_id: 99 fails with a message containing transition_id and 99", () => {
    const row = { ...rr1010.data[0], transition_id: 99 };
    let thrown: unknown;
    try {
      rawSetlistRowLocked.parse(row);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeDefined();
    const message = formatRowError(thrown as import("zod").ZodError, row);
    expect(message).toContain("transition_id");
    expect(message).toContain("99");
  });

  it("Test 4: a settype value outside the census-observed vocabulary fails the locked schema", () => {
    const row = { ...rr1010.data[0], settype: "Soundcheck" };
    expect(() => rawSetlistRowLocked.parse(row)).toThrow();
  });

  it("Test 5: census-mode rawSetlistRowCensus still accepts all of the above novel values (the two schemas coexist permanently)", () => {
    const setnumberRow = { ...rr1010.data[0], setnumber: "x" };
    const transitionRow = { ...rr1010.data[0], transition_id: 99 };
    const settypeRow = { ...rr1010.data[0], settype: "Soundcheck" };
    expect(() => rawSetlistRowCensus.parse(setnumberRow)).not.toThrow();
    expect(() => rawSetlistRowCensus.parse(transitionRow)).not.toThrow();
    expect(() => rawSetlistRowCensus.parse(settypeRow)).not.toThrow();
  });

  it("Test 6: every value in setnumberLocked appears in data/census.json; every settypeLocked value appears in the full raw corpus scan (no invented vocabulary)", () => {
    const censusSetnumberValues = new Set(
      (census.fields.setnumber as Array<{ value: string }>).map((f) => f.value),
    );

    for (const value of setnumberLocked.options) {
      expect(censusSetnumberValues.has(value)).toBe(true);
    }
    // settypeLocked deliberately covers side-project settype variants
    // ("DJ Set", "Act") absent from census.json's KGLW-scoped settype
    // field (see allRawSettypeValues comment above) — cross-check against
    // the full raw-corpus scan instead.
    for (const value of settypeLocked.options) {
      expect(allRawSettypeValues.has(value)).toBe(true);
    }
  });

  it("transitionIdLocked's literal values all appear in data/census.json's transition_id field", () => {
    const censusTransitionIdValues = new Set(
      (census.fields.transition_id as Array<{ value: number }>).map((f) => f.value),
    );
    const lockedValues = transitionIdLocked.options.map(
      (opt: { value: number }) => opt.value,
    );
    for (const value of lockedValues) {
      expect(censusTransitionIdValues.has(value)).toBe(true);
    }
  });
});

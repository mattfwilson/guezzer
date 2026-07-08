import { describe, expect, it } from "vitest";
import rr1010 from "../../../data/samples/rr1010.json" with { type: "json" };
import showyear2013 from "../../../data/samples/showyear2013.json" with { type: "json" };
import { apiEnvelope, rawSetlistRowCensus } from "../src/ingest/api-types.ts";

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

import { describe, expect, it } from "vitest";
import showyear2013 from "../../../data/samples/showyear2013.json" with { type: "json" };
import { assertFilterApplied } from "../src/ingest/validate.ts";

describe("assertFilterApplied", () => {
  it("passes on real 2013 sample rows (all showyear === 2013)", () => {
    expect(() =>
      assertFilterApplied(showyear2013.data, "setlists/showyear/2013", {
        field: "showyear",
        expected: 2013,
      }),
    ).not.toThrow();
  });

  it("throws naming endpoint, field, expected, actual, and a row excerpt when a row violates the filter", () => {
    const rows = showyear2013.data.map((r, i) =>
      i === 5 ? { ...r, showyear: 2014 } : r,
    );

    let thrown: Error | undefined;
    try {
      assertFilterApplied(rows, "setlists/showyear/2013", {
        field: "showyear",
        expected: 2013,
      });
    } catch (err) {
      thrown = err as Error;
    }

    expect(thrown).toBeInstanceOf(Error);
    const message = thrown!.message;
    expect(message).toContain("setlists/showyear/2013");
    expect(message).toContain("showyear");
    expect(message).toContain("2013");
    expect(message).toContain("2014");
    expect(message.length).toBeGreaterThan(100);
  });

  it("passes on an empty rows array (empty result is valid, not an error)", () => {
    expect(() =>
      assertFilterApplied([], "setlists/showyear/2013", {
        field: "showyear",
        expected: 2013,
      }),
    ).not.toThrow();
  });
});

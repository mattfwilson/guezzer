import { describe, expect, it } from "vitest";
import { formatFullDate, formatMonYear } from "../src/dex/formatDate.ts";

/**
 * FOUND-04 / D-31 — the shared UTC-safe display-date helpers (RED gate).
 *
 * Task 1's failing-first coverage: the six `<behavior>` cases from 21-02. The
 * full spec (UTC-boundary demonstration + the source guard on the timezone pin)
 * lands in Task 2.
 */

describe("formatFullDate", () => {
  it("formats an ISO date as 'Mon D, YYYY'", () => {
    expect(formatFullDate("2026-08-15")).toBe("Aug 15, 2026");
  });

  it("does not slip a day backwards at the UTC year boundary", () => {
    expect(formatFullDate("2026-01-01")).toBe("Jan 1, 2026");
  });

  it("renders a single-digit day unpadded", () => {
    expect(formatFullDate("2026-08-05")).toBe("Aug 5, 2026");
  });

  it("returns the raw input for unparseable dates, never 'Invalid Date'", () => {
    expect(formatFullDate("not-a-date")).toBe("not-a-date");
  });

  it("round-trips the empty string", () => {
    expect(formatFullDate("")).toBe("");
  });
});

describe("formatMonYear", () => {
  it("is unchanged by the module rename", () => {
    expect(formatMonYear("2025-01-01")).toBe("Jan 2025");
  });
});

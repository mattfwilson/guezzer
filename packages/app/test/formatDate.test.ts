import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { formatFullDate, formatMonYear } from "../src/dex/formatDate.ts";

/**
 * FOUND-04 / FOUND-05 / D-31 — the shared UTC-safe display-date helpers.
 *
 * Covers the UTC boundary, the never-throw path, the empty-string path, and the
 * timezone pin itself.
 *
 * TIMEZONE SETUP: this file takes **option (c)** from 21-PATTERNS §No Analog
 * Found — assert the UTC-pinned output directly, and back it with a source
 * guard. No test in this repo sets `TZ` and `test/setup.ts` does not either, so
 * there is no precedent to copy. The two alternatives were rejected:
 *
 *   (a) `process.env.TZ = "America/New_York"` at the top of this file — brittle.
 *       Both formatters are constructed at module import, and there is no
 *       guarantee the assignment lands before that import is evaluated.
 *   (b) `test.env.TZ` in the root `vitest.config.ts` — changes shared config for
 *       BOTH workspace projects. Blast radius well beyond this phase, in
 *       exchange for one assertion.
 *
 * Option (c) is TZ-independent by construction: the assertions below hold on any
 * CI machine *because* the helper pins UTC. The source guard closes the one hole
 * that would otherwise remain — on a UTC build machine, deleting the pin would
 * not fail a single behavioral assertion.
 */

const testDir = dirname(fileURLToPath(import.meta.url));
const formatDateSrcPath = join(testDir, "..", "src", "dex", "formatDate.ts");

describe("formatFullDate", () => {
  it("formats an ISO date as 'Mon D, YYYY' (FOUND-04/FOUND-05)", () => {
    expect(formatFullDate("2026-08-15")).toBe("Aug 15, 2026");
  });

  it("does not slip a day backwards at the UTC year boundary (FOUND-04)", () => {
    expect(formatFullDate("2026-01-01")).toBe("Jan 1, 2026");
  });

  it("renders a single-digit day unpadded (D-31 display format)", () => {
    expect(formatFullDate("2026-08-05")).toBe("Aug 5, 2026");
  });

  it("returns the raw input for unparseable dates, never 'Invalid Date' (T-21-05)", () => {
    expect(formatFullDate("not-a-date")).toBe("not-a-date");
  });

  it("round-trips the empty string so RecapView's `?? \"\"` path is byte-identical", () => {
    expect(formatFullDate("")).toBe("");
  });

  it("differs from an unpinned negative-offset zone — the hazard the pin exists for", () => {
    // Demonstrative, and itself TZ-independent: an explicitly New-York-formatted
    // "2026-01-01" renders the PREVIOUS day, because `new Date("2026-01-01")`
    // parses as UTC midnight. Without `timeZone: "UTC"` every US user would read
    // every show date one day early.
    const newYork = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "America/New_York",
    });
    const unpinned = newYork.format(new Date("2026-01-01"));

    expect(unpinned).toBe("Dec 31, 2025");
    expect(formatFullDate("2026-01-01")).toBe("Jan 1, 2026");
    expect(formatFullDate("2026-01-01")).not.toBe(unpinned);
  });
});

describe("formatMonYear", () => {
  // The rename's regression net at the unit level — this shipped formatter had
  // only indirect (rendered) coverage via songRow.test.tsx before this phase.
  it("formats an ISO date as 'Mon YYYY', unchanged by the module rename (D-32)", () => {
    expect(formatMonYear("2025-01-01")).toBe("Jan 2025");
  });

  it("returns the raw input for unparseable dates", () => {
    expect(formatMonYear("not-a-date")).toBe("not-a-date");
  });

  it("round-trips the empty string", () => {
    expect(formatMonYear("")).toBe("");
  });
});

describe("timezone pin (source guard)", () => {
  // Deleting `timeZone: "UTC"` would still pass every behavioral assertion above
  // on a UTC CI machine. This source check is what actually locks FOUND-04's
  // "UTC-safe" wording — one pin per formatter, asserted against the source.
  it("both formatters pin timeZone: \"UTC\" in the source (FOUND-04)", () => {
    const src = readFileSync(formatDateSrcPath, "utf8");
    const pins = src.match(/timeZone: "UTC"/g) ?? [];
    expect(pins.length).toBeGreaterThanOrEqual(2);
  });

  it("exposes named exports only — no default export (D-31 module shape)", () => {
    const src = readFileSync(formatDateSrcPath, "utf8");
    expect(src).not.toMatch(/export default/);
    expect(src).toMatch(/export function formatMonYear/);
    expect(src).toMatch(/export function formatFullDate/);
  });
});

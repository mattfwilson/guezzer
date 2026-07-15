import { describe, expect, it } from "vitest";
import { fitOrbLabel } from "../src/show/orbLabelFit.ts";
import { config } from "../src/config.ts";

/**
 * fitOrbLabel (D-21) is a pure wrap/scale-to-fit/ellipsis heuristic — the same
 * pure-testable-helper idiom as orbitLayout.ts. These pin the wrap → shrink →
 * floor → ellipsis boundaries with exact inputs so the on-orb rendering stays
 * deterministic and never re-lays-out the fan (SHOW-02 untouched).
 */
const orbOpts = {
  baseFontPx: 14,
  minFontPx: config.show.ORB_LABEL_MIN_FONT_PX,
  maxLines: config.show.ORB_LABEL_MAX_LINES,
};

const centerOpts = {
  baseFontPx: 20,
  minFontPx: config.show.ORB_LABEL_MIN_FONT_PX_CENTER,
  maxLines: config.show.ORB_LABEL_MAX_LINES_CENTER,
};

describe("fitOrbLabel (D-21 wrap/scale-to-fit)", () => {
  it("short name passes through at base font on one line, no ellipsis", () => {
    const result = fitOrbLabel("Rattlesnake", 88, orbOpts);
    expect(result).toEqual({
      fontPx: 14,
      lines: ["Rattlesnake"],
      ellipsized: false,
    });
  });

  it("wraps a long name to two lines BEFORE any font shrink", () => {
    const result = fitOrbLabel("The Dripping Tap", 88, orbOpts);
    expect(result.fontPx).toBe(orbOpts.baseFontPx);
    expect(result.lines).toHaveLength(2);
    expect(result.ellipsized).toBe(false);
    expect(result.lines.join(" ")).toBe("The Dripping Tap");
  });

  it("shrinks toward the floor when two lines at base font aren't enough", () => {
    const result = fitOrbLabel("Nonagon Infinity Opens", 88, orbOpts);
    expect(result.fontPx).toBeGreaterThanOrEqual(orbOpts.minFontPx);
    expect(result.fontPx).toBeLessThan(orbOpts.baseFontPx);
    expect(result.lines.length).toBeLessThanOrEqual(orbOpts.maxLines);
    expect(result.ellipsized).toBe(false);
  });

  it("never shrinks below minFontPx and ellipsizes only at the floor when over budget", () => {
    const result = fitOrbLabel(
      "Supercalifragilistic Antidisestablishmentarian",
      88,
      orbOpts,
    );
    expect(result.fontPx).toBe(orbOpts.minFontPx);
    expect(result.lines.length).toBeLessThanOrEqual(orbOpts.maxLines);
    expect(result.ellipsized).toBe(true);
    expect(result.lines[result.lines.length - 1].endsWith("…")).toBe(true);
  });

  it("is deterministic — identical inputs deep-equal", () => {
    const a = fitOrbLabel("The Dripping Tap", 88, orbOpts);
    const b = fitOrbLabel("The Dripping Tap", 88, orbOpts);
    expect(a).toEqual(b);
  });

  it("honors the wider center budget (3 lines, 14px floor)", () => {
    const short = fitOrbLabel("Rattlesnake", 220, centerOpts);
    expect(short.fontPx).toBe(20);
    expect(short.lines).toEqual(["Rattlesnake"]);

    const long = fitOrbLabel(
      "Supercalifragilistic Antidisestablishmentarian",
      220,
      centerOpts,
    );
    expect(long.fontPx).toBeGreaterThanOrEqual(centerOpts.minFontPx);
    expect(long.lines.length).toBeLessThanOrEqual(centerOpts.maxLines);
  });
});

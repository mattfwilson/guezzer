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
  lineHeightFactor: config.show.ORB_LABEL_LINE_HEIGHT_FACTOR,
  // Synthetic boundary pins exercise the raw wrap/shrink/break/ellipsis branches —
  // no reserved percent line here (that's the catalog test's job, 08-08).
  reservedHeightPx: 0,
};

const centerOpts = {
  baseFontPx: 20,
  minFontPx: config.show.ORB_LABEL_MIN_FONT_PX_CENTER,
  maxLines: config.show.ORB_LABEL_MAX_LINES_CENTER,
  lineHeightFactor: config.show.ORB_LABEL_LINE_HEIGHT_FACTOR,
  reservedHeightPx: 0,
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

  it("wraps a long name across lines BEFORE any font shrink", () => {
    // POLISH-01 retune (plan 08-06): with the conservative CHAR_WIDTH_FACTOR (0.55)
    // this name wraps to three whole-word lines at the base font — still no shrink.
    const result = fitOrbLabel("The Dripping Tap", 88, orbOpts);
    expect(result.fontPx).toBe(orbOpts.baseFontPx);
    expect(result.lines.length).toBeGreaterThan(1);
    expect(result.lines.length).toBeLessThanOrEqual(orbOpts.maxLines);
    expect(result.ellipsized).toBe(false);
    expect(result.lines.join(" ")).toBe("The Dripping Tap");
  });

  it("shrinks toward the floor when the wrap at base font overflows the line budget", () => {
    // A small (56px) orb: the name can't wrap whole within maxLines at base font,
    // so the heuristic shrinks toward the floor while keeping every word whole.
    const result = fitOrbLabel("Nonagon Infinity Opens The Door Again", 56, orbOpts);
    expect(result.fontPx).toBeGreaterThanOrEqual(orbOpts.minFontPx);
    expect(result.fontPx).toBeLessThan(orbOpts.baseFontPx);
    expect(result.lines.length).toBeLessThanOrEqual(orbOpts.maxLines);
    expect(result.ellipsized).toBe(false);
  });

  it("shrinks a long ONE-WORD title to keep it whole on a single line (no break, no ellipsis)", () => {
    // "Consciousness" (13) overflows one line at base 14 but fits whole once shrunk.
    const result = fitOrbLabel("Consciousness", 88, orbOpts);
    expect(result.lines).toEqual(["Consciousness"]);
    expect(result.fontPx).toBeLessThan(orbOpts.baseFontPx);
    expect(result.fontPx).toBeGreaterThanOrEqual(orbOpts.minFontPx);
    expect(result.ellipsized).toBe(false);
  });

  it("hard-breaks a single word too long for any line, preserving the FULL word (no ellipsis)", () => {
    // In a small (56px) orb this word is longer than a line even at the floor →
    // broken across lines rather than clipped (POLISH-01 retune: at larger orbs the
    // conservative fit keeps it whole, so a tight orb is used to exercise the break).
    const result = fitOrbLabel("Interdimensional", 56, orbOpts);
    expect(result.ellipsized).toBe(false);
    expect(result.lines.length).toBeGreaterThan(1);
    expect(result.lines.length).toBeLessThanOrEqual(orbOpts.maxLines);
    expect(result.lines.join("")).toBe("Interdimensional");
  });

  it("never shrinks below minFontPx and ellipsizes only at the floor when over budget", () => {
    // Two absurdly long words that hard-break past maxLines even at the floor in a
    // tight orb — more chars than the circle's 5 lines can hold at 7px, so this is
    // the only path that reaches the (real-name-unreachable) ellipsis safety net.
    // POLISH-01 08-08 realignment: under the stricter circular fit the old
    // 46-char input now hard-breaks and FITS without ellipsis, so a longer input is
    // needed to still exercise the safety-net branch (intent preserved).
    const result = fitOrbLabel(
      "Pneumonoultramicroscopicsilicovolcanoconiosis Floccinaucinihilipilification",
      56,
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

  it("honors the wider center budget (3 lines, config floor)", () => {
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

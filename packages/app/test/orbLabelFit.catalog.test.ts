import { describe, expect, it } from "vitest";
import matrix from "@matrix";
import {
  CHAR_WIDTH_FACTOR,
  fitOrbLabel,
  labelFitsCircle,
} from "../src/show/orbLabelFit.ts";
import { config } from "../src/config.ts";

/**
 * POLISH-01 GEOMETRIC circular-fit lock (plan 08-08). The pure fixture pins in
 * `orbLabelFit.test.ts` guard the wrap/shrink/break/ellipsis BOUNDARIES with
 * synthetic inputs; THIS test guards the actual on-device bar — every real song
 * name in the bundled 264-node `@matrix` artifact must render fully INSIDE its
 * circular fill across the entire dynamic orb diameter range, AND inside the
 * center-node circle.
 *
 * The prior version of this test asserted only `.ellipsized === false` at three
 * fixed diameters — a rectangular, geometry-blind check that let the small-orb
 * overflow regression ship (`fitOrbLabel` modelled the orb as a RECTANGLE). This
 * rewrite asserts the GEOMETRIC predicate `labelFitsCircle` (per-line chord +
 * total-height budget) swept over every integer diameter in
 * [ORB_MIN_DIAMETER (56) .. ORB_MAX_DIAMETER (112)], plus the center inner width.
 *
 * `CHAR_WIDTH_FACTOR` is imported (not re-declared) so the test shares the exact
 * char-advance proxy the heuristic uses — one source of truth, no drift.
 */

const FACE_PAD = config.show.ORB_LABEL_FACE_PADDING_PX;
const LINE_HEIGHT_FACTOR = config.show.ORB_LABEL_LINE_HEIGHT_FACTOR;
const PERCENT_LINE_PX = config.show.ORB_LABEL_PERCENT_LINE_PX;

/** The center-node inner content width: ORB_CENTER_DIAMETER (116) minus the 12px
 *  `p-3` padding on each side (see CenterNode.tsx) — how the component fits its label. */
const CENTER_INNER_PX = config.show.ORB_CENTER_DIAMETER - 12 * 2; // 92

const orbOpts = {
  baseFontPx: config.show.ORB_LABEL_BASE_FONT_PX,
  minFontPx: config.show.ORB_LABEL_MIN_FONT_PX,
  maxLines: config.show.ORB_LABEL_MAX_LINES,
  lineHeightFactor: LINE_HEIGHT_FACTOR,
  reservedHeightPx: PERCENT_LINE_PX,
};

const centerOpts = {
  baseFontPx: config.show.ORB_LABEL_BASE_FONT_PX_CENTER,
  minFontPx: config.show.ORB_LABEL_MIN_FONT_PX_CENTER,
  maxLines: config.show.ORB_LABEL_MAX_LINES_CENTER,
  lineHeightFactor: LINE_HEIGHT_FACTOR,
  reservedHeightPx: 0,
};

/** Every real catalog song name shipped in the bundled matrix. */
const songNames: readonly string[] = matrix.nodes.map((n) => n.songName);

/** The known 44-char outlier — the only name allowed to ellipsize at the 56px floor. */
const OUTLIER = "(You Gotta) Fight for Your Right (To Party!)";

describe("fitOrbLabel over the real 264-node @matrix catalog (POLISH-01 circular fit)", () => {
  it("shares the heuristic's own CHAR_WIDTH_FACTOR (single source, no drift)", () => {
    expect(CHAR_WIDTH_FACTOR).toBeGreaterThan(0);
  });

  it("bundles the full 264-song catalog", () => {
    expect(songNames.length).toBe(264);
    expect(songNames).toContain(OUTLIER);
  });

  it("fits every real name INSIDE the circular orb across the swept diameter [56..112] (no overflow, no ellipsis)", () => {
    const failures: string[] = [];
    for (let d = config.show.ORB_MIN_DIAMETER; d <= config.show.ORB_MAX_DIAMETER; d += 1) {
      const contentD = d - 2 * FACE_PAD;
      for (const name of songNames) {
        // Sole documented exemption: the 44-char outlier may ellipsize ONLY at the
        // absolute d = 56 floor (verified on-device; never a silent real-name failure).
        if (d === config.show.ORB_MIN_DIAMETER && name === OUTLIER) continue;
        const result = fitOrbLabel(name, contentD, orbOpts);
        const fits = labelFitsCircle(result, contentD, {
          lineHeightFactor: LINE_HEIGHT_FACTOR,
          reservedHeightPx: PERCENT_LINE_PX,
        });
        if (!fits || result.ellipsized) {
          failures.push(
            `d=${d} ${JSON.stringify(name)} fits=${fits} ellipsized=${result.ellipsized} lines=${result.lines.length} font=${result.fontPx}`,
          );
        }
      }
    }
    // Slice keeps the assertion diff readable when it fails (RED); [] == all fit (GREEN).
    expect(failures.slice(0, 25)).toEqual([]);
  });

  it("fits every real name INSIDE the center-node circle at the inner width (reserved = 0)", () => {
    const failures: string[] = [];
    for (const name of songNames) {
      const result = fitOrbLabel(name, CENTER_INNER_PX, centerOpts);
      const fits = labelFitsCircle(result, CENTER_INNER_PX, {
        lineHeightFactor: LINE_HEIGHT_FACTOR,
        reservedHeightPx: 0,
      });
      if (!fits || result.ellipsized) {
        failures.push(
          `${JSON.stringify(name)} fits=${fits} ellipsized=${result.ellipsized} lines=${result.lines.length} font=${result.fontPx}`,
        );
      }
    }
    expect(failures.slice(0, 25)).toEqual([]);
  });

  it("at the absolute ORB_MIN_DIAMETER floor, at most the 44-char outlier ellipsizes (documented safety-net case)", () => {
    const contentD = config.show.ORB_MIN_DIAMETER - 2 * FACE_PAD;
    const ellipsized = songNames.filter(
      (name) => fitOrbLabel(name, contentD, orbOpts).ellipsized,
    );
    expect(ellipsized.length).toBeLessThanOrEqual(1);
    for (const name of ellipsized) {
      expect(name).toBe(OUTLIER);
    }
  });
});

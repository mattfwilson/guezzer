import { describe, expect, it } from "vitest";
import matrix from "@matrix";
import { fitOrbLabel } from "../src/show/orbLabelFit.ts";
import { config } from "../src/config.ts";

/**
 * POLISH-01 real-catalog lock (plan 08-06). The pure fixture pins in
 * `orbLabelFit.test.ts` guard the wrap/shrink/ellipsis BOUNDARIES with synthetic
 * inputs; THIS test guards the actual bar — every real song name in the bundled
 * 264-node `@matrix` artifact must render fully (no ellipsis) at the REALISTIC
 * minimum rendered orb diameter and at the center-node inner width.
 *
 * The heuristic self-report drifts optimistic (RESEARCH §Orb-Label Legibility,
 * three drift sources), so the retune is deliberately conservative
 * (`CHAR_WIDTH_FACTOR` ≥ 0.55) and paired with an extra wrap line + a lower 10px
 * legibility floor. On-device confirmation of these same 264 names is Task 2's
 * `#/dev/orb-fit` harness (real `scrollWidth/scrollHeight` measurement).
 */

/**
 * RESEARCH assumption A1: the realistic MINIMUM rendered prediction-orb diameter.
 * The ring solver grows orbs toward ORB_MAX_DIAMETER (112); ORB_MIN_DIAMETER (56)
 * is the absolute floor only reached in the tightest stages, so 64px is the
 * realistic small-phone minimum used as the zero-ellipsis bar.
 */
const REALISTIC_MIN_ORB_PX = 64;

/**
 * The center-node inner content width: ORB_CENTER_DIAMETER (116) minus the 12px
 * `p-3` padding on each side (see CenterNode.tsx), matching how the component
 * actually fits its label.
 */
const CENTER_INNER_PX = config.show.ORB_CENTER_DIAMETER - 12 * 2; // 92

const orbOpts = {
  baseFontPx: config.show.ORB_LABEL_BASE_FONT_PX,
  minFontPx: config.show.ORB_LABEL_MIN_FONT_PX,
  maxLines: config.show.ORB_LABEL_MAX_LINES,
};

const centerOpts = {
  baseFontPx: config.show.ORB_LABEL_BASE_FONT_PX_CENTER,
  minFontPx: config.show.ORB_LABEL_MIN_FONT_PX_CENTER,
  maxLines: config.show.ORB_LABEL_MAX_LINES_CENTER,
};

/** Every real catalog song name shipped in the bundled matrix. */
const songNames: readonly string[] = matrix.nodes.map((n) => n.songName);

/** The known 44-char outlier — the only name allowed to ellipsize at the 56px floor. */
const OUTLIER = "(You Gotta) Fight for Your Right (To Party!)";

describe("fitOrbLabel over the real 264-node @matrix catalog (POLISH-01)", () => {
  it("bundles the full 264-song catalog", () => {
    expect(songNames.length).toBe(264);
    expect(songNames).toContain(OUTLIER);
  });

  it("renders every real name fully (no ellipsis) at the realistic min orb diameter", () => {
    const ellipsized = songNames.filter(
      (name) => fitOrbLabel(name, REALISTIC_MIN_ORB_PX, orbOpts).ellipsized,
    );
    expect(ellipsized).toEqual([]);
  });

  it("renders every real name fully (no ellipsis) at the center-node inner width", () => {
    const ellipsized = songNames.filter(
      (name) => fitOrbLabel(name, CENTER_INNER_PX, centerOpts).ellipsized,
    );
    expect(ellipsized).toEqual([]);
  });

  it("keeps the ellipsis fallback UNREACHABLE for real names at realistic sizes (safety net only)", () => {
    // Every real name resolves to a font at/above the documented 10px floor with
    // no clipped line — the ellipsis branch never fires for the real catalog.
    for (const name of songNames) {
      const orb = fitOrbLabel(name, REALISTIC_MIN_ORB_PX, orbOpts);
      expect(orb.ellipsized).toBe(false);
      expect(orb.fontPx).toBeGreaterThanOrEqual(config.show.ORB_LABEL_MIN_FONT_PX);
      expect(orb.lines.length).toBeLessThanOrEqual(config.show.ORB_LABEL_MAX_LINES);
    }
  });

  it("at the absolute ORB_MIN_DIAMETER floor, at most the 44-char outlier ellipsizes (documented safety-net case)", () => {
    const ellipsizedAtFloor = songNames.filter(
      (name) => fitOrbLabel(name, config.show.ORB_MIN_DIAMETER, orbOpts).ellipsized,
    );
    // The safety net may only ever fire for the single longest title, verified
    // on-device (Task 2) — never a silent real-name failure.
    expect(ellipsizedAtFloor.length).toBeLessThanOrEqual(1);
    for (const name of ellipsizedAtFloor) {
      expect(name).toBe(OUTLIER);
    }
  });
});

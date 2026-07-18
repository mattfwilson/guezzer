import { describe, expect, it } from "vitest";
import {
  fadeToward,
  lerp,
  mixColor,
  parseColor,
} from "../../src/explore/depthColor.ts";

/**
 * Guards spike-001 bug #1: the depth draw pass feeds BOTH `#RRGGBB` (tuningColor)
 * AND `rgb(r,g,b)` (grayscaleOf / already-faded) strings into the color blend. The
 * old hex-only helper parsed `rgb(...)` into NaN and threw
 * `addColorStop('rgb(NaN, …)')`. parseColor must accept both formats and NEVER
 * yield NaN.
 */
describe("parseColor (spike bug #1 — format-agnostic, never NaN)", () => {
  it("parses #RRGGBB hex", () => {
    expect(parseColor("#22C55E")).toEqual({ r: 0x22, g: 0xc5, b: 0x5e });
  });

  it("parses shorthand #RGB hex", () => {
    expect(parseColor("#0AF")).toEqual({ r: 0x00, g: 0xaa, b: 0xff });
  });

  it("parses rgb(r, g, b) — the format grayscaleOf/fadeToward emit", () => {
    expect(parseColor("rgb(145, 145, 145)")).toEqual({ r: 145, g: 145, b: 145 });
  });

  it("parses rgba(r, g, b, a) tolerantly (first three channels)", () => {
    expect(parseColor("rgba(12, 34, 56, 0.5)")).toEqual({ r: 12, g: 34, b: 56 });
  });

  it("never yields NaN for either format (the spike bug root cause)", () => {
    for (const s of ["#0C0C10", "rgb(0, 145, 191)", "#FFFFFF", "rgb(255,255,255)"]) {
      const { r, g, b } = parseColor(s);
      expect(Number.isNaN(r)).toBe(false);
      expect(Number.isNaN(g)).toBe(false);
      expect(Number.isNaN(b)).toBe(false);
    }
  });
});

describe("mixColor / fadeToward (format-agnostic blend, no NaN)", () => {
  it("t=0 returns the source color as rgb()", () => {
    expect(mixColor("#000000", "#FFFFFF", 0)).toBe("rgb(0, 0, 0)");
  });

  it("t=1 returns the target color as rgb()", () => {
    expect(mixColor("#000000", "#FFFFFF", 1)).toBe("rgb(255, 255, 255)");
  });

  it("t=0.5 is the midpoint", () => {
    expect(mixColor("#000000", "#FFFFFF", 0.5)).toBe("rgb(128, 128, 128)");
  });

  it("blends an rgb() source (fadeToward toward the surface) with no NaN", () => {
    // grayscaleOf-style rgb input faded toward the surface #0C0C10 — spike bug path.
    const out = fadeToward("rgb(191, 145, 145)", "#0C0C10", 0.55);
    expect(out).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    expect(out).not.toContain("NaN");
  });
});

describe("lerp (depth scalar interpolation)", () => {
  it("interpolates endpoints and midpoint", () => {
    expect(lerp(0.7, 1.25, 0)).toBe(0.7);
    expect(lerp(0.7, 1.25, 1)).toBe(1.25);
    expect(lerp(0.6, 1, 0.5)).toBeCloseTo(0.8, 10);
  });
});

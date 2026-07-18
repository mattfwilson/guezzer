/**
 * Format-agnostic color + depth helpers for the constellation depth draw pass
 * (quick task 260717-ual, Tier-1 spherical shading + depth-scaling). Pure — no
 * React/DOM state, no canvas ctx except `sphereGradient` (which only calls the 2D
 * context's `createRadialGradient`) — so the blend/scalar math is unit-testable in
 * isolation (the spike-001 bug #1 lived exactly here).
 *
 * Spike bug #1: the depth pass produces BOTH `#RRGGBB` (tuningColor) AND
 * `rgb(r,g,b)` (grayscaleOf / already-faded) color strings, then blends them. The
 * old hex-only parser turned `rgb(...)` into NaN and threw
 * `addColorStop('rgb(NaN, …)')`. `parseColor` here accepts BOTH formats and never
 * yields NaN, so `mixColor`/`fadeToward`/`sphereGradient` are safe on either input.
 *
 * All gradient/shape tunables come from `config.explore` (single-config ethos,
 * CLAUDE.md) — no magic numbers here.
 */
import { config } from "../config.ts";

export interface RGB {
  r: number;
  g: number;
  b: number;
}

const clamp255 = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));

/** `rgb(r, g, b)` string from an RGB triple, channels clamped to [0,255] ints. */
export function rgbString({ r, g, b }: RGB): string {
  return `rgb(${clamp255(r)}, ${clamp255(g)}, ${clamp255(b)})`;
}

/**
 * Parse `#RRGGBB`, `#RGB`, `rgb(r,g,b)`, or `rgba(r,g,b,a)` into an RGB triple.
 * NEVER returns NaN (spike bug #1): unrecognized input falls back to black. The
 * two formats the draw pass actually feeds are `#hex` (tuningColor) and `rgb()`
 * (grayscaleOf / fadeToward output).
 */
export function parseColor(str: string): RGB {
  const s = str.trim();
  if (s.startsWith("#")) {
    let h = s.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length !== 6) return { r: 0, g: 0, b: 0 };
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
      return { r: 0, g: 0, b: 0 };
    }
    return { r, g, b };
  }
  // rgb(...) / rgba(...) — pull the first three numeric channels.
  const nums = s.match(/-?\d+(?:\.\d+)?/g);
  if (nums && nums.length >= 3) {
    return { r: Number(nums[0]), g: Number(nums[1]), b: Number(nums[2]) };
  }
  return { r: 0, g: 0, b: 0 };
}

/** Linear scalar interpolation, `t` unclamped (callers pass 0..1). */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Blend two colors (either format) by `t` (0 = `a`, 1 = `b`), returning an
 * `rgb()` string. Format-agnostic via `parseColor`, so it never emits NaN.
 */
export function mixColor(a: string, b: string, t: number): string {
  const ca = parseColor(a);
  const cb = parseColor(b);
  return rgbString({
    r: lerp(ca.r, cb.r, t),
    g: lerp(ca.g, cb.g, t),
    b: lerp(ca.b, cb.b, t),
  });
}

/** Fade `color` toward `target` by `t` (alias of `mixColor`, intent-named). */
export function fadeToward(color: string, target: string, t: number): string {
  return mixColor(color, target, t);
}

const WHITE = "#FFFFFF";
const BLACK = "#000000";

/**
 * Build a spherical-shading radial gradient for an orb: an offset highlight
 * (base → white) in the upper-left, the base color at mid, and a shadow
 * (base → black) at the rim — so a flat disc reads as a lit ball. Works on hex
 * AND rgb() bases identically (via `parseColor` inside `fadeToward`). Gradient
 * shape/lighten/darken come from `config.explore` (no magic numbers).
 */
export function sphereGradient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  baseColor: string,
): CanvasGradient {
  const {
    GRAD_HIGHLIGHT_OFFSET,
    GRAD_HIGHLIGHT_LIGHTEN,
    GRAD_SHADOW_DARKEN,
  } = config.explore.depth;
  const highlight = fadeToward(baseColor, WHITE, GRAD_HIGHLIGHT_LIGHTEN);
  const shadow = fadeToward(baseColor, BLACK, GRAD_SHADOW_DARKEN);
  const off = r * GRAD_HIGHLIGHT_OFFSET;
  // Inner (highlight) circle offset toward the upper-left light source; outer
  // circle is the full orb. r*0.05 inner radius keeps a soft hot spot, not a point.
  const grad = ctx.createRadialGradient(
    x - off,
    y - off,
    r * 0.05,
    x,
    y,
    r,
  );
  grad.addColorStop(0, highlight);
  grad.addColorStop(0.5, baseColor);
  grad.addColorStop(1, shadow);
  return grad;
}

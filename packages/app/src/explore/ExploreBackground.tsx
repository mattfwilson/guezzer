/**
 * GizzVerse (Explore) ambient galaxy backdrop (quick task 260717-sjg). A purely
 * decorative, non-interactive layer that paints a subtle deep-space nebula BEHIND
 * the constellation canvas — replacing the flat #0C0C10 with soft, slowly-drifting
 * radial-gradient blooms plus a faint static star-speck field, so the sky reads as
 * ambient depth. The owner's locked MVP is a DOM/CSS layer (todo Option 1), NOT the
 * canvas `onRenderFramePre` route (Option 2 remains a documented future escalation).
 *
 * The analog it mirrors is `show/ShowBackground.tsx`: an `aria-hidden` +
 * `pointer-events-none` + `absolute inset-0` decorative layer whose tunables all
 * come from a single `config` sub-block. Here that block is
 * `config.explore.background` (single-config rule — no magic numbers here or in CSS).
 *
 * Contract:
 *  - `aria-hidden` + `pointer-events-none`: invisible to AT and hit-testing, so it
 *    NEVER intercepts the canvas's d3-zoom pan/zoom/tap gestures.
 *  - `absolute inset-0`: fills its positioned parent (ConstellationCanvas's wrapper).
 *  - Paints ONLY translucent blooms + specks over transparency — no opaque base fill;
 *    the wrapper's `bg-surface` (#0C0C10) stays the opaque base so the focus-dim /
 *    Dex-dim overlays read against #0C0C10 and nothing white-flashes.
 *  - No effects, no per-frame JS. The speck field is generated ONCE per mount
 *    (`useMemo`, non-deterministic by design so each visit's sky differs); drift +
 *    breathe are pure CSS on a compositor layer, gated behind
 *    `prefers-reduced-motion: no-preference` in styles.css (STATIC by default) and
 *    never touch/reheat the d3 sim (EXPL-06).
 *  - CSS gradients only — no external images (offline-safe).
 */
import { useMemo, type CSSProperties } from "react";
import { config } from "../config.ts";

const {
  blooms,
  BLUR_PX,
  PULSE_SCALE,
  PULSE_OPACITY,
  SPECK_OPACITY,
  SPECK_COUNT,
  SPECK_BRIGHTNESS_MIN,
  SPECK_BRIGHTNESS_MAX,
  SPECK_SIZE_MIN_PX,
  SPECK_SIZE_MAX_PX,
} = config.explore.background;

/** `#RRGGBB` → `rgba(r, g, b, a)` so a bloom's gradient can fade color→transparent. */
function rgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Uniform pick in [min, max]. */
const lerp = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * Build the faint star-speck field: `SPECK_COUNT` tiny radial-gradient dots at RANDOM
 * viewport positions (non-tiled — one full-size layer per dot positioned via `at X% Y%`,
 * `background-repeat: no-repeat`), each with its own randomized brightness (alpha) and
 * diameter so the field twinkles in intensity rather than reading as a uniform grid.
 * Generated once per mount (see `useMemo` below) — decorative, not animated, so it stays
 * cheap; the "alive" motion is carried by the blooms only.
 */
function buildSpeckStyle(): CSSProperties {
  const layers: string[] = [];
  for (let i = 0; i < SPECK_COUNT; i++) {
    const x = (Math.random() * 100).toFixed(2);
    const y = (Math.random() * 100).toFixed(2);
    const size = lerp(SPECK_SIZE_MIN_PX, SPECK_SIZE_MAX_PX).toFixed(2);
    const alpha = lerp(SPECK_BRIGHTNESS_MIN, SPECK_BRIGHTNESS_MAX).toFixed(2);
    layers.push(
      `radial-gradient(${size}px ${size}px at ${x}% ${y}%, rgba(255, 255, 255, ${alpha}) 45%, transparent 50%)`,
    );
  }
  return {
    opacity: SPECK_OPACITY,
    backgroundImage: layers.join(", "),
    backgroundRepeat: "no-repeat",
  };
}

export function ExploreBackground() {
  // Fresh random speck field per mount (stable across re-renders so specks never
  // jump; different each visit for an "alive" sky). No RNG in render — memoized once.
  const speckStyle = useMemo(buildSpeckStyle, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {blooms.map((b, i) => (
        <div
          // Static deterministic list; index key is stable and safe here.
          key={i}
          className="explore-bg-bloom absolute"
          style={
            {
              // Center the bloom on its normalized (x, y) via left/top + negative
              // margins (NOT transform) so the drift keyframe's transform is free.
              left: `${b.x * 100}%`,
              top: `${b.y * 100}%`,
              width: `${b.sizeVmin}vmin`,
              height: `${b.sizeVmin}vmin`,
              marginLeft: `${-b.sizeVmin / 2}vmin`,
              marginTop: `${-b.sizeVmin / 2}vmin`,
              background: `radial-gradient(circle, ${rgba(b.color, b.opacity)} 0%, transparent 70%)`,
              filter: `blur(${BLUR_PX}px)`,
              // Per-bloom drift vector / period / phase-offset fed to the keyframe
              // (mirrors ShowBackground's --show-bg-crossfade-ms inline-prop idiom).
              "--explore-bg-drift-x": `${b.driftXPct}%`,
              "--explore-bg-drift-y": `${b.driftYPct}%`,
              "--explore-bg-drift-ms": `${b.driftMs}ms`,
              "--explore-bg-drift-delay": `${b.delayMs}ms`,
              "--explore-bg-pulse-scale": String(PULSE_SCALE),
              "--explore-bg-pulse-opacity": String(PULSE_OPACITY),
            } as CSSProperties
          }
        />
      ))}
      <div className="absolute inset-0" style={speckStyle} />
    </div>
  );
}

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
 *  - No state, no effects, no per-frame JS. Drift/pulse is pure CSS on a compositor
 *    layer, gated behind `prefers-reduced-motion: no-preference` in styles.css
 *    (STATIC by default) and never touches/reheats the d3 sim (EXPL-06).
 *  - CSS gradients only — no external images (offline-safe).
 */
import { type CSSProperties } from "react";
import { config } from "../config.ts";

const { blooms, BLUR_PX, PULSE_SCALE, SPECK_OPACITY } = config.explore.background;

/** `#RRGGBB` → `rgba(r, g, b, a)` so a bloom's gradient can fade color→transparent. */
function rgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Faint static star-speck field: a handful of tiny radial-gradient dots tiled with
 * `background-repeat`. The dot layout is decorative pattern design (like the keyframe
 * geometry), while the tunable — overall speck opacity — comes from config. NOT
 * animated: the drift is carried by the blooms only, keeping this layer cheap.
 */
const SPECK_TILE_PX = 260;
const speckStyle: CSSProperties = {
  opacity: SPECK_OPACITY,
  backgroundImage: [
    "radial-gradient(1.4px 1.4px at 18% 22%, #ffffff 45%, transparent 50%)",
    "radial-gradient(1px 1px at 62% 12%, #ffffff 45%, transparent 50%)",
    "radial-gradient(1.2px 1.2px at 82% 46%, #ffffff 45%, transparent 50%)",
    "radial-gradient(1px 1px at 34% 64%, #ffffff 45%, transparent 50%)",
    "radial-gradient(1.3px 1.3px at 72% 82%, #ffffff 45%, transparent 50%)",
    "radial-gradient(1px 1px at 12% 88%, #ffffff 45%, transparent 50%)",
  ].join(", "),
  backgroundRepeat: "repeat",
  backgroundSize: `${SPECK_TILE_PX}px ${SPECK_TILE_PX}px`,
};

export function ExploreBackground() {
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
            } as CSSProperties
          }
        />
      ))}
      <div className="absolute inset-0" style={speckStyle} />
    </div>
  );
}

/**
 * LiveGizz ambient page background (quick task 260717-02n POLISH; crossfade added
 * 260717-gvm). A decorative, non-interactive layer that renders a bundled album
 * cover heavily blurred and dark-dimmed behind the Show page body — replacing the
 * flat surface color so the page feels visual while the orbit, header, buttons,
 * and text stay legible.
 *
 * Crossfade (260717-gvm): when `coverUrl` changes — because a new next song was
 * selected — the incoming cover fades in over the settled one, then is promoted
 * to the new settled layer. Two React state values drive this: `base` (the
 * underneath, settled cover) and `incoming` (the cover fading in, or null).
 * Promotion happens on the CSS animation end AND via a CROSSFADE_MS timeout
 * fallback, so under prefers-reduced-motion (where no animation fires and the
 * incoming layer's default opacity:1 makes it appear instantly) the layers still
 * settle. Identical-URL re-renders are no-ops (guarded), so there is no
 * re-render loop (T-gvm-01).
 *
 * Contract (unchanged from the static version):
 *  - `coverUrl` null with no settled cover yet → renders nothing (plain surface).
 *  - a null / art-less selection never clears an already-shown cover (ShowView
 *    holds the last real cover; this component only ever swaps to a non-null URL).
 *  - `aria-hidden` + `pointer-events-none`: invisible to AT and hit-testing.
 *  - `absolute inset-0`: fills its positioned parent (ShowView's page frame).
 *
 * Blur radius, dim opacity, and crossfade duration all come from
 * `config.show.background` (single-config rule).
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { config } from "../config.ts";

interface ShowBackgroundProps {
  /** Bundled cover URL to render, or null → render nothing (plain surface). */
  coverUrl: string | null;
}

const { BLUR_PX, DIM_OPACITY, CROSSFADE_MS } = config.show.background;

/** One blurred, edge-scaled cover layer (shared styling for base + incoming). */
const coverLayerStyle = {
  filter: `blur(${BLUR_PX}px)`,
  transform: "scale(1.2)",
} as const;

export function ShowBackground({ coverUrl }: ShowBackgroundProps) {
  // `base` = the settled cover underneath; `incoming` = the cover fading in.
  const [base, setBase] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<string | null>(null);

  // Latest committed layers, read inside the coverUrl effect without making them
  // effect deps (the effect must fire only on a coverUrl change, never on the
  // promotion re-renders it triggers — that would be the T-gvm-01 loop).
  const baseRef = useRef(base);
  baseRef.current = base;
  const incomingRef = useRef(incoming);
  incomingRef.current = incoming;

  useEffect(() => {
    if (coverUrl == null) return;
    // Guard: only start a fade for a genuinely new cover (no identical-URL loop).
    if (coverUrl === baseRef.current || coverUrl === incomingRef.current) return;
    setIncoming(coverUrl);
    // Reduced-motion fallback: no CSS animation fires, so promote on a timer too.
    const timer = setTimeout(() => {
      setBase(coverUrl);
      setIncoming((cur) => (cur === coverUrl ? null : cur));
    }, CROSSFADE_MS);
    return () => clearTimeout(timer);
  }, [coverUrl]);

  // Nothing settled and nothing arriving → plain surface (unchanged first-load).
  if (base == null && incoming == null) return null;

  const showIncoming = incoming != null && incoming !== base;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {base != null && (
        <img
          src={base}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={coverLayerStyle}
        />
      )}
      {showIncoming && (
        <img
          key={incoming}
          src={incoming}
          alt=""
          className="show-bg-fade-layer absolute inset-0 h-full w-full object-cover"
          style={
            {
              ...coverLayerStyle,
              "--show-bg-crossfade-ms": `${CROSSFADE_MS}ms`,
            } as CSSProperties
          }
          onAnimationEnd={() => {
            setBase(incoming);
            setIncoming((cur) => (cur === incoming ? null : cur));
          }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: `rgba(12, 12, 16, ${DIM_OPACITY})` }}
      />
    </div>
  );
}

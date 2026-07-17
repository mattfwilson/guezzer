/**
 * The current-song node at the centre of the orbit (04-UI-SPEC §Layout region 3,
 * Component Inventory). Presentational only. Tuning-family colored, Heading-size
 * name, NO percentage. A fixed CIRCLE (owner 2026-07-17), not a stadium pill, and
 * once a song is playing it PULSES — a slow living/breathing scale (`.orb-breathe`
 * in styles.css, motion-safe). Before the opener is seeded it shows the static
 * "Search for the opener" prompt circle (config.copy.show.centerPrompt).
 */
import type { TuningFamily } from "@guezzer/core";
import { config } from "../config.ts";
import { fitOrbLabel } from "./orbLabelFit.ts";
import { ORB_TEXT_COLOR, tuningColor } from "./tuningColor.ts";

interface CenterNodeProps {
  /** Current song name, or null before the opener is seeded. */
  songName: string | null;
  /** Tuning family for the ring/fill color; null falls back to muted. */
  tuningFamily: TuningFamily | null;
  /** Pre-opener only: tapping the prompt opens the catalog Search to seed the opener (SHOW-04). */
  onOpenSearch?: () => void;
}

export function CenterNode({ songName, tuningFamily, onOpenSearch }: CenterNodeProps) {
  const diameter = config.show.ORB_CENTER_DIAMETER;

  if (songName == null) {
    // Pre-opener: the prompt IS the search affordance — tapping opens the catalog
    // SearchSheet so the user selects the opener (same seed path as the FAB). A
    // dashed circle, NOT pulsing (no song is playing yet).
    return (
      <button
        type="button"
        onClick={onOpenSearch}
        aria-label={config.copy.show.centerPrompt}
        style={{ width: diameter, height: diameter }}
        className="flex items-center justify-center rounded-full border border-dashed border-hairline p-3 text-center touch-manipulation"
      >
        <span className="text-[14px] font-semibold leading-tight text-text-muted">
          {config.copy.show.centerPrompt}
        </span>
      </button>
    );
  }

  const fill = tuningColor(tuningFamily);

  // D-21: wrap + scale-to-fit the full current-song name to the center floor
  // before ellipsis, sized to the circle's own diameter.
  const fit = fitOrbLabel(songName, diameter, {
    baseFontPx: config.show.ORB_LABEL_BASE_FONT_PX_CENTER,
    minFontPx: config.show.ORB_LABEL_MIN_FONT_PX_CENTER,
    maxLines: config.show.ORB_LABEL_MAX_LINES_CENTER,
  });

  return (
    // A living/breathing pulse + emanating ripple (owner 2026-07-17) so the
    // playing song reads as alive. Both are CSS loops disabled under
    // prefers-reduced-motion (styles.css). The two ripple rings are offset by
    // half the period for a steady pulse and sit BEHIND the orb.
    <div
      className="relative flex items-center justify-center"
      style={{ width: diameter, height: diameter }}
    >
      <span
        aria-hidden="true"
        className="orb-ripple pointer-events-none absolute inset-0 rounded-full border-2"
        style={{ borderColor: fill }}
      />
      <span
        aria-hidden="true"
        className="orb-ripple pointer-events-none absolute inset-0 rounded-full border-2"
        style={{ borderColor: fill, ["--ripple-delay"]: "1300ms" } as React.CSSProperties}
      />
      <div
        style={{ width: diameter, height: diameter, backgroundColor: fill, color: ORB_TEXT_COLOR }}
        className="orb-breathe relative flex select-none items-center justify-center rounded-full p-3 text-center"
      >
        <span
          className="flex max-w-full flex-col items-center font-semibold leading-tight"
          style={{ fontSize: fit.fontPx }}
        >
          {fit.lines.map((line, i) => (
            <span key={i} className="max-w-full">
              {line}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

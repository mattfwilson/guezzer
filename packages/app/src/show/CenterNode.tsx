/**
 * The current-song node at the centre of the orbit (04-UI-SPEC §Layout region 3,
 * Component Inventory). Presentational only. Tuning-family colored, Heading-size
 * name, NO percentage. Before the opener is seeded (no current song) it shows the
 * "Tap the opener" prompt state (config.copy.show.centerPrompt).
 */
import type { TuningFamily } from "@guezzer/core";
import { config } from "../config.ts";
import { fitOrbLabel } from "./orbLabelFit.ts";
import { ORB_TEXT_COLOR, tuningColor } from "./tuningColor.ts";

/** Existing center Heading role size (04-UI-SPEC §Typography) — the fit base font. */
const CENTER_LABEL_BASE_FONT_PX = 20;

interface CenterNodeProps {
  /** Current song name, or null before the opener is seeded. */
  songName: string | null;
  /** Tuning family for the ring/fill color; null falls back to muted. */
  tuningFamily: TuningFamily | null;
}

export function CenterNode({ songName, tuningFamily }: CenterNodeProps) {
  if (songName == null) {
    return (
      <div className="flex min-h-11 max-w-[70%] items-center justify-center rounded-full border border-dashed border-hairline px-6 py-4 text-center">
        <span className="text-[20px] font-semibold leading-tight text-text-muted">
          {config.copy.show.centerPrompt}
        </span>
      </div>
    );
  }

  const fill = tuningColor(tuningFamily);

  // D-21: wrap + scale-to-fit the full current-song name to the center floor
  // (3 lines / 14px) before ellipsis, using the nominal center-pill width budget.
  const fit = fitOrbLabel(songName, config.show.ORB_LABEL_CENTER_WIDTH_PX, {
    baseFontPx: CENTER_LABEL_BASE_FONT_PX,
    minFontPx: config.show.ORB_LABEL_MIN_FONT_PX_CENTER,
    maxLines: config.show.ORB_LABEL_MAX_LINES_CENTER,
  });

  return (
    <div
      className="flex min-h-11 max-w-[70%] select-none items-center justify-center rounded-full px-6 py-4 text-center"
      style={{ backgroundColor: fill, color: ORB_TEXT_COLOR }}
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
  );
}

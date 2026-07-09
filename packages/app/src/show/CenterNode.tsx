/**
 * The current-song node at the centre of the orbit (04-UI-SPEC §Layout region 3,
 * Component Inventory). Presentational only. Tuning-family colored, Heading-size
 * name, NO percentage. Before the opener is seeded (no current song) it shows the
 * "Tap the opener" prompt state (config.copy.show.centerPrompt).
 */
import type { TuningFamily } from "@guezzer/core";
import { config } from "../config.ts";
import { ORB_TEXT_COLOR, tuningColor } from "./tuningColor.ts";

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

  return (
    <div
      className="flex min-h-11 max-w-[70%] select-none items-center justify-center rounded-full px-6 py-4 text-center"
      style={{ backgroundColor: fill, color: ORB_TEXT_COLOR }}
    >
      <span className="max-w-full truncate text-[20px] font-semibold leading-tight">
        {songName}
      </span>
    </div>
  );
}

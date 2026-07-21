/**
 * Phase-16 (BINGO-02, D-10/D-11/D-12) pre-lock fill / difficulty meter. A pure
 * presentational readout of the core `estimateFill` output: a `bg-elevated` track
 * with a fill bar sized to `fillFraction`, the honest "~N/15" expected-fillable
 * figure, and the both-odds caption "Line {line} · blackout: {blackout}". It
 * GUIDES, never blocks (D-12) — nothing here disables Start Show; below the
 * likely-line threshold the bar turns amber (`#F59E0B`, never red) and a quiet
 * non-blocking note appears. GamesView owns the memo and re-feeds a fresh
 * estimate on every swap/reshuffle, so the meter tracks the current draft card.
 *
 * All copy is read from `config.copy.games.bingo` (no hardcoded strings); numeric
 * figures use `tabular-nums`. Colors are the shipped data-semantic hexes
 * (16-UI-SPEC §Color): healthy green `#22C55E`, soft-warning amber `#F59E0B`.
 */
import type { FillEstimate } from "@guezzer/core";
import { config } from "../config.ts";

/** Fill-meter data colors (16-UI-SPEC §Color) — semantic, not accent chrome. */
const BAR_HEALTHY = "#22C55E";
const BAR_AMBER = "#F59E0B";
const TRACK_BG = "#17171F";

interface FillMeterProps {
  /** The core pre-lock difficulty estimate (GamesView owns the `estimateFill` memo). */
  estimate: FillEstimate;
}

export function FillMeter({ estimate }: FillMeterProps) {
  const copy = config.copy.games.bingo;

  // Amber whenever a line is not "likely" — i.e. expected fill sits below the
  // likely-line threshold (16-UI-SPEC §Color / D-12: a quiet guide, never red).
  const isAmber = estimate.lineLikelihood !== "likely";
  const barColor = isAmber ? BAR_AMBER : BAR_HEALTHY;

  // Bar width from the fill fraction (free cell included); clamped to [0,100]%.
  const widthPct = Math.max(0, Math.min(100, Math.round(estimate.fillFraction * 100)));

  // Honest "~N/15" figure: expected marks EXCLUDING the always-marked free cell,
  // out of the 15 fillable squares (config copy denominator).
  const fillableMarks = Math.max(0, Math.round(estimate.expectedMarks - 1));

  const caption = copy.fillMeterCaption(
    copy.lineBandLabels[estimate.lineLikelihood],
    copy.blackoutBandLabels[estimate.blackoutLikelihood],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[14px] leading-tight text-text-muted">{caption}</span>
        <span className="text-[14px] font-semibold tabular-nums text-text-primary">
          {copy.expectedMarksFormat(fillableMarks)}
        </span>
      </div>

      {/* Track + fill bar. The bar color is the sole amber/green signal; the caption
          + warning note carry the same information as text (never color-only). */}
      <div
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: TRACK_BG }}
        role="progressbar"
        aria-valuenow={fillableMarks}
        aria-valuemin={0}
        aria-valuemax={15}
        aria-label={caption}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${widthPct}%`, backgroundColor: barColor }}
        />
      </div>

      {isAmber && (
        <p className="text-[14px] leading-tight" style={{ color: BAR_AMBER }}>
          {copy.fillMeterAmberWarning}
        </p>
      )}
    </div>
  );
}

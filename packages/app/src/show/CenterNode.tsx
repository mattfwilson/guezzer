/**
 * The current-song node at the centre of the orbit (04-UI-SPEC §Layout region 3,
 * Component Inventory). Presentational only. RARITY-TIER colored (quick
 * 260717-p4s, via `rarityColor`/`rarityTierForSong` — no longer tuning family),
 * Heading-size name, NO percentage. A fixed CIRCLE (owner 2026-07-17), not a stadium pill, and
 * once a song is playing it PULSES — a slow living/breathing scale (`.orb-breathe`
 * in styles.css, motion-safe). Before the opener is seeded it shows the "Search
 * for the opener" prompt (config.copy.show.centerPrompt) — the screen's primary
 * CTA, so it's a LARGER accent-filled circle that also PULSES (`.orb-breathe`) to
 * draw the eye; tapping it opens the catalog Search to seed the opener.
 */
import type { TuningFamily } from "@guezzer/core";
import { config } from "../config.ts";
import { fitOrbLabel } from "./orbLabelFit.ts";
import { RARITY_ORB_TEXT_COLOR, rarityColor, rarityTierForSong } from "../dex/rarityStyle.ts";

interface CenterNodeProps {
  /** Current song name, or null before the opener is seeded. */
  songName: string | null;
  /** Current song id — drives the RARITY-TIER fill/ring color; null → debut gray. */
  songId: number | null;
  /** Tuning family (kept for now; no longer used for color, quick 260717-p4s). */
  tuningFamily?: TuningFamily | null;
  /** Pre-opener only: tapping the prompt opens the catalog Search to seed the opener (SHOW-04). */
  onOpenSearch?: () => void;
}

export function CenterNode({ songName, songId, onOpenSearch }: CenterNodeProps) {
  const diameter = config.show.ORB_CENTER_DIAMETER;

  if (songName == null) {
    // Pre-opener: the prompt IS the search affordance — tapping opens the catalog
    // SearchSheet so the user selects the opener (same seed path as the FAB). As the
    // screen's primary CTA it's a LARGER accent-filled circle that PULSES
    // (`.orb-breathe`, motion-safe) to draw the eye.
    const promptDiameter = config.show.ORB_PROMPT_DIAMETER;
    return (
      <button
        type="button"
        onClick={onOpenSearch}
        aria-label={config.copy.show.centerPrompt}
        style={{ width: promptDiameter, height: promptDiameter }}
        className="orb-breathe flex items-center justify-center rounded-full bg-accent p-4 text-center text-surface touch-manipulation"
      >
        <span className="text-[14px] font-semibold leading-tight">
          {config.copy.show.centerPrompt}
        </span>
      </button>
    );
  }

  const fill = rarityColor(rarityTierForSong(songId));

  // D-21: wrap + scale-to-fit the full current-song name. Fit against the padded
  // CONTENT width (the circle's `p-3` = 12px inset each side), not the raw
  // diameter, so the chosen font genuinely fits inside the orb — otherwise long
  // one-word titles are sized too large and spill past the padding. The label also
  // hard-breaks such words (fitOrbLabel) + `break-words` below as a CSS backstop.
  const CENTER_LABEL_PADDING_PX = 12; // matches the `p-3` on the orb below
  const fit = fitOrbLabel(songName, diameter - CENTER_LABEL_PADDING_PX * 2, {
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
        style={{ width: diameter, height: diameter, backgroundColor: fill, color: RARITY_ORB_TEXT_COLOR }}
        className="orb-breathe relative flex select-none items-center justify-center rounded-full p-3 text-center"
      >
        <span
          className="flex max-w-full flex-col items-center font-semibold leading-tight"
          style={{ fontSize: fit.fontPx }}
        >
          {fit.lines.map((line, i) => (
            <span key={i} className="max-w-full break-words">
              {line}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

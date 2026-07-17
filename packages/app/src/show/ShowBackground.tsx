/**
 * LiveGizz ambient page background (quick task 260717-02n, POLISH). A decorative,
 * non-interactive layer that renders a bundled album cover heavily blurred and
 * dark-dimmed behind the LiveGizz (Show) page body — replacing the flat surface
 * color so the page feels visual while the orbit, header, buttons, and text stay
 * legible.
 *
 * Contract:
 *  - `coverUrl` null (no covers bundled / not yet picked) → renders nothing, so
 *    the page falls back to the plain `bg-surface`. Never a broken image.
 *  - `aria-hidden` + `pointer-events-none`: invisible to AT and to hit-testing —
 *    the orbit/FAB/sheets above it are unaffected.
 *  - `absolute inset-0`: fills its positioned parent (ShowView's page frame), NOT
 *    the app chrome — the AppShell header and BottomTabBar keep their own bg.
 *
 * Blur radius + dim opacity come from `config.show.background` (single-config
 * rule). The 160×160 WebP thumbs are low-res, but heavy blur turns that into a
 * smooth wash; they're bundled + SW-precached, so this works fully offline.
 */
import { config } from "../config.ts";

interface ShowBackgroundProps {
  /** Bundled cover URL to render, or null → render nothing (plain surface). */
  coverUrl: string | null;
}

export function ShowBackground({ coverUrl }: ShowBackgroundProps) {
  if (coverUrl == null) return null;
  const { BLUR_PX, DIM_OPACITY } = config.show.background;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <img
        src={coverUrl}
        alt=""
        className="h-full w-full object-cover"
        // scale past the edges so the blur doesn't reveal a soft transparent border
        style={{ filter: `blur(${BLUR_PX}px)`, transform: "scale(1.2)" }}
      />
      <div
        className="absolute inset-0"
        style={{ backgroundColor: `rgba(12, 12, 16, ${DIM_OPACITY})` }}
      />
    </div>
  );
}

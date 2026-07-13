/**
 * The quiet online/offline indicator (D-08, 05-UI-SPEC §Color B3). A passive
 * 8px status glyph — NOT a control — placed in the Show header next to the
 * tally/date. Expressed entirely with inherited tokens (zero new colors):
 *
 *   - Online / poller healthy → a FILLED `#A1A1AA` (text-muted) dot.
 *   - Offline / paused        → a HOLLOW 1px `#A1A1AA` ring, transparent fill.
 *
 * Never uses hit-green, miss-red, or accent-gold (B3 rationale — the venue UI
 * stays calm; connectivity is unremarkable, not alarming). The `#A1A1AA`-on-
 * `#17171F` dot clears the ≥3:1 graphical-contrast floor (WCAG 1.4.11). Carries
 * an `aria-label` reflecting online/offline for assistive tech; the one-time
 * offline reassurance LINE is rendered by ShowView, never here (no banner, D-08).
 */
import { config } from "../config.ts";

interface SyncDotProps {
  /** From `useOnlineStatus()` — filled when true, hollow ring when false. */
  online: boolean;
}

const MUTED = "#A1A1AA"; // 05-UI-SPEC §Color: text-muted, the ONLY color used here

export function SyncDot({ online }: SyncDotProps) {
  const diameter = config.ui.SYNC_DOT_DIAMETER;
  return (
    <span
      role="status"
      aria-label={online ? "Sync: online" : "Sync: offline"}
      className="inline-block shrink-0 rounded-full"
      style={{
        width: diameter,
        height: diameter,
        // Filled online; a 1px ring with transparent fill offline (D-08).
        backgroundColor: online ? MUTED : "transparent",
        boxShadow: online ? undefined : `inset 0 0 0 1px ${MUTED}`,
      }}
    />
  );
}

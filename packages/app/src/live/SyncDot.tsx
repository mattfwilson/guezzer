/**
 * The quiet online/offline indicator (D-08, 05-UI-SPEC §Layout). A passive
 * 8px status glyph — NOT a control — placed in the Show header next to the
 * tally/date:
 *
 *   - Online / poller healthy → a FILLED `#22C55E` (hit-green) dot.
 *   - Offline / paused        → a HOLLOW 1px `#A1A1AA` (text-muted) ring.
 *
 * OWNER OVERRIDE of 05-UI-SPEC §Color B3 (2026-07-14, quick task 260713-w1c):
 * B3 originally restricted this dot to text-muted only ("connectivity is
 * unremarkable"). The owner explicitly requested a green online state so
 * connectivity reads at a glance during a show. `#22C55E` is the SAME
 * hit-green already used by CometTrail's hit rings — no new color token was
 * minted; green now signals both "hit" and "online". Never uses miss-red or
 * accent-gold. Both colors clear the ≥3:1 graphical-contrast floor against
 * `#17171F` (WCAG 1.4.11). Carries an `aria-label` reflecting online/offline
 * for assistive tech; the one-time offline reassurance LINE is rendered by
 * ShowView, never here (no banner, D-08).
 */
import { config } from "../config.ts";

interface SyncDotProps {
  /** From `useOnlineStatus()` — filled green when true, hollow ring when false. */
  online: boolean;
}

const ONLINE_GREEN = "#22C55E"; // hit-green (CometTrail.tsx) — owner-approved B3 override
const MUTED = "#A1A1AA"; // text-muted — the offline ring color

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
        // Filled green online; a 1px muted ring with transparent fill offline (D-08).
        backgroundColor: online ? ONLINE_GREEN : "transparent",
        boxShadow: online ? undefined : `inset 0 0 0 1px ${MUTED}`,
      }}
    />
  );
}

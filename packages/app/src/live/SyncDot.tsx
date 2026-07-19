/**
 * The quiet online/offline indicator (D-08, 05-UI-SPEC §Layout). A passive
 * 8px status glyph — NOT a control — placed in the Show header next to the
 * tally/date:
 *
 *   - Online / poller healthy → a FILLED `#22C55E` (hit-green) dot.
 *   - Offline / paused        → a HOLLOW 1px `#A1A1AA` (text-muted) ring.
 *   - Schema drift (LIVE-03)  → a FILLED `#F59E0B` (amber) dot that IS tappable
 *                               for a key-names-only detail (see below).
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
 *
 * LIVE-03 amber drift state (11-04, D-06/D-08): when the last poll saw an
 * additive kglw.net API key, `pollLatest` sets `schemaDrift` and the app threads
 * it here. The dot goes a distinct amber, gains a distinct `aria-label`, and
 * becomes tap-for-detail — the ONLY interactive SyncDot state. Non-blocking by
 * construction: it is a self-contained inline popover, never a modal/banner, and
 * logging is wholly independent of this render (T-11-04-02). The detail shows
 * novel key NAMES only, never editor content (T-11-04-01) — React JSX escaping,
 * no `dangerouslySetInnerHTML`.
 */
import { useState } from "react";
import { config } from "../config.ts";

interface SyncDotProps {
  /** From `useOnlineStatus()` — filled green when true, hollow ring when false. */
  online: boolean;
  /**
   * LIVE-03: true when the most recent poll carried an additive API key. Takes
   * visual precedence over online/offline (a shape change is the more useful
   * signal to surface). NEVER blocks logging (non-modal).
   */
  schemaDrift?: boolean;
  /** Novel API key NAMES only (never editor values) — shown in the tap detail. */
  novelKeys?: string[];
}

const ONLINE_GREEN = "#22C55E"; // hit-green (CometTrail.tsx) — owner-approved B3 override
const MUTED = "#A1A1AA"; // text-muted — the offline ring color
/**
 * DRIFT_AMBER: the LIVE-03 schema-drift token — a calm amber distinct from both
 * hit-green and the muted offline ring, and deliberately NOT accent-gold or
 * miss-red so it reads as "info", not "error". `#F59E0B` clears the WCAG 1.4.11
 * ≥3:1 graphical-object contrast floor against the darkest page surface
 * `#0C0C10` (≈8.9:1) and against the header `#17171F` it actually sits on
 * (≈7.9:1) — matching the file's existing token-contrast discipline.
 */
const DRIFT_AMBER = "#F59E0B";

export function SyncDot({ online, schemaDrift = false, novelKeys }: SyncDotProps) {
  const diameter = config.ui.SYNC_DOT_DIAMETER;
  const [detailOpen, setDetailOpen] = useState(false);

  // LIVE-03 amber state (11-04): a distinct, tappable, non-modal drift signal.
  if (schemaDrift) {
    return (
      <span className="relative inline-flex items-center">
        <button
          type="button"
          role="status"
          aria-label="Sync: API shape changed"
          aria-expanded={detailOpen}
          onClick={() => setDetailOpen((open) => !open)}
          // Negative-margin padding gives a comfortable tap target around the
          // 8px glyph without shifting the header layout (the visual dot is
          // unchanged size).
          className="-m-2 inline-flex shrink-0 items-center justify-center rounded-full p-2"
        >
          <span
            className="inline-block rounded-full"
            style={{ width: diameter, height: diameter, backgroundColor: DRIFT_AMBER }}
          />
        </button>
        {detailOpen && (
          // Self-contained inline popover — NOT a modal/banner (T-11-04-02).
          // Key NAMES only via JSX escaping; never editor values (T-11-04-01).
          <span
            role="tooltip"
            className="absolute right-0 top-full mt-2 max-w-[70vw] whitespace-normal rounded border border-hairline bg-elevated px-2 py-1 text-[12px] leading-tight text-text-muted shadow-lg"
            style={{ zIndex: config.ui.z.toast }}
          >
            {config.copy.live.schemaDriftDetail(novelKeys ?? [])}
          </span>
        )}
      </span>
    );
  }

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

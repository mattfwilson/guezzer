/**
 * IdentityAvatar (Plan 18-05, AUTH-03/04/07 · D-12/D-13/D-14). The signed-in
 * user's presence in the header: a deterministic color+initials glyph that, on
 * tap, opens a bottom sheet showing their full `display_name` and a neutral
 * (non-destructive) "Sign out" control for handing a shared device to another
 * Gizz friend.
 *
 * Color (AUTH-07 / D-13): the fill is `config.auth.IDENTITY_COLORS` indexed by
 * the pure-core `identityColorIndex(userId, len)` — stable across devices from
 * the Supabase user id, and the reusable primitive for Phase 19 friend rows +
 * Phase 20 presence dots. Initials ALWAYS render in `#0C0C10` (the ORB_TEXT
 * dark-on-light pairing) — identity is never color alone (D-12).
 *
 * Sign-out (D-04/D-09/D-10): the control is neutral chrome, NOT destructive-red
 * — sign-out is not data-destructive (D-09 keeps the prior identity's rows). The
 * handler calls `supabase.auth.signOut()` then `clearIdentityRecord()`; the gate
 * re-render/teardown is Plan 06. A stale token is never a "logged out" message —
 * that calm state is the SyncDot amber (D-07), not this component.
 *
 * All rendered strings (display_name / initials) are escaped React text — never
 * `dangerouslySetInnerHTML` (threat T-18-05-V5, ASVS V5).
 */
import { useState } from "react";
import { identityColorIndex } from "@guezzer/core";
import { Sheet } from "../components/Sheet.tsx";
import { config } from "../config.ts";
import { supabase } from "../db/supabase.ts";
import { clearIdentityRecord, markUserSignOut } from "./identityRecord.ts";
import { useAuthIdentity } from "./useAuthIdentity.ts";

/** Dark-on-light initials color — reuses ORB_TEXT_COLOR (D-12); ≥4.5:1 on every palette hue. */
const INITIALS_COLOR = "#0C0C10";

/** 1–2 uppercase initials from the display name (first letter of the first 1–2 words). */
function initialsOf(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const chars = words.slice(0, 2).map((w) => [...w][0] ?? "");
  return chars.join("").toUpperCase();
}

export function IdentityAvatar() {
  const identity = useAuthIdentity();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Signed out → render nothing (the boot gate shows the sign-in surface).
  if (identity === null) return null;

  const { userId, displayName } = identity;
  const fill = config.auth.IDENTITY_COLORS[identityColorIndex(userId, config.auth.IDENTITY_COLORS.length)];
  const initials = initialsOf(displayName);

  async function handleSignOut() {
    // Neutral hand-off, not a destructive wipe (D-09): clear the session +
    // app-owned record only. Gate teardown/re-render is Plan 06.
    //
    // Flag the explicit user intent BEFORE signOut (WR-01): supabase-js's
    // resulting SIGNED_OUT event reaches the AuthGate reconciler, which clears
    // the identity ONLY when this flag is set — distinguishing this deliberate
    // hand-off from a background token-refresh-failure SIGNED_OUT.
    markUserSignOut();
    await supabase.auth.signOut();
    clearIdentityRecord();
    setSheetOpen(false);
  }

  const glyph = (
    <span
      className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold leading-none"
      style={{ backgroundColor: fill, color: INITIALS_COLOR }}
    >
      {initials}
    </span>
  );

  return (
    <>
      <button
        type="button"
        aria-label={`Account: ${displayName}`}
        onClick={() => setSheetOpen(true)}
        // Mirror the SyncDot negative-margin idiom: a 44px tap target around the
        // 32px glyph without shifting the header layout.
        className="-m-1.5 flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full p-1.5"
      >
        {glyph}
      </button>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} ariaLabel={`Account: ${displayName}`}>
        <div className="flex items-center gap-3">
          {glyph}
          <h2 className="text-[20px] font-semibold leading-tight">{displayName}</h2>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="mt-4 min-h-11 w-full rounded-xl border border-hairline px-4 text-text-primary"
        >
          {config.copy.auth.signOut}
        </button>
        <p className="mt-2 text-center text-[13px] leading-tight text-text-muted">
          {config.copy.auth.signOutSubline}
        </p>
      </Sheet>
    </>
  );
}

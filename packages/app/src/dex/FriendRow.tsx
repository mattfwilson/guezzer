/**
 * FriendRow (Phase 19, PROG-04 · D-04/D-05/D-19) — one friend's headline progress
 * as a ≥44px tap row, ECHOING the shipped `ShowsList` row `<button>` (min-h-11,
 * touch-manipulation, tabular-nums, trailing ChevronRight) and the `IdentityAvatar`
 * deterministic color+initials glyph — WITHOUT importing/altering either (D-09).
 *
 * Phase-20 fusion (PRES-07, hard constraint): the row deliberately reserves an
 * empty LEADING slot (the future online dot) and an empty TRAILING slot (the future
 * coarse activity label) so presence drops in without a rebuild. NO presence/online
 * logic is implemented here — the slots render nothing this phase.
 *
 * The friend `displayName` + the resolved song names are untrusted (Supabase-synced
 * / kglw-derived): rendered as escaped React text only, `truncate`/`min-w-0` clamped,
 * never `dangerouslySetInnerHTML` (D-19 / T-19-xss). Set arithmetic upstream is
 * songId-only. When `dimmed` (offline last-known view, D-18) the row is muted via
 * opacity — never removed, never a spinner.
 */
import type { RarityTier } from "@guezzer/core";
import { identityColorIndex } from "@guezzer/core";
import { ChevronRight } from "lucide-react";
import { config } from "../config.ts";
import { TierBadge } from "./TierBadge.tsx";

/** Dark-on-light initials color — reuses ORB_TEXT_COLOR / IdentityAvatar (D-12). */
const INITIALS_COLOR = "#0C0C10";

/** 1–2 uppercase initials — echoes IdentityAvatar's `initialsOf` (never imported). */
function initialsOf(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const chars = words.slice(0, 2).map((w) => [...w][0] ?? "");
  return chars.join("").toUpperCase();
}

interface IdentityGlyphProps {
  userId: string;
  displayName: string;
}

/**
 * The 32px deterministic identity glyph (AUTH-07 / D-12) — fill from
 * `identityColorIndex(userId, len)` (stable per user across devices), initials
 * always in `#0C0C10` (identity is never color alone). Echoes `IdentityAvatar`'s
 * glyph markup verbatim; shared by FriendRow + SelfRow. NOT imported from
 * IdentityAvatar (that component owns the header account sheet, not a list glyph).
 */
export function IdentityGlyph({ userId, displayName }: IdentityGlyphProps) {
  const fill =
    config.auth.IDENTITY_COLORS[
      identityColorIndex(userId, config.auth.IDENTITY_COLORS.length)
    ];
  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold leading-none"
      style={{ backgroundColor: fill, color: INITIALS_COLOR }}
    >
      {initialsOf(displayName)}
    </span>
  );
}

interface FriendRowProps {
  userId: string;
  displayName: string;
  /** Completion percentage (0–100). */
  pct: number;
  /** Songs caught (completion numerator). */
  caught: number;
  /** The friend's single rarest caught tier, or null for a 0-catch friend (D-05). */
  rarest: RarityTier | null;
  /** Offline last-known view (D-18): mute via opacity, never remove the row. */
  dimmed?: boolean;
  onClick: () => void;
}

export function FriendRow({
  userId,
  displayName,
  pct,
  caught,
  rarest,
  dimmed = false,
  onClick,
}: FriendRowProps) {
  const copy = config.copy.friends;
  return (
    <button
      type="button"
      data-testid="friend-row"
      onClick={onClick}
      className={`flex min-h-11 items-center gap-2 border-b border-hairline px-4 py-3 text-left touch-manipulation ${
        dimmed ? "opacity-50" : ""
      }`}
    >
      {/* LEADING SLOT — reserved for the Phase-20 online presence dot (PRES-07).
          Renders nothing this phase; keeps the structural slot so presence fuses
          in without a rebuild. NO presence logic here. */}
      <span data-slot="presence-online" aria-hidden="true" className="shrink-0" />

      <IdentityGlyph userId={userId} displayName={displayName} />

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base leading-normal text-text-primary">
          {displayName}
        </span>
        <span className="text-[14px] leading-tight tabular-nums text-text-muted">
          {copy.pct(pct)} · {copy.caught(caught)}
        </span>
      </span>

      {/* Single rarest tier badge (D-04) — omitted for a 0-catch friend (D-05). */}
      {rarest != null && <TierBadge tier={rarest} />}

      {/* TRAILING SLOT — reserved for the Phase-20 coarse activity label (PRES-07).
          Renders nothing this phase. NO presence logic here. */}
      <span data-slot="presence-activity" aria-hidden="true" className="shrink-0" />

      <ChevronRight size={18} className="shrink-0 text-text-muted" aria-hidden="true" />
    </button>
  );
}

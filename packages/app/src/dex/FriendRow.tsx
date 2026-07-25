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
import type { Activity } from "../sync/presenceActivity.ts";
import { TierBadge } from "./TierBadge.tsx";

/** Dark-on-light initials color — reuses ORB_TEXT_COLOR / IdentityAvatar (D-12). */
const INITIALS_COLOR = "#0C0C10";

/**
 * The shipped SyncDot online-green (`SyncDot.tsx:55`, owner-ratified B3 override).
 * The 8px presence dot reuses this EXACT hue — it is the app's "connected/online"
 * language (data-semantic, never routed through --color-accent). UI-SPEC §Color.
 */
const ONLINE_GREEN = "#22C55E";

/**
 * Fill the reserved `presence-online` slot: an 8px `#22C55E` `rounded-full` dot
 * when `online`, otherwise nothing (D-16 — honest absence, never a stale-green
 * lie). Shared by FriendRow + SelfRow so both dots are byte-identical.
 */
export function PresenceOnlineSlot({ online }: { online: boolean }) {
  return (
    <span data-slot="presence-online" className="flex shrink-0 items-center justify-center">
      {online && (
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: ONLINE_GREEN }}
          aria-hidden="true"
        />
      )}
    </span>
  );
}

/**
 * Resolve a peer's (or our own) coarse presence activity to its DISPLAY label in
 * the presence voice (NAV-03, D-39/D-40/D-41). Pure — exported for test.
 *
 * NAMED NAV-03 FALLBACK PLACEMENT: option (ii), the RENDER-PATH fallback.
 * `reduceActivity`'s `TABS` allow-list in `sync/presenceActivity.ts` is a real
 * input-validation control over untrusted peer presence payloads (ASVS V5) — it
 * stays exactly as shipped, still dropping unknown tokens at the read boundary.
 * Relaxing that control to fix a *display* problem would trade a security
 * property for a cosmetic one, so the fallback lives here instead.
 *
 * The label is ALWAYS a constant string chosen by our own map — the `??` arm is
 * `activityUnknown`, never `?? activity.tab`. No peer-supplied text ever reaches
 * the DOM through this slot (T-21-06).
 *
 * Resolution order:
 *  1. `atShow` → `At a show 🎸` (the shipped precedence — it wins over the tab).
 *  2. a known token → its presence-voice label; an UNKNOWN token (a newer build
 *     sent a tab this build doesn't have) → the constant fallback.
 *  3. no activity but the friend IS online → `in the app` (D-41 — never blank).
 *  4. otherwise → `null` (an offline friend keeps today's empty slot).
 */
export function presenceActivityLabel(
  activity: Activity | null | undefined,
  online: boolean,
): string | null {
  const presence = config.copy.presence;
  if (activity?.atShow === true) return presence.atShow;
  if (activity != null) {
    // Index-then-fallback: the ?? arm is a CONSTANT, never the raw token.
    return presence.activity[activity.tab] ?? presence.activityUnknown;
  }
  if (online) return presence.activityUnknown;
  return null;
}

/**
 * Fill the reserved `presence-activity` slot with the coarse activity label:
 * `null` → nothing; `atShow` → `At a show 🎸` in `text-text-primary` (the
 * residency payoff emphasis, D-03 flag-only); else the token's presence-voice
 * label looked up in `config.copy.presence.activity` (muted), with the constant
 * `in the app` fallback for an online friend whose activity can't be resolved
 * (D-41). The dot NEVER conveys state by color alone — a present friend's row
 * shows BOTH the dot and this text label (WCAG 1.4.1). Shared by FriendRow +
 * SelfRow. `offline` is passed as an explicit `label`/`emphasized` override.
 */
export function PresenceActivitySlot({
  activity,
  label,
  emphasized = false,
  online = false,
}: {
  activity?: Activity | null;
  label?: string;
  emphasized?: boolean;
  /** Binary present-now — drives the D-41 "in the app" never-blank fallback. */
  online?: boolean;
}) {
  // An explicit label override (the self-row `offline` case) wins.
  const text = label ?? presenceActivityLabel(activity, online);
  const strong = label != null ? emphasized : activity?.atShow === true;
  return (
    <span data-slot="presence-activity" className="shrink-0">
      {text != null && (
        <span
          className={`text-[13px] leading-tight ${strong ? "text-text-primary" : "text-text-muted"}`}
        >
          {text}
        </span>
      )}
    </span>
  );
}

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
  /** Phase-20 presence: binary present-now (fills the leading dot slot, PRES-07). */
  online: boolean;
  /** Phase-20 presence: coarse activity for the trailing label slot, or null. */
  activity: Activity | null;
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
  online,
  activity,
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
      {/* LEADING SLOT — the Phase-20 online presence dot (PRES-07). Pure props:
          an 8px #22C55E dot when online, nothing when offline. NO channel logic. */}
      <PresenceOnlineSlot online={online} />

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

      {/* TRAILING SLOT — the Phase-20 coarse activity label (PRES-07). Pure props:
          `At a show 🎸` (emphasized) / the token's presence-voice label (muted) /
          `in the app` when online but unresolvable (D-41) / nothing when offline.
          NO channel logic. */}
      <PresenceActivitySlot activity={activity} online={online} />

      <ChevronRight size={18} className="shrink-0 text-text-muted" aria-hidden="true" />
    </button>
  );
}

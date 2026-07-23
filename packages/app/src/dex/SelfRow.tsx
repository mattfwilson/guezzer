/**
 * SelfRow (Phase 19, PROG-04 · D-02/D-06) — the pinned "You" row atop the Friends
 * list. It ECHOES `FriendRow`'s shape but is sourced from the LIVE local dex
 * (`useDexStats`) + local identity (`useAuthIdentity`), NOT the Supabase read path —
 * so it is always current and fully offline-safe, and is NEVER dimmed by the offline
 * marker (D-02). Tapping it opens the OWN trophy case (rarest-catches showcase only,
 * no head-to-head columns — D-06); the caller owns that overlay.
 *
 * The glyph reuses the shared `IdentityGlyph` (echo of `IdentityAvatar`) keyed by
 * the real signed-in identity, while the visible label is the fixed `You` string —
 * a plain escaped literal, no untrusted text. Holds a calm frame (renders nothing)
 * until the live dex resolves, so it never flashes NaN.
 */
import { ChevronRight } from "lucide-react";
import { config } from "../config.ts";
import { useAuthIdentity } from "../auth/useAuthIdentity.ts";
import { IdentityGlyph } from "./FriendRow.tsx";
import { TierBadge } from "./TierBadge.tsx";
import { useDexStats } from "./useDexStats.ts";

interface SelfRowProps {
  /** Open the own trophy case (rarest showcase only, no compare — D-06). */
  onClick: () => void;
}

export function SelfRow({ onClick }: SelfRowProps) {
  const copy = config.copy.friends;
  const identity = useAuthIdentity();
  const stats = useDexStats();

  // Hold a calm frame until the live reads resolve (no NaN, no flicker). The
  // AuthGate guarantees an identity whenever this renders in-app.
  if (identity == null || !stats.ready || stats.dex == null) {
    return <div data-testid="self-row-loading" aria-hidden="true" className="min-h-11" />;
  }

  const { caught, pct } = stats.dex.completion;
  const rarest = stats.dex.rarestCatch?.tier ?? null;

  return (
    <button
      type="button"
      data-testid="self-row"
      onClick={onClick}
      className="flex min-h-11 items-center gap-2 border-b border-hairline px-4 py-3 text-left touch-manipulation"
    >
      {/* Leading slot — parity with FriendRow (no presence dot for the self row). */}
      <span data-slot="presence-online" aria-hidden="true" className="shrink-0" />

      <IdentityGlyph userId={identity.userId} displayName={identity.displayName} />

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base leading-normal text-text-primary">
          {copy.selfRow}
        </span>
        <span className="text-[14px] leading-tight tabular-nums text-text-muted">
          {copy.pct(pct)} · {copy.caught(caught)}
        </span>
      </span>

      {rarest != null && <TierBadge tier={rarest} />}

      <span data-slot="presence-activity" aria-hidden="true" className="shrink-0" />

      <ChevronRight size={18} className="shrink-0 text-text-muted" aria-hidden="true" />
    </button>
  );
}

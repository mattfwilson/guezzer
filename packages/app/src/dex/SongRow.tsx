/**
 * One informational song row in the album detail (06-06, D-05/D-06/D-08,
 * STAT-03/04). Three derived states — ALL display-only: there is NO toggle
 * affordance, no onClick, no db import anywhere (D-05: seen/unseen is pure
 * derivation, never mutated from a row). Song titles are kglw-derived, rendered
 * as React text only.
 *
 *   1. Caught — green Check + name + "Seen {n}× · last {Mon YYYY} · {g} of your
 *      shows ago" (gap 0 → "· last show") + rarity TierBadge.
 *   2. Unseen but has live history — hollow circle + dimmed name + "Played
 *      {playCount}× all-time" (honest corpus stat, no personal fake) + TierBadge.
 *   3. Debut candidate (inMatrix false) — dimmed + "Debut candidate" badge, NO
 *      tier, NO percentage, "Never played live — no odds to fake." (STAT-04).
 */
import type { AlbumTrack, SongDexStats, SongRarity } from "@guezzer/core";
import { Check } from "lucide-react";
import { config } from "../config.ts";
import { formatMonYear } from "./formatMonYear.ts";
import { TierBadge } from "./TierBadge.tsx";

/** hit-green (§B2) — the caught success semantic, reused, not re-derived. */
const CAUGHT_GREEN = "#22C55E";

interface SongRowProps {
  track: AlbumTrack;
  /** Derived per-song stats when caught, else undefined. */
  songStats: SongDexStats | undefined;
  /** Corpus rarity when the song has live history, else undefined. */
  rarity: SongRarity | undefined;
}

export function SongRow({ track, songStats, rarity }: SongRowProps) {
  const copy = config.copy.dex;
  const caught = songStats != null && songStats.sightings > 0;
  const isDebut = !track.inMatrix;

  const subline = (() => {
    if (caught) {
      const mon = songStats.lastSeenDate != null ? formatMonYear(songStats.lastSeenDate) : "";
      const gap = songStats.personalGap ?? 0;
      return gap === 0
        ? copy.songSeenLastShow(songStats.sightings)
        : copy.songSeenCaught(songStats.sightings, mon, gap);
    }
    if (isDebut) return copy.debutDetail;
    return copy.songPlayedAllTime(rarity?.playCount ?? 0);
  })();

  return (
    <div className="flex min-h-11 items-center gap-2 border-b border-hairline px-4 py-2">
      {/* Leading state slot: green check (caught) or hollow circle (unseen/debut). */}
      {caught ? (
        <Check size={18} color={CAUGHT_GREEN} aria-hidden="true" className="shrink-0" />
      ) : (
        <span
          aria-hidden="true"
          className="h-[18px] w-[18px] shrink-0 rounded-full border border-hairline"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={`truncate text-base leading-normal ${
            caught ? "text-text-primary" : "text-text-muted"
          }`}
        >
          {track.title}
        </span>
        <span className="text-[14px] font-semibold leading-tight tabular-nums text-text-muted">
          {subline}
        </span>
      </div>

      {/* Trailing badge: rarity tier (caught/unseen) or the debut pill (STAT-04). */}
      {isDebut ? (
        <TierBadge tier="debut" />
      ) : (
        rarity != null && <TierBadge tier={rarity.tier} />
      )}
    </div>
  );
}

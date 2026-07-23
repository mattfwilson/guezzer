/**
 * RarestShowcase (Phase 19, PROG-08 · D-06/D-10/D-19) — the top-N rarest catches
 * trophy strip, shared by `FriendDetail` (a friend's catches) and the "You" trophy
 * case (own catches, D-06). It ECHOES `DexHeader`'s rarest-subline idiom (resolve
 * name from `archive.songs[String(id)]`, render name as React text + `<TierBadge>`)
 * and extends it to a list, reusing `TierBadge`/`rarityStyle` VERBATIM — no bespoke
 * tier colors.
 *
 * Context-agnostic: `heading` + the data (`caughtSongIds`, `rarity`, `archive`) are
 * props, so the same component serves both surfaces. It runs pure-core
 * `selectRarestCaught(caughtSongIds, rarity, config.friends.showcaseCount)` — the
 * SAME rarest-first ordering the compare diff lists use — and renders up to
 * `showcaseCount` (5) entries. Untrusted song names render as escaped React text,
 * `truncate`/`min-w-0` clamped, never `dangerouslySetInnerHTML` (D-19). Set/selection
 * arithmetic is songId-only. Empty (0-catch) → the calm `No catches yet` copy.
 */
import type { ArchiveArtifact, RarityIndex } from "@guezzer/core";
import { selectRarestCaught } from "@guezzer/core";
import { config } from "../config.ts";
import { TierBadge } from "./TierBadge.tsx";

interface RarestShowcaseProps {
  /** Section heading — a friend's (`{name}'s rarest catches`) or own (`Your rarest catches`). */
  heading: string;
  /** The caught set (songId-only identity, D-19). */
  caughtSongIds: number[];
  /** The LOCAL rarity index — tiers are a pure fn of the shared static corpus (D-13). */
  rarity: RarityIndex;
  /** For song-name resolution only (display, never identity). */
  archive: ArchiveArtifact;
}

export function RarestShowcase({ heading, caughtSongIds, rarity, archive }: RarestShowcaseProps) {
  const copy = config.copy.friends;
  const rarest = selectRarestCaught(caughtSongIds, rarity, config.friends.showcaseCount);
  const nameOf = (songId: number): string => archive.songs[String(songId)] ?? `#${songId}`;

  return (
    <section className="flex flex-col gap-2 px-4">
      <h3 className="text-[20px] font-semibold leading-tight text-text-primary">{heading}</h3>
      {rarest.length === 0 ? (
        <p className="text-base leading-normal text-text-muted">{copy.rarestEmpty}</p>
      ) : (
        <ul className="flex flex-col">
          {rarest.map(({ songId, tier }) => (
            <li
              key={songId}
              className="flex min-h-11 items-center gap-2 border-b border-hairline py-2"
            >
              <span className="min-w-0 flex-1 truncate text-base leading-normal text-text-primary">
                {nameOf(songId)}
              </span>
              <TierBadge tier={tier} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The album drill-in (06-06, §Layout 1.4). A full-screen overlay WITHIN #/dex
 * (SearchSheet dialog idiom — role="dialog" aria-modal, component state, no new
 * hash route): header (cover + album name + tally + ≥44px back control) then the
 * track-ordered informational song list. Every row is a display-only SongRow —
 * no toggle affordance exists anywhere (D-05). Album/song names are kglw-derived,
 * rendered as React text only (never innerHTML).
 */
import type { AlbumTrack, DexStats, RarityIndex } from "@guezzer/core";
import { ChevronLeft } from "lucide-react";
import { config } from "../config.ts";
import { CoverThumb } from "./CoverThumb.tsx";
import { SongRow } from "./SongRow.tsx";

interface AlbumDetailProps {
  /** perAlbum key: the album_url, or "miscellaneous" / "covers" for buckets. */
  albumKey: string;
  title: string;
  /** Cover-asset slug, or null for buckets → initials placeholder. */
  slug: string | null;
  tracks: AlbumTrack[];
  dex: DexStats;
  rarity: RarityIndex;
  onBack: () => void;
}

export function AlbumDetail({
  albumKey,
  title,
  slug,
  tracks,
  dex,
  rarity,
  onBack,
}: AlbumDetailProps) {
  const copy = config.copy.dex;
  const px = config.dex.ALBUM_ART_DISPLAY_PX;
  const tally = dex.perAlbum.get(albumKey) ?? { caught: 0, total: 0 };

  const ordered = [...tracks].sort((a, b) => a.position - b.position);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-30 flex flex-col overflow-y-auto bg-surface"
    >
      {/* Header row — back control + cover + name + tally. */}
      <div
        className="flex items-center gap-3 border-b border-hairline bg-elevated px-4 py-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        <button
          type="button"
          aria-label={copy.albumBack}
          onClick={onBack}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-text-muted touch-manipulation"
        >
          <ChevronLeft size={24} />
        </button>

        {/* No §B4 dimming here (drill-in header never dims); shrink-0 rides the
            passthrough so the cover never compresses next to long album titles. */}
        <CoverThumb slug={slug} title={title} px={px} dimClass="shrink-0" />

        <div className="flex min-w-0 flex-col">
          <span className="text-[20px] font-semibold leading-tight text-text-primary">
            {title}
          </span>
          <span className="text-[14px] font-semibold leading-tight tabular-nums text-text-muted">
            {tally.caught}/{tally.total}
          </span>
        </div>
      </div>

      {/* Track-ordered song rows — informational, no toggle (D-05). */}
      <div className="flex flex-col pb-16">
        {ordered.map((track) => (
          <SongRow
            key={`${track.slug}-${track.position}`}
            track={track}
            songStats={track.songId != null ? dex.perSong.get(track.songId) : undefined}
            rarity={track.songId != null ? rarity.get(track.songId) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

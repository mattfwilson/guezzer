/**
 * The album drill-in (06-06, §Layout 1.4). A full-screen overlay WITHIN #/dex
 * (SearchSheet dialog idiom — role="dialog" aria-modal, component state, no new
 * hash route): header (cover + album name + tally + ≥44px back control) then the
 * track-ordered informational song list. Every row is a display-only SongRow —
 * no toggle affordance exists anywhere (D-05). Album/song names are kglw-derived,
 * rendered as React text only (never innerHTML).
 *
 * Phase-21 FOUND-03 / D-20/D-21 — PORTALED to `document.body`. Unlike `SearchSheet`
 * and `FabMenu` (plan 21-11), this one was **not** broken: `DexView.tsx:99` renders it
 * from a plain `mx-auto flex w-full max-w-md … flex-col` wrapper with no `z-index` and
 * no `transform`, so it already competed at the top level. The portal is therefore
 * PROPHYLACTIC — it makes the D-24 invariant uniformly true and removes a latent trap:
 * adding a `z-index` to that DexView wrapper later would otherwise silently sink this
 * sheet, `ArchiveBrowser` and `SetlistView` all at once, at any tier number. No tier is
 * renumbered; the numbers were never wrong, the nesting is what can go wrong.
 *
 * D-22 — this surface stays HAND-ROLLED: no migration onto the shared `<Sheet>`
 * primitive and no adoption of its focus-trap / dismiss hooks, so Phase 22's
 * sheet-animation blast radius does not grow.
 *
 * D-23 — what a portaled node loses, audited: it never had an `.orbit-stage` /
 * `.action-bar` / `.fab-menu` ancestor (those are Show/Explore surfaces — this is
 * `#/dex`), so no gesture-suppression cascade was lost and no `gesture-guard` opt-in is
 * warranted here. It has never handled Escape (closing is the ≥44px back control), so
 * there is no tree-position-dependent handler to lose. It manages no focus of its own,
 * before or after. Nothing here read a `#app-content`-scoped style or attribute.
 */
import type { AlbumTrack, DexStats, RarityIndex } from "@guezzer/core";
import { ChevronLeft } from "lucide-react";
import { createPortal } from "react-dom";
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

  // Phase-21 FOUND-03 / D-20: SSR-and-jsdom guard, copied from `Sheet.tsx`, so the
  // portal below never touches an undefined `document`.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 flex flex-col overflow-y-auto bg-surface"
      style={{ zIndex: config.ui.z.sheet }}
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
    </div>,
    document.body,
  );
}

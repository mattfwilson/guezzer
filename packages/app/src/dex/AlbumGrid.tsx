/**
 * The discography shelf (06-06, D-01/D-02/D-06/D-07). A 2-column card grid of the
 * studio discography — sorted alphabetically by album title — with the two
 * catch-all buckets (Miscellaneous, Covers) pinned last. Each card shows the 80px
 * cover (or a generated initials placeholder — no layout shift, no broken image)
 * plus the album name and a `{caught}/{total}` tally; a fully-caught album adds a
 * hit-green check, and a zero-catch album dims its cover (40% opacity + grayscale,
 * §B4). The whole card is the tap target that drills into the album detail.
 *
 * Presentational only — every number comes from the derived `DexStats.perAlbum`;
 * album names are kglw-derived, rendered as React text (never innerHTML).
 */
import type { DexAlbumsArtifact, DexStats } from "@guezzer/core";
import { Check } from "lucide-react";
import { config } from "../config.ts";
import { CoverThumb } from "./CoverThumb.tsx";

/** hit-green (§B2) — the "caught / complete" success semantic, reused, not re-derived. */
const CAUGHT_GREEN = "#22C55E";

/** A resolved shelf entry: a card album or a bucket pseudo-card. */
interface ShelfItem {
  /** perAlbum key: the album_url, or "miscellaneous" / "covers" for buckets. */
  key: string;
  title: string;
  /** Cover-asset slug (album_url last segment), or null for buckets → initials placeholder. */
  slug: string | null;
}

interface AlbumGridProps {
  dex: DexStats;
  albums: DexAlbumsArtifact;
  onOpen: (key: string) => void;
}

/** Album-url → cover slug ("/albums/nonagon-infinity" → "nonagon-infinity"). */
function slugForAlbumUrl(albumUrl: string): string {
  return albumUrl.slice(albumUrl.lastIndexOf("/") + 1);
}

export function AlbumGrid({ dex, albums, onOpen }: AlbumGridProps) {
  const copy = config.copy.dex;

  const cards: ShelfItem[] = [...albums.albums]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((album) => ({
      key: album.albumUrl,
      title: album.title,
      slug: slugForAlbumUrl(album.albumUrl),
    }));

  // Buckets pinned last, Miscellaneous then Covers — always initials placeholders.
  const shelf: ShelfItem[] = [
    ...cards,
    { key: "miscellaneous", title: copy.bucketMiscellaneous, slug: null },
    { key: "covers", title: copy.bucketCovers, slug: null },
  ];

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2 px-4 pb-16">
      {shelf.map((item) => (
        <AlbumCard key={item.key} item={item} dex={dex} onOpen={onOpen} />
      ))}
    </div>
  );
}

interface AlbumCardProps {
  item: ShelfItem;
  dex: DexStats;
  onOpen: (key: string) => void;
}

function AlbumCard({ item, dex, onOpen }: AlbumCardProps) {
  const tally = dex.perAlbum.get(item.key) ?? { caught: 0, total: 0 };
  const complete = tally.total > 0 && tally.caught === tally.total;
  const dimmed = tally.caught === 0;
  const px = config.dex.ALBUM_ART_DISPLAY_PX;

  // §B4: zero-catch covers dim (40% opacity + grayscale) — dimmed, never hidden.
  const dimClass = dimmed ? "opacity-40 grayscale" : "";

  return (
    <button
      type="button"
      data-testid="album-card"
      data-album-title={item.title}
      data-complete={complete}
      onClick={() => onOpen(item.key)}
      className="flex min-h-11 flex-col gap-2 rounded-md border border-hairline bg-elevated p-2 text-left touch-manipulation"
    >
      <CoverThumb slug={item.slug} title={item.title} px={px} dimClass={dimClass} />

      <span className="line-clamp-2 text-[20px] font-semibold leading-tight text-text-primary">
        {item.title}
      </span>

      <span className="flex items-center gap-1 text-[14px] font-semibold leading-tight tabular-nums text-text-muted">
        {tally.caught}/{tally.total}
        {complete && <Check size={16} color={CAUGHT_GREEN} aria-hidden="true" />}
      </span>
    </button>
  );
}

/**
 * Shared cover-or-initials thumb (06-12 gap 1, UAT test 2). The SINGLE
 * img-or-placeholder block for the discography shelf (AlbumGrid) and the album
 * drill-in header (AlbumDetail) — previously duplicated in both.
 *
 * Resolution order:
 *  - `slug` null (buckets) or no committed `.webp` → `coverUrlFor` returns
 *    null → initials placeholder (D-01/A2, unchanged contract).
 *  - Committed cover → <img>; if the load FAILS (offline before the SW has the
 *    asset, eviction, corruption) the `onError` flag flips and the SAME
 *    `data-testid="album-cover"` re-renders as the initials placeholder — a
 *    broken-image "?" is never left on screen.
 *
 * Sizing stays sourced from `config.dex.ALBUM_ART_DISPLAY_PX` at the CALL
 * sites (config single-source rule) — this component only receives `px`.
 * `dimClass` is a className passthrough applied to whichever branch renders:
 * AlbumGrid passes the §B4 zero-catch dimming, AlbumDetail passes `shrink-0`
 * (flex-row header — the cover must not compress next to long album titles).
 */
import { useState } from "react";
import { coverUrlFor } from "./covers.ts";

/** Up-to-2-word uppercase initials for the placeholder (title is always non-empty). */
function initialsFor(title: string): string {
  return title
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

interface CoverThumbProps {
  /** Cover-asset slug, or null (buckets) → initials placeholder. */
  slug: string | null;
  title: string;
  /** Square edge in px — callers source config.dex.ALBUM_ART_DISPLAY_PX. */
  px: number;
  /** Extra classes for whichever branch renders (§B4 dimming, shrink-0). */
  dimClass?: string;
}

export function CoverThumb({ slug, title, px, dimClass = "" }: CoverThumbProps) {
  const [failed, setFailed] = useState(false);
  const coverUrl = slug != null ? coverUrlFor(slug) : null;

  if (coverUrl == null || failed) {
    return (
      <div
        data-testid="album-cover"
        aria-hidden="true"
        className={`flex items-center justify-center rounded border border-hairline text-[20px] font-semibold text-text-muted ${dimClass}`}
        style={{ width: px, height: px }}
      >
        {initialsFor(title)}
      </div>
    );
  }

  return (
    <img
      data-testid="album-cover"
      src={coverUrl}
      alt=""
      width={px}
      height={px}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`rounded ${dimClass}`}
      style={{ width: px, height: px }}
    />
  );
}

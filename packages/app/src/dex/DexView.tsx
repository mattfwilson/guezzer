/**
 * `#/dex` root (06-06) — the album-shelf Pokédex. Replaces the PlaceholderView
 * dex branch. Internal view state only (RESEARCH Pattern 6: the ROUTES allow-list
 * stays untouched, no routing library): an Albums | Shows segment toggle and (from
 * Task 2) an album drill-in. Every number is read from the reactive `useDexStats`
 * hook — Dexie is the single source of truth, so a mark/unmark anywhere re-derives
 * the whole shelf live (D-12 "unmark is free").
 *
 * A guarded-loader failure surfaces as a calm handled message (T-06-12), never a
 * crash. The Share-card CTA (DexHeader) arrives in 06-11; the Shows list in 06-09;
 * the retro-mark CTA in 06-08 — no dead buttons this plan.
 */
import type { AlbumTrack, DexAlbumsArtifact } from "@guezzer/core";
import { Plus } from "lucide-react";
import { useState } from "react";
import { config } from "../config.ts";
import { AlbumDetail } from "./AlbumDetail.tsx";
import { AlbumGrid } from "./AlbumGrid.tsx";
import { ArchiveBrowser } from "./ArchiveBrowser.tsx";
import { DexHeader } from "./DexHeader.tsx";
import { RecapView } from "./RecapView.tsx";
import { SetlistView } from "./SetlistView.tsx";
import { ShareCardSheet } from "./ShareCardSheet.tsx";
import { ShowsList } from "./ShowsList.tsx";
import { useDexStats } from "./useDexStats.ts";

type Segment = "albums" | "shows";

/** The Shows-segment drill-in target (D-16): a tracked recap or a retro setlist. */
type OpenShow =
  | { kind: "tracked"; sessionId: string }
  | { kind: "retro"; showId: number }
  | null;

/** A resolved open-album drill-in target (card album or bucket). */
interface OpenAlbum {
  title: string;
  slug: string | null;
  tracks: AlbumTrack[];
}

/** Resolve the perAlbum key back to its display title + cover slug + track list. */
function resolveOpenAlbum(
  key: string,
  albums: DexAlbumsArtifact,
  copy: typeof config.copy.dex,
): OpenAlbum | null {
  if (key === "covers") {
    return { title: copy.bucketCovers, slug: null, tracks: albums.buckets.covers };
  }
  if (key === "miscellaneous") {
    return { title: copy.bucketMiscellaneous, slug: null, tracks: albums.buckets.miscellaneous };
  }
  const album = albums.albums.find((a) => a.albumUrl === key);
  if (album == null) return null;
  return {
    title: album.title,
    slug: album.albumUrl.slice(album.albumUrl.lastIndexOf("/") + 1),
    tracks: album.tracks,
  };
}

export function DexView() {
  const copy = config.copy.dex;
  const archiveCopy = config.copy.archive;
  const stats = useDexStats();
  const [segment, setSegment] = useState<Segment>("albums");
  const [openAlbumKey, setOpenAlbumKey] = useState<string | null>(null);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [openShow, setOpenShow] = useState<OpenShow>(null);
  const [shareOpen, setShareOpen] = useState(false);

  // Loader-guard failure (T-06-12): a calm handled state, never a thrown crash.
  if (stats.error != null) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col px-4 pt-16 text-center">
        <p className="text-base leading-normal text-text-muted">{stats.error}</p>
      </div>
    );
  }

  // Still resolving the live reads — hold the frame (no NaN, no flicker).
  if (!stats.ready || stats.dex == null || stats.archive == null || stats.albums == null) {
    return <div className="mx-auto w-full max-w-md" aria-hidden="true" />;
  }

  const { dex, archive, albums, rarity } = stats;
  const openAlbum = openAlbumKey != null ? resolveOpenAlbum(openAlbumKey, albums, copy) : null;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col">
      <DexHeader dex={dex} archive={archive} onShare={() => setShareOpen(true)} />

      {/* Segment control — component state, not a route (no new hash routes). The
          active half is a solid accent fill (reserved accent use #4, §Color A). */}
      <div className="mx-4 mb-4 flex gap-1 rounded-md border border-hairline bg-elevated p-1">
        {(["albums", "shows"] as const).map((seg) => {
          const active = segment === seg;
          const label = seg === "albums" ? copy.segmentAlbums : copy.segmentShows;
          return (
            <button
              key={seg}
              type="button"
              aria-pressed={active}
              onClick={() => setSegment(seg)}
              className={`flex min-h-11 flex-1 items-center justify-center rounded text-[14px] font-semibold touch-manipulation ${
                active ? "bg-accent text-surface" : "text-text-muted"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {segment === "albums" ? (
        // Always render the full shelf — AlbumGrid dims zero-catch covers (§B4),
        // so an empty dex reads as a "collection to fill", not a barren empty
        // state. The Mark-attended CTA is Shows-only (it lived in the old empty
        // branch); no CTA on Albums.
        <AlbumGrid dex={dex} albums={albums} onOpen={setOpenAlbumKey} />
      ) : (
        <div className="flex flex-col">
          {/* Shows segment header — the Mark attended shows CTA (neutral, Plus). */}
          <div className="mx-4 mb-2">
            <MarkCta label={archiveCopy.cta} onClick={() => setBrowserOpen(true)} />
          </div>
          {/* Attended shows newest-first (D-16); ShowsList renders its own empty
              state when there are no rows. Tracked → recap, retro → setlist. */}
          <ShowsList
            archive={archive}
            onOpenTracked={(sessionId) => setOpenShow({ kind: "tracked", sessionId })}
            onOpenRetro={(showId) => setOpenShow({ kind: "retro", showId })}
          />
        </div>
      )}

      {/* Full-screen retro-mark browser — component state, no new hash route. */}
      {browserOpen && <ArchiveBrowser archive={archive} onClose={() => setBrowserOpen(false)} />}

      {/* Album drill-in overlay — within #/dex (component state), back → grid. */}
      {openAlbum != null && rarity != null && openAlbumKey != null && (
        <AlbumDetail
          albumKey={openAlbumKey}
          title={openAlbum.title}
          slug={openAlbum.slug}
          tracks={openAlbum.tracks}
          dex={dex}
          rarity={rarity}
          onBack={() => setOpenAlbumKey(null)}
        />
      )}

      {/* Shows-segment drill-in (D-16, HIST-01) — component state, no new hash
          route. Tracked opens the recap payoff; retro opens the plain setlist. */}
      {openShow?.kind === "tracked" && (
        <RecapView sessionId={openShow.sessionId} onClose={() => setOpenShow(null)} />
      )}
      {openShow?.kind === "retro" && rarity != null && (
        <SetlistView
          showId={openShow.showId}
          archive={archive}
          rarity={rarity}
          onClose={() => setOpenShow(null)}
        />
      )}

      {/* Share-card preview sheet (SHAR-02) — self-sources the live dex. */}
      <ShareCardSheet open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}

interface MarkCtaProps {
  label: string;
  onClick: () => void;
}

/** The "Mark attended shows" entry CTA — neutral (never accent), Plus-adjacent. */
function MarkCta({ label, onClick }: MarkCtaProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-hairline px-4 text-[14px] font-semibold text-text-primary touch-manipulation"
    >
      <Plus size={18} aria-hidden="true" />
      {label}
    </button>
  );
}

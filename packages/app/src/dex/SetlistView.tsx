/**
 * The retro-marked show's full setlist (06-09, HIST-01). A full-screen drill-in
 * over #/dex (AlbumDetail overlay idiom — role="dialog" aria-modal, component
 * state, no new hash route): header {date} · {venue} then the set-grouped song
 * rows labeled Set 1 / Set 2 / Encore in order. Retro-marked shows have NO
 * trackedEntries and therefore NO hit/miss outcome — the rows are plain,
 * ring-less (RESEARCH Open Question 3, locked); a rarity TierBadge trails each
 * song when the corpus has one. Song/venue names are kglw-derived, rendered as
 * React text only (T-06-21).
 *
 * The setlist source is the bundled archive (by show_id) first, falling back to
 * the online-fallback `archiveShows` cache row for post-corpus marks absent from
 * the bundle (Pitfall 5). Set order follows the SHOW-06 vocabulary "1"/"2"/"e".
 */
import type { ArchiveArtifact, RarityIndex, RarityTier } from "@guezzer/core";
import { ChevronLeft } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { config } from "../config.ts";
import { db } from "../db/db.ts";
import { TierBadge } from "./TierBadge.tsx";

/** Canonical set display order (SetNumber vocabulary). */
const SET_ORDER = ["1", "2", "e"];

interface SetlistRow {
  songId: number;
  songName: string;
  tier: RarityTier | null;
}

interface ResolvedSet {
  n: string;
  label: string;
  rows: SetlistRow[];
}

interface ResolvedSetlist {
  date: string;
  venue: string | null;
  sets: ResolvedSet[];
}

function venueOf(name: string | null | undefined, city: string | null | undefined): string | null {
  if (!name) return null;
  return city ? `${name}, ${city}` : name;
}

function orderSets(sets: Array<{ n: string; rows: SetlistRow[] }>): ResolvedSet[] {
  const labels = config.copy.dex.setLabels as Record<string, string>;
  return [...sets]
    .sort((a, b) => {
      const ia = SET_ORDER.indexOf(a.n);
      const ib = SET_ORDER.indexOf(b.n);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    })
    .map((set) => ({ ...set, label: labels[set.n] ?? set.n }));
}

interface SetlistViewProps {
  showId: number;
  archive: ArchiveArtifact;
  rarity: RarityIndex;
  onClose: () => void;
}

export function SetlistView({ showId, archive, rarity, onClose }: SetlistViewProps) {
  const copy = config.copy.dex;

  // The online-fallback cache row (only needed for post-corpus marks).
  const cache = useLiveQuery(() => db.archiveShows.get(showId), [showId]);

  const resolved = useMemo((): ResolvedSetlist | null => {
    // Bundled archive first (the common corpus-era case).
    const arc = archive.shows.find((s) => s.id === showId);
    if (arc) {
      return {
        date: arc.date,
        venue: venueOf(arc.venue, arc.city),
        sets: orderSets(
          arc.sets.map((set) => ({
            n: set.n,
            rows: set.songs.map((id) => ({
              songId: id,
              songName: archive.songs[String(id)] ?? `#${id}`,
              tier: rarity.get(id)?.tier ?? null,
            })),
          })),
        ),
      };
    }
    // Post-corpus fallback cache row (Pitfall 5) — names ride in the cached row.
    if (cache) {
      return {
        date: cache.date,
        venue: venueOf(cache.venueName, cache.city),
        sets: orderSets(
          cache.sets.map((set) => ({
            n: set.n,
            rows: set.songs.map((s) => ({
              songId: s.songId,
              songName: s.songName,
              tier: rarity.get(s.songId)?.tier ?? null,
            })),
          })),
        ),
      };
    }
    return null;
  }, [showId, archive, cache, rarity]);

  // Not in the bundle and the cache row hasn't resolved yet — hold the frame.
  if (resolved == null) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={copy.albumBack}
        className="fixed inset-0 bg-surface"
        style={{ zIndex: config.ui.z.sheet }}
      />
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={resolved.date}
      className="fixed inset-0 flex flex-col overflow-y-auto bg-surface"
      style={{ zIndex: config.ui.z.sheet }}
    >
      {/* Header — back control + {date} · {venue}. */}
      <div
        className="flex items-center gap-3 border-b border-hairline bg-elevated px-4 py-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        <button
          type="button"
          aria-label={copy.albumBack}
          onClick={onClose}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-text-muted touch-manipulation"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="flex min-w-0 flex-col">
          <span className="text-[20px] font-semibold leading-tight tabular-nums text-text-primary">
            {resolved.date}
          </span>
          {resolved.venue != null && (
            <span className="truncate text-[14px] font-semibold leading-tight text-text-muted">
              {resolved.venue}
            </span>
          )}
        </div>
      </div>

      {/* Set-grouped song rows — plain, ring-less (no outcome data for retro). */}
      <div className="flex flex-col pb-16">
        {resolved.sets.map((set) => (
          <div key={set.n} className="flex flex-col">
            <p
              data-testid="setlist-set-heading"
              className="border-b border-hairline bg-elevated/50 px-4 py-2 text-[14px] font-semibold leading-tight text-text-muted"
            >
              {set.label}
            </p>
            {set.rows.map((row, i) => (
              <div
                key={`${set.n}-${i}`}
                data-testid="setlist-row"
                className="flex min-h-11 items-center gap-2 border-b border-hairline px-4 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-base leading-normal text-text-primary">
                  {row.songName}
                </span>
                {row.tier != null && <TierBadge tier={row.tier} />}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

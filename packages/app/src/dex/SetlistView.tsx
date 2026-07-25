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
 *
 * Phase-21 FOUND-03 / D-20/D-21 — PORTALED to `document.body`, on BOTH return paths:
 * the loading hold-the-frame dialog and the resolved one. Both carry `role="dialog"
 * aria-modal="true"` at `config.ui.z.sheet`, so portaling only one would leave the
 * invariant true for half this surface's lifetime — the half nobody looks at.
 *
 * Like `AlbumDetail` this was **not** broken (`DexView.tsx:99` has no `z-index` and no
 * `transform`), so the portal is PROPHYLACTIC: it makes the D-24 invariant uniformly
 * true and removes the latent trap a future `z-index` on that wrapper would spring. No
 * tier is renumbered.
 *
 * D-22 — stays HAND-ROLLED: no `<Sheet>` migration, no focus-trap / dismiss hooks.
 *
 * D-23 — audited: no `.orbit-stage` / `.action-bar` / `.fab-menu` ancestor existed;
 * Escape has never been handled here (closing is the ≥44px back control); no focus is
 * managed before or after; nothing read a `#app-content`-scoped style. The `useLiveQuery`
 * cache read is context-free and unaffected by DOM position.
 */
import type { ArchiveArtifact, RarityIndex, RarityTier } from "@guezzer/core";
import { ChevronLeft } from "lucide-react";
import { createPortal } from "react-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { config } from "../config.ts";
import { db } from "../db/db.ts";
import { TierBadge } from "./TierBadge.tsx";
import { formatFullDate } from "./formatDate.ts";

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

  // Phase-21 FOUND-03 / D-20: SSR-and-jsdom guard, copied from `Sheet.tsx`, so BOTH
  // portals below never touch an undefined `document`. Placed before the loading
  // early-return so it covers that path too.
  if (typeof document === "undefined") return null;

  // Not in the bundle and the cache row hasn't resolved yet — hold the frame.
  if (resolved == null) {
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label={copy.albumBack}
        className="fixed inset-0 bg-surface"
        style={{ zIndex: config.ui.z.sheet }}
      />,
      document.body,
    );
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={formatFullDate(resolved.date)}
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
            {formatFullDate(resolved.date)}
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
    </div>,
    document.body,
  );
}

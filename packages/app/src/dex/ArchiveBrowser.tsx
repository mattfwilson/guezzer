/**
 * Mark attended shows — the full-screen retro-mark browser (plan 06-08,
 * DEX-02/DEX-03, D-09..D-12). Copies the SearchSheet full-screen-overlay idiom:
 * a Body-size (≥16px, no iOS form-zoom) search field over the bundled archive
 * via the core `makeArchiveSearcher` engine (search lives in core, never
 * re-implemented here), collapsible year sections for browsing, and ≥44px show
 * rows rendering all kglw-derived strings as React text only (T-06-18, never
 * dangerouslySetInnerHTML).
 *
 * Marking is one tap, full-setlist credit (D-11) — every dex number recomputes
 * via `useLiveQuery` with no manual refresh. Unmarking a retro-marked show is
 * confirm-gated (D-12); a live-tracked show renders marked but is NOT unmarkable
 * (it is a history record — Pitfall 6). Already-attended detection checks BOTH
 * sources (attendedShows by show_id, trackedShows by bound showId else date).
 *
 * Online fallback (D-09): when online, a "Search kglw.net for newer shows" row
 * fetches POST-corpus shows via the tolerant core `fetchRecentShows`
 * (user-initiated, one GET per year per session via the module cache, never
 * retried). Marking a fetched show persists its setlist to `archiveShows` with
 * song NAMES sourced from the fetch result — the only name source for
 * post-corpus debuts (Pitfall 5). Offline: the row is replaced by a muted note.
 */
import {
  fetchRecentShows,
  groupShowsByYear,
  makeArchiveSearcher,
  type ArchiveArtifact,
  type ArchiveShow,
} from "@guezzer/core";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronDown, ChevronUp, Circle, CircleCheck, X } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { config } from "../config.ts";
import {
  db,
  markShowAttended,
  unmarkShowAttended,
  type ArchiveShowRow,
} from "../db/db.ts";
import { useOnlineStatus } from "../live/useOnlineStatus.ts";

interface ArchiveBrowserProps {
  archive: ArchiveArtifact;
  onClose: () => void;
}

/** Session-scoped fallback cache (D-09): one GET per year per app session. */
const fallbackCache = new Map<number, { shows: ArchiveShow[]; songs: Record<number, string> }>();

type FallbackStatus = "idle" | "loading" | "done";

function songCount(show: ArchiveShow): number {
  return show.sets.reduce((total, set) => total + set.songs.length, 0);
}

export function ArchiveBrowser({ archive, onClose }: ArchiveBrowserProps) {
  const copy = config.copy.archive;
  const online = useOnlineStatus();

  // Both attendance sources — reactive. A mark/unmark anywhere re-runs these.
  const attendedShows = useLiveQuery(() => db.attendedShows.toArray());
  const trackedShows = useLiveQuery(() => db.trackedShows.toArray());

  // Build the core searcher + year groups ONCE over the static archive.
  const search = useMemo(() => makeArchiveSearcher(archive.shows), [archive]);
  const yearGroups = useMemo(() => groupShowsByYear(archive.shows), [archive]);

  const [query, setQuery] = useState("");
  const [expandedYears, setExpandedYears] = useState<Set<number>>(
    () => new Set(yearGroups.length > 0 ? [yearGroups[0].year] : []),
  );
  const [flash, setFlash] = useState<{ showId: number; count: number } | null>(null);
  const [unmarkTarget, setUnmarkTarget] = useState<ArchiveShow | null>(null);

  const [fallbackStatus, setFallbackStatus] = useState<FallbackStatus>("idle");
  const [fetched, setFetched] = useState<ArchiveShow[]>([]);
  const [fetchedSongs, setFetchedSongs] = useState<Record<number, string>>({});
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Marked-state lookups (Pitfall 6): retro marks by show_id, tracked by bound
  // showId (preferred) else by date. `attended` → unmarkable; tracked-only → not.
  const attendedSet = useMemo(
    () => new Set((attendedShows ?? []).map((a) => a.show_id)),
    [attendedShows],
  );
  const trackedShowIds = useMemo(
    () => new Set((trackedShows ?? []).filter((t) => t.showId != null).map((t) => t.showId as number)),
    [trackedShows],
  );
  const trackedDates = useMemo(
    () => new Set((trackedShows ?? []).filter((t) => t.showId == null).map((t) => t.date)),
    [trackedShows],
  );

  const isTracked = useCallback(
    (show: ArchiveShow) => trackedShowIds.has(show.id) || trackedDates.has(show.date),
    [trackedShowIds, trackedDates],
  );

  const triggerFlash = useCallback((showId: number, count: number) => {
    setFlash({ showId, count });
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), config.dex.MARK_FLASH_MS);
  }, []);

  const resolveName = useCallback(
    (songId: number, songsRecord: Record<number, string>): string =>
      songsRecord[songId] ?? archive.songs[String(songId)] ?? `#${songId}`,
    [archive],
  );

  const handleMark = useCallback(
    async (show: ArchiveShow, fromFallback: boolean, songsRecord: Record<number, string>) => {
      if (fromFallback) {
        // Post-corpus show — cache its setlist so sightings survive reload AND
        // backup round-trips (Pitfall 5). Names come from the fetch result FIRST.
        const cachedSetlist: ArchiveShowRow = {
          show_id: show.id,
          date: show.date,
          venueName: show.venue,
          city: show.city,
          sets: show.sets.map((set) => ({
            n: set.n,
            songs: set.songs.map((songId) => ({ songId, songName: resolveName(songId, songsRecord) })),
          })),
        };
        await markShowAttended({ show_id: show.id, showDate: show.date, cachedSetlist });
      } else {
        // Corpus/archive show — its setlist already rides in the bundled artifact.
        await markShowAttended({ show_id: show.id, showDate: show.date });
      }
      triggerFlash(show.id, songCount(show));
    },
    [resolveName, triggerFlash],
  );

  const handleUnmark = useCallback(async () => {
    if (!unmarkTarget) return;
    await unmarkShowAttended(unmarkTarget.id);
    setUnmarkTarget(null);
  }, [unmarkTarget]);

  const toggleYear = useCallback((year: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  }, []);

  const runFallbackSearch = useCallback(async () => {
    setFallbackStatus("loading");
    const currentYear = new Date().getFullYear();
    const latestYear = Number.parseInt(archive.latestShowDate.slice(0, 4), 10);
    const years = [...new Set([currentYear, latestYear])];

    const merged = new Map<number, ArchiveShow>();
    const songs: Record<number, string> = {};
    for (const year of years) {
      let result = fallbackCache.get(year);
      if (!result) {
        result = await fetchRecentShows(year, archive.latestShowDate);
        fallbackCache.set(year, result);
      }
      for (const show of result.shows) merged.set(show.id, show);
      Object.assign(songs, result.songs);
    }

    setFetched(
      [...merged.values()].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
    );
    setFetchedSongs(songs);
    setFallbackStatus("done");
  }, [archive]);

  const trimmed = query.trim();
  const searchHits = trimmed === "" ? null : search(query);

  // ── Row renderer ───────────────────────────────────────────────────────────
  const renderRow = (show: ArchiveShow, fromFallback: boolean, songsRecord: Record<number, string>) => {
    const retro = attendedSet.has(show.id);
    const tracked = isTracked(show);
    const marked = retro || tracked;
    const unmarkable = retro; // tracked-only shows are history records (Pitfall 6)

    const rowText = (
      <span className="flex min-w-0 flex-col text-left">
        <span className="text-[14px] font-semibold leading-tight text-text-primary tabular-nums">
          {show.date}
        </span>
        <span className="truncate text-base leading-normal text-text-muted">
          <span className="text-text-primary">{show.venue}</span>
          {show.city ? <span>{`, ${show.city}`}</span> : null}
        </span>
      </span>
    );

    const flashEl =
      flash?.showId === show.id ? (
        <span className="ml-2 shrink-0 text-[14px] font-semibold text-hit">
          {copy.songsCaught(flash.count)}
        </span>
      ) : null;

    return (
      <div
        key={show.id}
        data-testid={`archive-row-${show.id}`}
        data-marked={marked}
        className="flex items-center gap-2 border-b border-hairline px-4"
      >
        {!marked ? (
          <button
            type="button"
            onClick={() => void handleMark(show, fromFallback, songsRecord)}
            className="flex min-h-11 flex-1 items-center gap-2 py-3 text-left touch-manipulation"
          >
            {rowText}
            {flashEl}
            <Circle size={22} className="ml-auto shrink-0 text-text-muted" aria-hidden="true" />
          </button>
        ) : (
          <div className="flex min-h-11 flex-1 items-center gap-2 py-3">
            {rowText}
            {flashEl}
            {unmarkable ? (
              <button
                type="button"
                aria-label={`${copy.unmarkConfirm} ${show.date}`}
                onClick={() => setUnmarkTarget(show)}
                className="ml-auto flex min-h-11 min-w-11 items-center justify-center shrink-0 touch-manipulation"
              >
                <CircleCheck size={22} className="text-hit" aria-hidden="true" />
              </button>
            ) : (
              <CircleCheck size={22} className="ml-auto shrink-0 text-hit" aria-hidden="true" />
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      className="fixed inset-0 flex flex-col bg-surface"
      style={{ zIndex: config.ui.z.sheet }}
    >
      {/* Title + close. */}
      <div
        className="flex items-center gap-2 border-b border-hairline bg-elevated px-4 py-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        <p className="min-h-11 flex flex-1 items-center text-[20px] font-semibold leading-tight text-text-primary">
          {copy.title}
        </p>
        <button
          type="button"
          aria-label={copy.close}
          onClick={onClose}
          className="flex min-h-11 min-w-11 items-center justify-center text-text-muted touch-manipulation"
        >
          <X size={22} />
        </button>
      </div>

      {/* Search field — text-base (16px) avoids iOS form-zoom. */}
      <div className="border-b border-hairline bg-elevated px-4 py-2">
        <input
          type="text"
          inputMode="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.searchPlaceholder}
          aria-label={copy.searchPlaceholder}
          className="min-h-11 w-full bg-transparent text-base leading-normal text-text-primary placeholder:text-text-muted focus:outline-none"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {searchHits != null ? (
          searchHits.length > 0 ? (
            searchHits.map((hit) => renderRow(hit.show, false, archive.songs as unknown as Record<number, string>))
          ) : (
            <NoMatch heading={copy.noMatchHeading} body={copy.noMatchBody(archive.latestShowDate)} />
          )
        ) : (
          yearGroups.map(({ year, shows }) => {
            const expanded = expandedYears.has(year);
            return (
              <section key={year}>
                <button
                  type="button"
                  data-testid="year-header"
                  onClick={() => toggleYear(year)}
                  className="flex min-h-11 w-full items-center gap-2 bg-elevated/50 px-4 py-2 text-left touch-manipulation"
                >
                  <span className="text-[14px] font-semibold text-text-primary tabular-nums">{year}</span>
                  <span className="text-base text-text-muted">· {shows.length}</span>
                  {expanded ? (
                    <ChevronUp size={18} className="ml-auto text-text-muted" aria-hidden="true" />
                  ) : (
                    <ChevronDown size={18} className="ml-auto text-text-muted" aria-hidden="true" />
                  )}
                </button>
                {expanded &&
                  shows.map((show) => renderRow(show, false, archive.songs as unknown as Record<number, string>))}
              </section>
            );
          })
        )}

        {/* Online fallback (D-09) / offline note. */}
        <div className="px-4 py-4">
          {!online ? (
            <p className="text-base leading-normal text-text-muted">{copy.offlineNote}</p>
          ) : fallbackStatus === "loading" ? (
            <p className="text-base leading-normal text-text-muted">{copy.fallbackSearching}</p>
          ) : fallbackStatus === "done" ? (
            fetched.length > 0 ? (
              <div className="-mx-4">
                {fetched.map((show) => renderRow(show, true, fetchedSongs))}
              </div>
            ) : (
              <div>
                <p className="text-[14px] font-semibold leading-tight text-text-primary">
                  {copy.failureHeading}
                </p>
                <p className="mt-1 text-base leading-normal text-text-muted">{copy.failureBody}</p>
              </div>
            )
          ) : (
            <button
              type="button"
              onClick={() => void runFallbackSearch()}
              className="flex min-h-11 w-full items-center justify-center rounded-md border border-hairline px-4 text-[14px] font-semibold text-text-primary touch-manipulation"
            >
              {copy.fallbackSearch}
            </button>
          )}
        </div>
      </div>

      {/* Unmark confirm dialog (D-12) — the phase's only destructive control. */}
      {unmarkTarget != null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={copy.unmarkHeading}
          className="fixed inset-0 flex flex-col justify-end bg-black/50"
          style={{ zIndex: config.ui.z.sheetScrim }}
          onClick={() => setUnmarkTarget(null)}
        >
          <div
            className="rounded-t-2xl border-t border-hairline bg-elevated px-4 pt-4"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 32px)" }}
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-[20px] font-semibold leading-tight text-text-primary">
              {copy.unmarkHeading}
            </p>
            <p className="mt-2 text-base leading-normal text-text-muted">{copy.unmarkBody}</p>
            <button
              type="button"
              onClick={() => void handleUnmark()}
              className="mt-4 flex min-h-11 w-full items-center justify-center rounded-md bg-destructive px-4 text-[14px] font-semibold text-surface touch-manipulation"
            >
              {copy.unmarkConfirm}
            </button>
            <button
              type="button"
              onClick={() => setUnmarkTarget(null)}
              className="mt-2 flex min-h-11 w-full items-center justify-center rounded-md border border-hairline px-4 text-[14px] font-semibold text-text-primary touch-manipulation"
            >
              {copy.unmarkCancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface NoMatchProps {
  heading: string;
  body: string;
}

function NoMatch({ heading, body }: NoMatchProps) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-[20px] font-semibold leading-tight text-text-primary">{heading}</p>
      <p className="mt-2 text-base leading-normal text-text-muted">{body}</p>
    </div>
  );
}

/**
 * The Dex Shows segment list (06-09, D-16). Every attended show newest-first —
 * tracked (finalized) shows and retro-marked shows unified in ONE list, deduped
 * by the SAME group-key rule deriveDex uses (bound → by show_id, unbound → by
 * date), with a tracked+marked night rendering once, as tracked. Dexie is the
 * single source of truth: the four attendance tables are read via `useLiveQuery`
 * and merged by the pure `buildShowRows` — a mark/unmark anywhere re-derives the
 * list live. kglw-derived venue names render as React text only (T-06-21).
 *
 * Tracked rows carry a hit/miss tally chip and open the RecapView (via
 * onOpenTracked); retro rows have no trackedEntries — they open the plain
 * set-structured SetlistView (via onOpenRetro, HIST-01). Routing lives in DexView
 * (openShow component state — no new hash route).
 */
import type { ArchiveArtifact } from "@guezzer/core";
import { ChevronRight } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { config } from "../config.ts";
import {
  db,
  type ArchiveShowRow,
  type AttendedShow,
  type TrackedEntry,
  type TrackedShow,
} from "../db/db.ts";

/** A finalized live-tracked show row — carries the tally chip, opens the recap. */
interface TrackedShowRow {
  kind: "tracked";
  key: string;
  date: string;
  venue: string | null;
  songCount: number;
  hits: number;
  total: number;
  sessionId: string;
}

/** A retro-marked show row — opens the plain set-structured setlist (HIST-01). */
interface RetroShowRow {
  kind: "retro";
  key: string;
  date: string;
  venue: string | null;
  songCount: number;
  showId: number;
}

export type ShowRowData = TrackedShowRow | RetroShowRow;

interface BuildShowRowsInput {
  /** Finalized tracked shows only (the active/in-progress show is not history). */
  trackedShows: TrackedShow[];
  attendedShows: AttendedShow[];
  trackedEntries: TrackedEntry[];
  archiveShows: ArchiveShowRow[];
  archive: ArchiveArtifact;
}

/** Same group-key rule as deriveDex/merge (D-11): bound → by show_id, else by date. */
function groupKey(showId: number | null, date: string): string {
  return showId != null ? `id:${showId}` : `date:${date}`;
}

function venueOf(name: string | null | undefined, city: string | null | undefined): string | null {
  if (!name) return null;
  return city ? `${name}, ${city}` : name;
}

/**
 * Merge finalized tracked + retro-marked shows into display rows, deduped by the
 * group-key rule (tracked wins) and sorted newest-first. Pure — testable in
 * isolation, and the "Dexie is the single source of truth" derivation for the
 * Shows segment (no stored rows).
 */
export function buildShowRows(input: BuildShowRowsInput): ShowRowData[] {
  const { trackedShows, attendedShows, trackedEntries, archiveShows, archive } = input;

  const entriesBySession = new Map<string, TrackedEntry[]>();
  for (const entry of trackedEntries) {
    let list = entriesBySession.get(entry.sessionId);
    if (!list) {
      list = [];
      entriesBySession.set(entry.sessionId, list);
    }
    list.push(entry);
  }

  const archiveById = new Map<number, ArchiveArtifact["shows"][number]>();
  for (const show of archive.shows) archiveById.set(show.id, show);
  const cacheById = new Map<number, ArchiveShowRow>();
  for (const row of archiveShows) cacheById.set(row.show_id, row);

  const rows = new Map<string, ShowRowData>();

  // Tracked (finalized) first — a tracked night wins the dedupe render.
  for (const tracked of trackedShows) {
    const key = groupKey(tracked.showId, tracked.date);
    const entries = entriesBySession.get(tracked.sessionId) ?? [];
    const total = entries.length;
    const hits = entries.filter((e) => e.outcome === "hit").length;
    rows.set(key, {
      kind: "tracked",
      key,
      date: tracked.date,
      venue: venueOf(tracked.venueName, tracked.city),
      songCount: total,
      hits,
      total,
      sessionId: tracked.sessionId,
    });
  }

  // Retro marks — skip any whose group key a tracked show already owns.
  for (const attended of attendedShows) {
    const key = groupKey(attended.show_id, attended.showDate);
    if (rows.has(key)) continue;
    const arc = archiveById.get(attended.show_id);
    const cache = cacheById.get(attended.show_id);
    let songCount = 0;
    let venue: string | null = null;
    let date = attended.showDate;
    if (arc) {
      songCount = arc.sets.reduce((n, set) => n + set.songs.length, 0);
      venue = venueOf(arc.venue, arc.city);
      date = arc.date;
    } else if (cache) {
      songCount = cache.sets.reduce((n, set) => n + set.songs.length, 0);
      venue = venueOf(cache.venueName, cache.city);
      date = cache.date;
    }
    rows.set(key, { kind: "retro", key, date, venue, songCount, showId: attended.show_id });
  }

  return [...rows.values()].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : a.key < b.key ? 1 : -1,
  );
}

interface ShowsListProps {
  archive: ArchiveArtifact;
  onOpenTracked: (sessionId: string) => void;
  onOpenRetro: (showId: number) => void;
}

export function ShowsList({ archive, onOpenTracked, onOpenRetro }: ShowsListProps) {
  const copy = config.copy.dex;

  const trackedShows = useLiveQuery(() =>
    db.trackedShows.where("status").equals("finalized").toArray(),
  );
  const attendedShows = useLiveQuery(() => db.attendedShows.toArray());
  const trackedEntries = useLiveQuery(() => db.trackedEntries.toArray());
  const archiveShows = useLiveQuery(() => db.archiveShows.toArray());

  const rows = useMemo(() => {
    if (
      trackedShows === undefined ||
      attendedShows === undefined ||
      trackedEntries === undefined ||
      archiveShows === undefined
    ) {
      return null;
    }
    return buildShowRows({ trackedShows, attendedShows, trackedEntries, archiveShows, archive });
  }, [trackedShows, attendedShows, trackedEntries, archiveShows, archive]);

  // Still resolving the live reads — hold the frame (no flicker).
  if (rows == null) return <div className="mx-auto w-full max-w-md" aria-hidden="true" />;

  // Empty state — replaced by the list the moment a row exists.
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 pt-16 pb-16 text-center">
        <p className="text-[20px] font-semibold leading-tight text-text-primary">
          {copy.showsEmptyHeading}
        </p>
        <p className="text-base leading-normal text-text-muted">{copy.showsEmptyBody}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {rows.map((row) => (
        <button
          key={row.key}
          type="button"
          data-testid="show-row"
          data-kind={row.kind}
          onClick={() =>
            row.kind === "tracked" ? onOpenTracked(row.sessionId) : onOpenRetro(row.showId)
          }
          className="flex min-h-11 items-center gap-2 border-b border-hairline px-4 py-3 text-left touch-manipulation"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[14px] font-semibold leading-tight tabular-nums text-text-primary">
              {row.date}
            </span>
            {row.venue != null && (
              <span className="truncate text-base leading-normal text-text-muted">
                {row.venue}
              </span>
            )}
            <span className="text-[14px] leading-tight tabular-nums text-text-muted">
              {copy.showsSongCount(row.songCount)}
            </span>
          </span>
          {row.kind === "tracked" && (
            <span
              data-testid="show-tally-chip"
              className="shrink-0 rounded-full border border-hairline px-2 py-0.5 text-[14px] font-semibold tabular-nums text-text-primary"
            >
              {copy.showsTallyChip(row.hits, row.total)}
            </span>
          )}
          <ChevronRight size={18} className="shrink-0 text-text-muted" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

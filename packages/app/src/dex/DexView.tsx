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
import { useState } from "react";
import { config } from "../config.ts";
import { AlbumGrid } from "./AlbumGrid.tsx";
import { DexHeader } from "./DexHeader.tsx";
import { useDexStats } from "./useDexStats.ts";

type Segment = "albums" | "shows";

export function DexView() {
  const copy = config.copy.dex;
  const stats = useDexStats();
  const [segment, setSegment] = useState<Segment>("albums");

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

  const { dex, archive, albums } = stats;
  const emptyDex = dex.completion.caught === 0;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col">
      <DexHeader dex={dex} archive={archive} />

      {/* Segment control — component state, not a route (no new hash routes). The
          active half is accent-tinted (reserved accent use #4, §Color A). */}
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
                active ? "bg-accent/20 text-text-primary" : "text-text-muted"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {segment === "albums" ? (
        emptyDex ? (
          <EmptyState heading={copy.emptyHeading} body={copy.emptyBody} />
        ) : (
          // Drill-in (onOpen) is wired to AlbumDetail in Task 2.
          <AlbumGrid dex={dex} albums={albums} onOpen={() => undefined} />
        )
      ) : (
        <EmptyState heading={copy.showsEmptyHeading} body={copy.showsEmptyBody} />
      )}
    </div>
  );
}

interface EmptyStateProps {
  heading: string;
  body: string;
}

function EmptyState({ heading, body }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 pt-16 pb-16 text-center">
      <p className="text-[20px] font-semibold leading-tight text-text-primary">
        {heading}
      </p>
      <p className="text-base leading-normal text-text-muted">{body}</p>
    </div>
  );
}

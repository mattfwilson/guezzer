/**
 * CompareView (SHAR-01, D-17, plan 06-10) — a friend's dex rendered as a
 * READ-ONLY trophy case. Reached only from the Settings import fork when the
 * imported file is owned by someone else (RESEARCH Pattern 5): the parsed
 * envelope is handed here and NEVER merged. This component imports NEITHER
 * parseAndMergeImport NOR importSnapshot NOR any db write helper — a friend's
 * file is structurally incapable of inflating your attendance (T-06-24). The
 * only db touch is the reactive READ inside useDexStats (your own numbers).
 *
 * It runs the pure core `deriveDex` a SECOND time over the friend's envelope
 * (envelope v2 is a structural superset of DexSnapshotInput), then `compareDexes`
 * diffs the two. The friend's name + all song names are kglw-derived / untrusted:
 * rendered as escaped React text only and visually clamped (T-06-26).
 */
import {
  compareDexes,
  deriveDex,
  type ArchiveArtifact,
  type CompareResult,
  type DexStats,
  type ExportEnvelope,
} from "@guezzer/core";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { useMemo, useState } from "react";
import { config } from "../config.ts";
import { Sheet } from "../components/Sheet.tsx";
import { TierBadge } from "./TierBadge.tsx";
import { useDexStats } from "./useDexStats.ts";

interface CompareViewProps {
  /** The friend's PARSED, validated envelope (never merged). */
  envelope: ExportEnvelope;
  onClose: () => void;
}

export function CompareView({ envelope, onClose }: CompareViewProps) {
  const copy = config.copy.compare;
  const stats = useDexStats();

  // The friend's name is length-clamped by the schema (≤40); fall back to a
  // neutral label if somehow blank. Rendered as escaped React text only.
  const friendName = envelope.owner?.trim() || copy.namePrompt;

  // Derive the friend's dex from the SAME pure core fn (a second deriveDex run),
  // then diff. Memoized on the loaded artifacts + envelope so it runs once.
  const compare = useMemo<CompareResult | null>(() => {
    if (stats.dex == null || stats.archive == null || stats.albums == null || stats.rarity == null) {
      return null;
    }
    const theirs: DexStats = deriveDex(envelope, stats.archive, stats.albums, stats.rarity);
    return compareDexes(stats.dex, theirs);
  }, [envelope, stats.dex, stats.archive, stats.albums, stats.rarity]);

  const header = (
    <div
      className="flex items-center gap-3 border-b border-hairline bg-elevated px-4 py-3"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
    >
      <button
        type="button"
        aria-label={copy.close}
        onClick={onClose}
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-text-muted touch-manipulation"
      >
        <X size={24} />
      </button>
      {/* Persistent read-only banner — always visible (D-17 reassurance). */}
      <p className="min-w-0 flex-1 truncate text-base leading-normal text-text-muted">
        {copy.banner(friendName)}
      </p>
    </div>
  );

  // Loader failure or still-resolving reads — hold the frame behind the banner.
  if (stats.error != null || compare == null || stats.archive == null) {
    return (
      <Sheet
        open
        onClose={onClose}
        modal
        variant="fullscreen"
        ariaLabel={copy.banner(friendName)}
      >
        <div className="flex min-h-full flex-col">
          {header}
          {stats.error != null && (
            <p className="px-4 pt-8 text-center text-base leading-normal text-text-muted">
              {stats.error}
            </p>
          )}
        </div>
      </Sheet>
    );
  }

  const { archive } = stats;
  const nameOf = (songId: number): string => archive.songs[String(songId)] ?? `#${songId}`;

  return (
    <Sheet
      open
      onClose={onClose}
      modal
      variant="fullscreen"
      ariaLabel={copy.banner(friendName)}
    >
      {header}

      {/* You vs {name} stat columns — side-by-side on the elevated surface. */}
      <div className="mx-4 mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-hairline bg-hairline">
        <StatColumn heading={copy.columnYou} column={compare.columns.mine} />
        <StatColumn
          heading={copy.columnThem(friendName)}
          column={compare.columns.theirs}
          clampHeading
        />
      </div>

      {/* Diff sections — collapsible, tier-sorted, names from archive.songs. */}
      <div className="mt-4 flex flex-col pb-16">
        <DiffSection
          heading={copy.onlyYouHeading(compare.onlyMine.length)}
          songIds={compare.onlyMine}
          nameOf={nameOf}
          tierOf={(id) => stats.rarity?.get(id)?.tier ?? null}
          defaultOpen
        />
        <DiffSection
          heading={copy.onlyThemHeading(friendName, compare.onlyTheirs.length)}
          songIds={compare.onlyTheirs}
          nameOf={nameOf}
          tierOf={(id) => stats.rarity?.get(id)?.tier ?? null}
          defaultOpen
        />
        <DiffSection
          heading={copy.sharedHeading(compare.shared.length)}
          songIds={compare.shared}
          nameOf={nameOf}
          tierOf={(id) => stats.rarity?.get(id)?.tier ?? null}
        />
      </div>
    </Sheet>
  );
}

interface StatColumnProps {
  heading: string;
  column: CompareResult["columns"]["mine"];
  clampHeading?: boolean;
}

function StatColumn({ heading, column, clampHeading }: StatColumnProps) {
  const copy = config.copy.compare;
  const rows: Array<[string, string | number]> = [
    [copy.statCompletion, `${column.completion}%`],
    [copy.statCaught, column.caught],
    [copy.statShows, column.shows],
  ];
  return (
    <div className="flex flex-col gap-2 bg-elevated p-3">
      <p
        className={`text-[14px] font-semibold leading-tight text-text-primary ${clampHeading ? "truncate" : ""}`}
      >
        {heading}
      </p>
      <dl className="flex flex-col gap-1">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-2">
            <dt className="text-base leading-normal text-text-muted">{label}</dt>
            <dd className="text-base font-semibold leading-normal tabular-nums text-text-primary">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

interface DiffSectionProps {
  heading: string;
  songIds: number[];
  nameOf: (songId: number) => string;
  tierOf: (songId: number) => import("@guezzer/core").RarityTier | null;
  defaultOpen?: boolean;
}

function DiffSection({ heading, songIds, nameOf, tierOf, defaultOpen }: DiffSectionProps) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const empty = songIds.length === 0;

  return (
    <section className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        disabled={empty}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 items-center gap-2 border-b border-hairline px-4 py-2 text-left text-[14px] font-semibold leading-tight text-text-primary touch-manipulation disabled:text-text-muted"
      >
        {empty ? (
          <span className="w-4" aria-hidden="true" />
        ) : open ? (
          <ChevronDown size={16} className="shrink-0 text-text-muted" aria-hidden="true" />
        ) : (
          <ChevronRight size={16} className="shrink-0 text-text-muted" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1 truncate">{heading}</span>
      </button>
      {open &&
        songIds.map((songId) => (
          <div
            key={songId}
            className="flex min-h-11 items-center gap-2 border-b border-hairline px-4 py-2"
          >
            <span className="min-w-0 flex-1 truncate text-base leading-normal text-text-primary">
              {nameOf(songId)}
            </span>
            {tierOf(songId) != null && <TierBadge tier={tierOf(songId)!} />}
          </div>
        ))}
    </section>
  );
}

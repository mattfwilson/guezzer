/**
 * FriendDetail (Phase 19, PROG-06/07 · D-07/D-08/D-09/D-19) — a friend's dex as a
 * live HEAD-TO-HEAD, opened as a full-screen `Sheet` overlay (view-state within
 * `#/dex`, NEVER a new hash route — D-07). It ECHOES `CompareView`'s layout in a NEW
 * file and NEVER imports or edits `CompareView.tsx` (D-09, hard constraint).
 *
 * The live wiring (PROG-06): read the signed-in user's live `useDexStats`, then
 * `reconstructDexStats(friend.summary, rarity)` rebuilds a MINIMAL `theirs` DexStats
 * (19-01) and feeds it — with the local `mine` — into the BYTE-FOR-BYTE UNCHANGED
 * pure-core `compareDexes`. The reconstructed dex carries exactly the read-set the
 * diff consumes; tiers come from the LOCAL rarity index (D-13), so mine and theirs
 * agree on a songId's tier without shipping tiers. A regression pin (FriendDetail
 * .test.tsx) asserts these columns populate; the full two-device round-trip stays in
 * 19-04.
 *
 * Body order (D-08): head-to-head columns → expandable By-rarity diff lists +
 * By-album tallies → the friend's rarest-catches showcase. All friend-supplied
 * strings (`display_name`, resolved song/album names) render as escaped React text,
 * `truncate`/`min-w-0` clamped, never `dangerouslySetInnerHTML` (D-19 / T-19-xss);
 * every set operation is songId-only.
 */
import {
  compareDexes,
  reconstructDexStats,
  type CompareResult,
  type DexAlbumsArtifact,
  type DexStats,
  type RarityTier,
} from "@guezzer/core";
import { ChevronDown, ChevronLeft, ChevronRight, Hand } from "lucide-react";
import { useMemo, useState } from "react";
import { config } from "../config.ts";
import { Sheet } from "../components/Sheet.tsx";
import { RarestShowcase } from "./RarestShowcase.tsx";
import { ReactionPalette } from "./ReactionPalette.tsx";
import { TierBadge } from "./TierBadge.tsx";
import { useDexStats } from "./useDexStats.ts";
import type { FriendRowData } from "../sync/friendCache.ts";

interface FriendDetailProps {
  friend: FriendRowData;
  onClose: () => void;
}

/** Resolve a perAlbum key → display title — echoes DexView's `resolveOpenAlbum` idiom. */
function albumTitle(key: string, albums: DexAlbumsArtifact, copy: typeof config.copy.dex): string {
  if (key === "covers") return copy.bucketCovers;
  if (key === "miscellaneous") return copy.bucketMiscellaneous;
  return albums.albums.find((a) => a.albumUrl === key)?.title ?? key;
}

export function FriendDetail({ friend, onClose }: FriendDetailProps) {
  const copy = config.copy.friends;
  const presence = config.copy.presence;
  const compareCopy = config.copy.compare;
  const dexCopy = config.copy.dex;
  const stats = useDexStats();
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Untrusted friend name — escaped React text only, length-clamped by the schema.
  const friendName = friend.displayName.trim() || compareCopy.namePrompt;

  // The live head-to-head: reconstruct `theirs` from the synced summary and feed the
  // UNCHANGED core diff. Memoized on the loaded artifacts + summary so it runs once.
  const model = useMemo<{ compare: CompareResult; theirs: DexStats } | null>(() => {
    if (stats.dex == null || stats.archive == null || stats.rarity == null) return null;
    const theirs = reconstructDexStats(friend.summary, stats.rarity);
    return { compare: compareDexes(stats.dex, theirs), theirs };
  }, [friend.summary, stats.dex, stats.archive, stats.rarity]);

  const header = (
    <div
      className="flex items-center gap-3 border-b border-hairline bg-elevated px-4 py-3"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
    >
      <button
        type="button"
        aria-label={copy.back}
        onClick={onClose}
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-text-muted touch-manipulation"
      >
        <ChevronLeft size={24} />
      </button>
      <p className="min-w-0 flex-1 truncate text-[20px] font-semibold leading-tight text-text-primary">
        {copy.versus(friendName)}
      </p>
      {/* Pre-targeted wave (D-07) — opens the shared ReactionPalette fixed to THIS
          friend (initialTarget=friend.userId). Shares the one sendWave path; the
          receiver still enforces to===me (validateWave). ≥44px, escaped name. */}
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="flex min-h-11 min-w-11 shrink-0 items-center gap-1 rounded-md border border-hairline px-3 text-[14px] font-semibold leading-tight text-text-primary touch-manipulation"
      >
        <Hand size={16} aria-hidden="true" />
        {presence.waveAtFriend(friendName)}
      </button>
    </div>
  );

  // The shared send surface, pre-targeted at this friend (D-07). A Sheet over the
  // existing overlay — no new hash route, no new z-tier. `friends` carries the one
  // targeted friend so the picker can still show/confirm the target.
  const palette = (
    <ReactionPalette
      open={paletteOpen}
      onClose={() => setPaletteOpen(false)}
      initialTarget={friend.userId}
      friends={[friend]}
    />
  );

  // Loader failure or still-resolving reads — hold the frame behind the header.
  if (
    stats.error != null ||
    model == null ||
    stats.archive == null ||
    stats.albums == null ||
    stats.rarity == null
  ) {
    return (
      <Sheet open onClose={onClose} modal variant="fullscreen" ariaLabel={copy.versus(friendName)}>
        <div className="flex min-h-full flex-col">
          {header}
          {stats.error != null && (
            <p className="px-4 pt-8 text-center text-base leading-normal text-text-muted">
              {stats.error}
            </p>
          )}
        </div>
        {palette}
      </Sheet>
    );
  }

  const { archive, albums, rarity } = stats;
  const { compare, theirs } = model;
  const nameOf = (songId: number): string => archive.songs[String(songId)] ?? `#${songId}`;
  const mineTierOf = (id: number): RarityTier | null => stats.dex?.perSong.get(id)?.tier ?? null;
  const theirsTierOf = (id: number): RarityTier | null => theirs.perSong.get(id)?.tier ?? null;

  // Per-album tallies from the reconstructed `theirs` (songId-only, titles resolved
  // for display via the resolveOpenAlbum idiom). Rendered in a stable title order.
  const albumRows = [...theirs.perAlbum.entries()]
    .map(([key, tally]) => ({ key, title: albumTitle(key, albums, dexCopy), ...tally }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return (
    <Sheet open onClose={onClose} modal variant="fullscreen" ariaLabel={copy.versus(friendName)}>
      {header}

      {/* 1. Head-to-head columns — lead the overlay (D-08). Reuse config.copy.compare
             strings so the live path and the file-import path never disagree. */}
      <div className="mx-4 mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-hairline bg-hairline">
        <StatColumn heading={compareCopy.columnYou} column={compare.columns.mine} />
        <StatColumn heading={compareCopy.columnThem(friendName)} column={compare.columns.theirs} clampHeading />
      </div>

      {/* 2a. By rarity — the tier-sorted, TierBadge-tagged diff song lists (D-11). */}
      <p className="mt-6 px-4 text-[14px] font-semibold leading-tight text-text-muted">
        {copy.byRarity}
      </p>
      <div className="mt-1 flex flex-col">
        <DiffSection
          heading={compareCopy.onlyYouHeading(compare.onlyMine.length)}
          songIds={compare.onlyMine}
          nameOf={nameOf}
          tierOf={mineTierOf}
          defaultOpen
        />
        <DiffSection
          heading={compareCopy.onlyThemHeading(friendName, compare.onlyTheirs.length)}
          songIds={compare.onlyTheirs}
          nameOf={nameOf}
          tierOf={theirsTierOf}
          defaultOpen
        />
        <DiffSection
          heading={compareCopy.sharedHeading(compare.shared.length)}
          songIds={compare.shared}
          nameOf={nameOf}
          tierOf={mineTierOf}
        />
      </div>

      {/* 2b. By album — the friend's per-album caught/total tallies (theirs.perAlbum). */}
      <p className="mt-6 px-4 text-[14px] font-semibold leading-tight text-text-muted">
        {copy.byAlbum}
      </p>
      <AlbumSection rows={albumRows} />

      {/* 3. The friend's rarest-catches showcase (PROG-08). */}
      <div className="mt-6 pb-16">
        <RarestShowcase
          heading={copy.rarestFriend(friendName)}
          caughtSongIds={friend.summary.caughtSongIds}
          rarity={rarity}
          archive={archive}
        />
      </div>

      {palette}
    </Sheet>
  );
}

interface StatColumnProps {
  heading: string;
  column: CompareResult["columns"]["mine"];
  clampHeading?: boolean;
}

/** Echoes CompareView's StatColumn — a private local component (never imported). */
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
  tierOf: (songId: number) => RarityTier | null;
  defaultOpen?: boolean;
}

/** Echoes CompareView's collapsible DiffSection — a private local component. */
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

interface AlbumSectionProps {
  rows: Array<{ key: string; title: string; caught: number; total: number }>;
}

/** Collapsible per-album tallies — echoes the DiffSection collapse shell. */
function AlbumSection({ rows }: AlbumSectionProps) {
  const [open, setOpen] = useState(false);
  const empty = rows.length === 0;

  return (
    <section className="mt-1 flex flex-col">
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
        <span className="min-w-0 flex-1 truncate">
          {config.copy.friends.byAlbum} ({rows.length})
        </span>
      </button>
      {open &&
        rows.map((row) => (
          <div
            key={row.key}
            className="flex min-h-11 items-center gap-2 border-b border-hairline px-4 py-2"
          >
            <span className="min-w-0 flex-1 truncate text-base leading-normal text-text-primary">
              {row.title}
            </span>
            <span className="shrink-0 text-base font-semibold leading-normal tabular-nums text-text-muted">
              {row.caught}/{row.total}
            </span>
          </div>
        ))}
    </section>
  );
}

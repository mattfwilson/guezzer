/**
 * Phase-16 (BINGO-02, D-02/D-04/D-05/D-06) swap / reshuffle bottom-sheet. Opened
 * by tapping a draft-board square, it offers, in fixed section order
 * Events → Albums → Songs (sub-grouped "Likely" / "A stretch") → Search, a
 * replacement for that one square, PLUS a reshuffle-whole-card control.
 *
 * Load-bearing contracts:
 *  - Honest catchability (D-05): every candidate shows ONLY its measured
 *    recent-era fire-rate % (bust-out prefixed 🌟) — never a fake confidence.
 *  - Dedup / consume-once (D-04): a candidate whose identity (songId / albumUrl /
 *    event) is already on the card renders greyed + disabled, so no dead duplicate
 *    square can be created.
 *  - Valid card (T-16-05): selecting a candidate replaces exactly the tapped
 *    square's `BingoSquareDef` (real display label frozen in), keeping the card at
 *    16 squares with the single free cell; the parent persists via `saveDraftCard`.
 *  - Reshuffle (D-06): keeps the current vibe; when the card carries custom swaps
 *    it CONFIRMS first (the only destructive control this phase, `#ef4444`),
 *    otherwise it re-deals silently.
 *
 * Search reuses the shipped fuse.js catalog path (`makeCatalogSearcher`/`toCatalog`)
 * — no new search engine. Covers come from the bundled glob (`coverUrlFor` /
 * `coverUrlForSong`), degrading to a text chip on null. All kglw-derived names
 * render as escaped React text only (T-16-04).
 */
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  makeCatalogSearcher,
  toCatalog,
  type BingoCard,
  type BingoContext,
  type BingoEvent,
  type BingoSquareDef,
} from "@guezzer/core";
import { config as coreConfig } from "@guezzer/core/config";
import { Sheet } from "../components/Sheet.tsx";
import { config } from "../config.ts";
import { coverUrlFor } from "../dex/covers.ts";
import { coverUrlForSong } from "../dex/song-cover.ts";
import { loadMatrix } from "../show/matrix.ts";
import { prettifyAlbumUrl, type BingoNameMaps } from "./bingoLabels.ts";

/** Human labels for the five event squares (mirrors generate.ts EVENT_LABELS, not exported from core). */
const EVENT_LABELS: Readonly<Record<BingoEvent, string>> = {
  opener: "Show Opener",
  microtonal: "Microtonal Song",
  marathonJam: "Marathon Jam",
  bustOut: "Bust-Out",
  neverCaught: "Never Caught",
};

/** Fixed event order in the Events section (reliable → glory). */
const EVENT_ORDER: readonly BingoEvent[] = [
  "opener",
  "microtonal",
  "marathonJam",
  "bustOut",
  "neverCaught",
];

/** Top-N era songs surfaced in the Songs section (keeps the list one-thumb scrollable). */
const SONG_CANDIDATE_LIMIT = 48;

/**
 * Presentational split for the Songs section (D-02 "Likely" / "A stretch"). A
 * per-show fire-rate at/above this fraction reads as "Likely". Presentational
 * grouping only — the honest % is always shown regardless of bucket.
 */
const SONG_LIKELY_FRACTION = 0.1;

/** One swap candidate row. */
interface SwapCandidate {
  def: BingoSquareDef;
  /** Identity key for dedup (matches `onCardKey`). */
  key: string;
  label: string;
  coverUrl: string | null;
  fireHint: string;
  /** Song per-show fire fraction (Songs section sub-grouping only). */
  rate: number;
}

/** Identity key of a resolved square (label-independent) — the dedup unit (D-04). */
function keyForDef(def: BingoSquareDef): string {
  switch (def.kind) {
    case "free":
      return "free";
    case "song":
      return `song:${def.songId}`;
    case "album":
      return `album:${def.albumUrl}`;
    case "event":
      return `event:${def.event}`;
  }
}

interface SwapSheetProps {
  open: boolean;
  onClose: () => void;
  /** The current draft card (its `squares` supply the dedup set). */
  card: BingoCard;
  /** Board index of the tapped square being replaced. */
  squareIndex: number;
  /** Memoized marking context (album/song rosters). */
  ctx: BingoContext;
  /** Song/album display-name maps (bingoLabels). */
  nameMaps: BingoNameMaps;
  /** Whether the card already deviates from its dealt vibe (gates the reshuffle confirm, D-06). */
  isCustom: boolean;
  /** Persist a single-square swap: parent writes `saveDraftCard` (T-16-05). */
  onApplySwap: (card: BingoCard) => void;
  /** Re-deal the whole card keeping the current vibe (parent seeds + persists). */
  onReshuffle: () => void;
}

export function SwapSheet({
  open,
  onClose,
  card,
  squareIndex,
  ctx,
  nameMaps,
  isCustom,
  onApplySwap,
  onReshuffle,
}: SwapSheetProps) {
  const copy = config.copy.games.bingo;
  const [query, setQuery] = useState("");
  const [confirmReshuffle, setConfirmReshuffle] = useState(false);

  // Fuse.js catalog searcher over the full 264-song catalog — built once (the
  // shipped path, never re-implemented). Empty catalog on a matrix-load failure.
  const searcher = useMemo(() => {
    const result = loadMatrix();
    return makeCatalogSearcher(toCatalog(result.ok ? result.matrix.nodes : []));
  }, []);

  // Identities already on the card — the consume-once dedup set (D-04).
  const onCardKeys = useMemo(
    () => new Set(card.squares.map(keyForDef)),
    [card],
  );

  const pct = (rate: number): number => Math.round(rate * 100);

  // Events section — all five, deduped against the card.
  const eventCandidates: SwapCandidate[] = useMemo(
    () =>
      EVENT_ORDER.map((event) => {
        const rate = coreConfig.bingo.fireRates.event[event] ?? 0;
        return {
          def: { kind: "event", event, label: EVENT_LABELS[event] },
          key: `event:${event}`,
          label: EVENT_LABELS[event],
          coverUrl: null,
          fireHint:
            event === "bustOut"
              ? copy.bustOutFireRateHint(pct(rate))
              : copy.fireRateHint(pct(rate)),
          rate,
        };
      }),
    [copy],
  );

  // Albums section — the pool ∩ ctx.albumSongIds, with cover art + fire-rate.
  const albumCandidates: SwapCandidate[] = useMemo(
    () =>
      coreConfig.bingo.albumSquarePool
        .filter((albumUrl) => ctx.albumSongIds.has(albumUrl))
        .map((albumUrl) => {
          const rate = coreConfig.bingo.fireRates.album[albumUrl] ?? 0;
          const label = nameMaps.albumTitle.get(albumUrl) ?? prettifyAlbumUrl(albumUrl);
          const slug = albumUrl.slice(albumUrl.lastIndexOf("/") + 1);
          return {
            def: { kind: "album", albumUrl, label },
            key: `album:${albumUrl}`,
            label,
            coverUrl: coverUrlFor(slug),
            fireHint: copy.fireRateHint(pct(rate)),
            rate,
          };
        }),
    [ctx, nameMaps, copy],
  );

  // Songs section — top recent-era songs by base rate, with cover art + fire-rate.
  const songCandidates: SwapCandidate[] = useMemo(
    () =>
      [...ctx.eraPlayRate.entries()]
        .sort((a, b) => b[1] - a[1] || a[0] - b[0])
        .slice(0, SONG_CANDIDATE_LIMIT)
        .map(([songId, era]) => {
          const rate = Math.min(1, era / coreConfig.bingo.eraShowCount);
          const label = nameMaps.songName.get(songId) ?? `Song ${songId}`;
          return {
            def: { kind: "song", songId, label },
            key: `song:${songId}`,
            label,
            coverUrl: coverUrlForSong(songId),
            fireHint: copy.fireRateHint(pct(rate)),
            rate,
          };
        }),
    [ctx, nameMaps, copy],
  );

  // Search results → song candidates (deduped against the card), only when typing.
  const searchCandidates: SwapCandidate[] = useMemo(() => {
    if (query.trim() === "") return [];
    return searcher(query).map((result) => {
      const rate = Math.min(1, (ctx.eraPlayRate.get(result.songId) ?? 0) / coreConfig.bingo.eraShowCount);
      return {
        def: { kind: "song", songId: result.songId, label: result.songName },
        key: `song:${result.songId}`,
        label: result.songName,
        coverUrl: coverUrlForSong(result.songId),
        fireHint: copy.fireRateHint(pct(rate)),
        rate,
      };
    });
  }, [query, searcher, ctx, copy]);

  const likelySongs = songCandidates.filter((c) => c.rate >= SONG_LIKELY_FRACTION);
  const stretchSongs = songCandidates.filter((c) => c.rate < SONG_LIKELY_FRACTION);

  const select = (candidate: SwapCandidate): void => {
    if (onCardKeys.has(candidate.key)) return; // dedup guard (already greyed)
    // Replace exactly the tapped square; card stays 16 squares w/ the free cell.
    const squares = card.squares.map((def, index) =>
      index === squareIndex ? candidate.def : def,
    );
    onApplySwap({ ...card, squares });
    setQuery("");
    onClose();
  };

  const handleReshuffleTap = (): void => {
    if (isCustom) {
      setConfirmReshuffle(true); // D-06: confirm before discarding custom swaps
      return;
    }
    onReshuffle(); // no custom swaps → re-deal silently
    onClose();
  };

  const confirmReshuffleNow = (): void => {
    setConfirmReshuffle(false);
    onReshuffle();
    onClose();
  };

  const handleClose = (): void => {
    setQuery("");
    setConfirmReshuffle(false);
    onClose();
  };

  const renderCandidate = (candidate: SwapCandidate) => {
    const disabled = onCardKeys.has(candidate.key);
    return (
      <button
        key={candidate.key}
        type="button"
        disabled={disabled}
        aria-disabled={disabled}
        onClick={() => select(candidate)}
        className="flex min-h-11 w-full items-center gap-3 rounded-md border border-hairline bg-elevated px-3 py-2 text-left touch-manipulation disabled:opacity-40"
      >
        {candidate.coverUrl != null ? (
          <img
            src={candidate.coverUrl}
            alt=""
            className="h-8 w-8 shrink-0 rounded object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-surface text-[10px] font-semibold text-text-muted">
            {candidate.label.slice(0, 2).toUpperCase()}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-base text-text-primary">
          {candidate.label}
        </span>
        <span className="shrink-0 text-[14px] font-semibold tabular-nums text-text-muted">
          {candidate.fireHint}
        </span>
      </button>
    );
  };

  const sectionHeader = (label: string) => (
    <p className="pt-2 text-[14px] font-semibold uppercase tracking-wide text-text-muted">
      {label}
    </p>
  );

  return (
    <Sheet open={open} onClose={handleClose} variant="bottom-sheet" ariaLabel={copy.swapSheetTitle}>
      {confirmReshuffle ? (
        // D-06 destructive confirm — the ONLY destructive control this phase.
        <div className="flex flex-col gap-3">
          <p className="text-[20px] font-semibold leading-tight text-text-primary">
            {copy.reshuffleConfirmHeading}
          </p>
          <p className="text-base leading-normal text-text-muted">
            {copy.reshuffleConfirmBody}
          </p>
          <button
            type="button"
            onClick={confirmReshuffleNow}
            className="flex min-h-11 w-full items-center justify-center rounded-md px-4 text-[14px] font-semibold text-white touch-manipulation"
            style={{ backgroundColor: "#ef4444" }}
          >
            {copy.reshuffleConfirmCta}
          </button>
          <button
            type="button"
            onClick={() => setConfirmReshuffle(false)}
            className="flex min-h-11 w-full items-center justify-center rounded-md border border-hairline px-4 text-[14px] font-semibold text-text-primary touch-manipulation"
          >
            {copy.reshuffleConfirmCancel}
          </button>
        </div>
      ) : (
        <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
          <p className="text-[20px] font-semibold leading-tight text-text-primary">
            {copy.swapSheetTitle}
          </p>

          {/* Events */}
          {sectionHeader(copy.swapSections.events)}
          <div className="flex flex-col gap-2">{eventCandidates.map(renderCandidate)}</div>

          {/* Albums */}
          {albumCandidates.length > 0 && (
            <>
              {sectionHeader(copy.swapSections.albums)}
              <div className="flex flex-col gap-2">{albumCandidates.map(renderCandidate)}</div>
            </>
          )}

          {/* Songs — sub-grouped Likely / A stretch */}
          {sectionHeader(copy.swapSections.songs)}
          {likelySongs.length > 0 && (
            <>
              <p className="text-[14px] leading-tight text-text-muted">{copy.swapSongGroups.likely}</p>
              <div className="flex flex-col gap-2">{likelySongs.map(renderCandidate)}</div>
            </>
          )}
          {stretchSongs.length > 0 && (
            <>
              <p className="text-[14px] leading-tight text-text-muted">{copy.swapSongGroups.stretch}</p>
              <div className="flex flex-col gap-2">{stretchSongs.map(renderCandidate)}</div>
            </>
          )}

          {/* Search */}
          {sectionHeader(copy.swapSections.search)}
          <div className="flex items-center gap-2 rounded-md border border-hairline bg-elevated px-3">
            <Search size={18} className="text-text-muted" />
            <input
              type="text"
              inputMode="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.swapSearchPlaceholder}
              aria-label={copy.swapSearchPlaceholder}
              className="min-h-11 flex-1 bg-transparent text-base leading-normal text-text-primary placeholder:text-text-muted focus:outline-none"
            />
          </div>
          {searchCandidates.length > 0 && (
            <div className="flex flex-col gap-2">{searchCandidates.map(renderCandidate)}</div>
          )}

          {/* Reshuffle whole card (D-06) */}
          <button
            type="button"
            onClick={handleReshuffleTap}
            className="mt-2 flex min-h-11 w-full items-center justify-center rounded-md border border-hairline px-4 text-[14px] font-semibold text-text-primary touch-manipulation"
          >
            {copy.reshuffleConfirmCta}
          </button>
        </div>
      )}
    </Sheet>
  );
}

/**
 * The post-show payoff screen (SHOW-14, STAT-02, D-13/D-14/D-15). RecapView ONLY
 * renders the pure core `RecapStats` from `deriveRecap`: the component contains
 * ZERO stat arithmetic (tally, source split, rarity score, new-catch detection
 * are all core) — it groups, labels, and formats only. Reachable two ways: it
 * auto-shows the instant a show ends (the ShowView recap seam, Task 3), and it is
 * reachable forever from the Dex Shows history (tracked rows, Task 1). A recap is
 * a pure derivation over persisted trackedEntries, so re-opening a past show
 * re-derives the identical scorecard — nothing is transient (T-06-22).
 *
 * Section order (06-UI-SPEC §Layout 3, top→bottom): heading + {date} · {venue} →
 * hero tally (Display) → source split → rarity block (score + tier chips ×count +
 * rarest of the night) → +N new catches (Sparkles; OMITTED at zero) → the final
 * setlist grouped by set, each row wearing its Phase-4 hit/miss ring + TierBadge
 * → footer Done. All kglw-derived song/venue names render as React text only
 * (T-06-21); the Share card CTA joins in 06-11 (no dead button here).
 */
import {
  buildBingoShareCard,
  buildRecapShareStats,
  deriveRecap,
  type RarityTier,
} from "@guezzer/core";
import { Share2, Sparkles } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { BingoBoard } from "../components/BingoBoard.tsx";
import { config } from "../config.ts";
import { db } from "../db/db.ts";
import { replayCard } from "../games/bingoReplay.ts";
import { loadMatrix } from "../show/matrix.ts";
import { loadArchive } from "./archive-loader.ts";
import { loadDexAlbums } from "./dex-albums-loader.ts";
import { getRarityIndex } from "./rarityIndex.ts";
import { ShareCardSheet } from "./ShareCardSheet.tsx";
import { TierBadge } from "./TierBadge.tsx";

/**
 * Phase-4 hit/miss ring hexes (04-UI-SPEC §Color B2), reused verbatim on recap
 * setlist rows — same meaning, same colors as the comet trail. Inline (mirroring
 * CometTrail) rather than a Tailwind token: these are semantic data colors.
 */
const RING_COLOR: Record<string, string> = {
  hit: "#22C55E",
  miss: "#EF4444",
};

/** Tier-chip render order — scarcest first (Legendary → Epic → Common). */
const TIER_ORDER: RarityTier[] = ["legendary", "epic", "rare", "uncommon", "common"];

interface RecapViewProps {
  /** The finalized (or active-and-ending) session to score. */
  sessionId: string;
  /** Done / dismiss — ShowView clears its recap state; Dex history closes the drill-in. */
  onClose: () => void;
}

export function RecapView({ sessionId, onClose }: RecapViewProps) {
  const copy = config.copy.recap;
  const setLabels = config.copy.dex.setLabels as Record<string, string>;
  const [shareOpen, setShareOpen] = useState(false);
  // A SECOND, independent sheet for the bingo trophy (BINGO-08) — the bingo card
  // is a distinct share target from the per-show recap card, so it gets its own
  // open state + pre-built File rather than swapping the recap sheet's data.
  const [bingoShareOpen, setBingoShareOpen] = useState(false);

  // Live reads — Dexie is the single source of truth (a rename/edit re-derives).
  const trackedShows = useLiveQuery(() => db.trackedShows.toArray());
  const trackedEntries = useLiveQuery(() => db.trackedEntries.toArray());
  const attendedShows = useLiveQuery(() => db.attendedShows.toArray());
  const archiveShows = useLiveQuery(() => db.archiveShows.toArray());
  // Phase-15 (BINGO-07, D-05): the persisted bingo cards. A row keyed to this
  // session drives the read-only replay board below; when none matches, NO Bingo
  // section renders (the `bingo` memo returns null → the block is absent).
  const bingoCards = useLiveQuery(() => db.bingoCards.toArray());

  // Guarded, memoized static artifacts + the module-memoized rarity index.
  const archiveResult = loadArchive();
  const albumsResult = loadDexAlbums();
  const matrixResult = loadMatrix();
  const rarity = getRarityIndex();

  const recap = useMemo(() => {
    if (!archiveResult.ok || !albumsResult.ok || rarity == null) return null;
    if (
      trackedShows === undefined ||
      trackedEntries === undefined ||
      attendedShows === undefined ||
      archiveShows === undefined
    ) {
      return null;
    }
    // deriveRecap is the ONLY math — the component renders its output.
    return deriveRecap(
      sessionId,
      { attendedShows, trackedShows, trackedEntries, archiveShows },
      archiveResult.archive,
      albumsResult.albums,
      rarity,
    );
  }, [
    sessionId,
    trackedShows,
    trackedEntries,
    attendedShows,
    archiveShows,
    archiveResult,
    albumsResult,
    rarity,
  ]);

  // Per-show share card (plan 10-02): the End-Show share must reflect ONLY the
  // night just tracked, not the lifetime GizzDex. Reuse the same `deriveRecap`
  // output (no re-derived catch logic) via the pure core projection, and hand
  // the result to the sheet so it builds the File from these show-scoped numbers.
  const shareData = useMemo(() => {
    if (recap == null || !archiveResult.ok) return undefined;
    const show = (trackedShows ?? []).find((s) => s.sessionId === sessionId);
    return buildRecapShareStats(recap, archiveResult.archive, {
      date: show?.date ?? "",
      venue: show?.venueName ?? null,
    });
  }, [recap, archiveResult, trackedShows, sessionId]);

  // Phase-15 replay board (BINGO-07, D-05/D-06/D-23). A PURE re-derivation over
  // the persisted trail via the shared `replayCard` adapter — marks are never
  // stored, so `live == replay == catch-up`. Returns null (→ section absent) when
  // this session has no card, or any loader/live read is not yet ready.
  const bingo = useMemo(() => {
    if (!matrixResult.ok || !archiveResult.ok || !albumsResult.ok || rarity == null) return null;
    if (bingoCards === undefined || trackedEntries === undefined) return null;
    const cardRow = bingoCards.find((c) => c.sessionId === sessionId);
    if (cardRow == null) return null; // D-05: no card → no Bingo section.
    const sessionEntries = trackedEntries.filter((e) => e.sessionId === sessionId);
    return replayCard(
      cardRow,
      sessionEntries,
      matrixResult.matrix,
      archiveResult.archive,
      rarity,
      albumsResult.albums,
    );
  }, [
    bingoCards,
    trackedEntries,
    sessionId,
    matrixResult,
    archiveResult,
    albumsResult,
    rarity,
  ]);

  // The bingo TROPHY share data (BINGO-08, D-22): the pure `buildBingoShareCard`
  // projection of this session's re-derived board + wins + show identity. A stable
  // memo ref so ShareCardSheet builds the File exactly once on open (Pitfall 7 —
  // no async before navigator.share). Undefined until the replay board resolves
  // (→ the share trigger only renders inside the `bingo != null` section anyway).
  const bingoShareData = useMemo(() => {
    if (bingo == null) return undefined;
    const bingoShow = (trackedShows ?? []).find((s) => s.sessionId === sessionId);
    return buildBingoShareCard(bingo.marked, bingo.wins, {
      date: bingoShow?.date ?? "",
      venue: bingoShow?.venueName ?? null,
    });
  }, [bingo, trackedShows, sessionId]);

  // Still resolving the live reads / a loader failed — hold a calm empty frame.
  if (recap == null) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={copy.heading}
        className="fixed inset-0 bg-surface"
        style={{ zIndex: config.ui.z.page }}
      />
    );
  }

  const show = (trackedShows ?? []).find((s) => s.sessionId === sessionId);
  const venue = show?.venueName ?? null;
  const subline = copy.subline(show?.date ?? "", venue);

  // songId → name from the derived rows (formatting lookup, not stat math).
  const nameById = new Map<number, string>();
  for (const set of recap.setlist) {
    for (const row of set.rows) if (row.songId != null) nameById.set(row.songId, row.songName);
  }

  // Tier chips = per-tier counts over the night's unique real songs. This is a
  // display aggregation over core-supplied per-row tiers — NOT tally/percentage
  // arithmetic (which stays entirely in deriveRecap).
  const tierBySong = new Map<number, RarityTier>();
  for (const set of recap.setlist) {
    for (const row of set.rows) {
      if (row.songId != null && row.tier != null) tierBySong.set(row.songId, row.tier);
    }
  }
  const tierCounts = new Map<RarityTier, number>();
  for (const tier of tierBySong.values()) tierCounts.set(tier, (tierCounts.get(tier) ?? 0) + 1);

  // recap != null guarantees the archive loaded; narrow for TS.
  const archiveSongs = archiveResult.ok ? archiveResult.archive.songs : {};
  const rarest = recap.rarity.rarestOfNight;
  const rarestName =
    rarest != null
      ? nameById.get(rarest.songId) ?? archiveSongs[String(rarest.songId)] ?? ""
      : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.heading}
      className="fixed inset-0 flex flex-col overflow-y-auto bg-surface"
      style={{ zIndex: config.ui.z.page }}
    >
      <div
        className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-6"
        // Intentional +24px (not +12px like the six other top surfaces): extra breathing
        // room for RecapView's menu-less layout. Deliberate exception (UX-01 / Open Q1) —
        // do NOT normalize to +12px.
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 24px)" }}
      >
        {/* Heading + {date} · {venue}, with the recap share as an icon button to the
            right of the title (it shares THIS show — same-line affordance, D-19). */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <h1 className="min-w-0 text-[20px] font-semibold leading-tight text-text-primary">
              {copy.heading}
            </h1>
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              aria-label={copy.shareRecapAria}
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent touch-manipulation"
            >
              <Share2 size={20} aria-hidden="true" />
            </button>
          </div>
          <p className="text-[14px] font-semibold leading-tight tabular-nums text-text-muted">
            {subline}
          </p>
        </div>

        {/* Hero tally (Display, tabular-nums) + caption. */}
        <div className="flex flex-col items-center gap-1 py-2">
          <p className="text-[28px] font-semibold leading-none tabular-nums text-text-primary">
            {copy.heroTally(recap.tally.hits, recap.tally.total, recap.tally.pct)}
          </p>
          <p className="text-[14px] font-semibold leading-tight text-text-muted">
            {copy.heroCaption}
          </p>
        </div>

        {/* Source split (D-14). */}
        <p className="text-base leading-normal text-text-muted">
          {copy.sourceSplit(
            recap.sourceSplit.manualHits,
            recap.sourceSplit.manualTotal,
            recap.sourceSplit.editorHits,
          )}
        </p>

        {/* Rarity block: score + tier chips ×count + rarest of the night. */}
        <div className="flex flex-col gap-2 rounded-md border border-hairline bg-elevated p-3">
          <p className="text-[14px] font-semibold leading-tight tabular-nums text-text-primary">
            {copy.showRarity(Math.round(recap.rarity.score))}
          </p>
          {tierCounts.size > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {TIER_ORDER.filter((tier) => tierCounts.has(tier)).map((tier) => (
                <span key={tier} className="flex items-center gap-1">
                  <TierBadge tier={tier} />
                  <span className="text-[14px] font-semibold tabular-nums text-text-muted">
                    {copy.tierCount(tierCounts.get(tier) ?? 0)}
                  </span>
                </span>
              ))}
            </div>
          )}
          {rarest != null && rarestName != null && (
            <div className="flex items-center gap-2">
              <span className="min-w-0 truncate text-base leading-normal text-text-primary">
                {copy.rarestOfNight(rarestName)}
              </span>
              <TierBadge tier={rarest.tier} />
            </div>
          )}
        </div>

        {/* +N new catches (Sparkles) — OMITTED entirely when zero (no "+0"). */}
        {recap.newCatches.count > 0 && (
          <div
            data-testid="recap-new-catches"
            className="flex items-center gap-2 text-base font-semibold leading-normal text-text-primary"
          >
            <Sparkles size={18} aria-hidden="true" />
            <span>{copy.newCatches(recap.newCatches.count)}</span>
          </div>
        )}

        {/* Final setlist grouped by set — each row wears its hit/miss ring. */}
        <div className="flex flex-col gap-4">
          {recap.setlist.map((set) => (
            <div key={set.n} className="flex flex-col">
              <p
                data-testid="recap-set-heading"
                className="mb-1 text-[14px] font-semibold leading-tight text-text-muted"
              >
                {setLabels[set.n] ?? set.n}
              </p>
              {set.rows.map((row, i) => (
                <div
                  key={`${set.n}-${i}`}
                  data-testid="recap-row"
                  data-outcome={row.outcome}
                  className="flex min-h-11 items-center gap-2 border-b border-hairline py-2"
                >
                  {row.isPlaceholder ? (
                    <span
                      aria-hidden="true"
                      className="h-[18px] w-[18px] shrink-0 rounded-full border border-hairline bg-surface"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="h-[18px] w-[18px] shrink-0 rounded-full border-2 bg-surface"
                      style={{ borderColor: RING_COLOR[row.outcome] }}
                    />
                  )}
                  <span
                    className={`min-w-0 flex-1 truncate text-base leading-normal ${
                      row.isPlaceholder ? "text-text-muted" : "text-text-primary"
                    }`}
                  >
                    {row.songName}
                  </span>
                  {row.tier != null && <TierBadge tier={row.tier} />}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Bingo replay (BINGO-07, D-05/D-06) — a read-only frozen board, present
            ONLY when this session has a card. Pure re-derivation; NO tap-to-mark
            (D-04), NO celebration (Phase 16). All labels/song names are escaped
            React text (T-06-21). */}
        {bingo != null && (
          <div className="flex flex-col gap-3">
            {/* Bingo title + the trophy share as an icon button to its right (it
                shares the BINGO card — BINGO-08/D-22). */}
            <div className="flex items-center justify-between gap-3">
              <h2 className="min-w-0 text-[20px] font-semibold leading-tight text-text-primary">
                {copy.bingoHeading}
              </h2>
              <button
                type="button"
                onClick={() => setBingoShareOpen(true)}
                aria-label={copy.shareBingoAria}
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent touch-manipulation"
              >
                <Share2 size={20} aria-hidden="true" />
              </button>
            </div>

            {/* Win badges (earned-payoff accent chips) or the honest no-win line. */}
            {bingo.wins.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {bingo.wins.map((win, i) => (
                  <span
                    key={`${win.kind}-${i}`}
                    className="rounded-full px-2 py-1 text-[14px] font-semibold"
                    // Accent gold chip (#F2C14E) — the restrained replay payoff; the
                    // big supernova is Phase 16 (15-UI-SPEC §Color).
                    style={{ backgroundColor: "#F2C14E", color: "#0C0C10" }}
                  >
                    {copy.bingoWinLabels[win.kind]}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[14px] leading-tight text-text-muted">{copy.bingoNoWin}</p>
            )}

            {/* 4×4 read-only replay board — the ONE shared <BingoBoard> (BINGO-04).
                `captionMode="persistent"` renders the always-on "lit by {song}"
                caption (Phase-15 D-06); read-only, so NO `onSquareTap` and NO
                one-away glow. Marked → caught-green #22C55E; unmarked → elevated
                #17171F / hairline; the free center wears the marked treatment. */}
            <BingoBoard
              captionMode="persistent"
              marked={bingo.marked}
              wins={bingo.wins}
              songNameByPosition={bingo.songNameByPosition}
            />
          </div>
        )}

        {/* Footer — Done is now the PRIMARY action (accent); both share triggers
            moved up beside their respective titles as icon buttons. */}
        <div
          className="mt-auto flex flex-col gap-2 pt-4 pb-4"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 w-full items-center justify-center rounded-md bg-accent px-4 text-[14px] font-semibold text-surface touch-manipulation"
          >
            {copy.done}
          </button>
        </div>
      </div>

      {/* Share-card preview sheet (SHAR-02) — PER-SHOW data (plan 10-02): the
          card reflects only the night just tracked, not the lifetime dex. */}
      <ShareCardSheet open={shareOpen} onClose={() => setShareOpen(false)} data={shareData} />

      {/* Bingo trophy sheet (BINGO-08) — bingo-scoped `ShareCardData`; the sheet
          pre-builds the PNG File on open exactly as the per-show path does. */}
      <ShareCardSheet
        open={bingoShareOpen}
        onClose={() => setBingoShareOpen(false)}
        data={bingoShareData}
      />
    </div>
  );
}

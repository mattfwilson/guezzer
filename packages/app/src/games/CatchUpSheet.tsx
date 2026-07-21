/**
 * BINGO-06 catch-up surface (plan 15-04, 15-UI-SPEC §Interaction Contracts).
 *
 * A late-joining user opens "Catch me up" and sees a PRE-CHECKED confirm-list of
 * the `latest`-feed songs the tracker missed (glance-and-correct, never a silent
 * bulk auto-adopt — D-03). Unticking a wrong row drops it; tapping "Add {n}"
 * commits each still-checked row via the shipped `adoptSuggestion` path (one call
 * per row, exactly as `ShowView.handleAdopt`). Catch-up NEVER touches a bingo
 * square directly — it grows the trail and `deriveMarks` re-lights squares as a
 * pure consequence (D-04/D-23), keeping the honest hit/miss denominator (each add
 * carries `shownFanSongIds: []` → classified as a MISS, consistent with a search).
 *
 * The manual path ("Search to add a song") reuses the shipped fuse.js catalog
 * SearchSheet → `logSong` miss (D-04) — identical to `ShowView.handleSearchSelect`.
 * It is ALWAYS offered, even when the feed is unavailable/offline, so catch-up is
 * never a dead end.
 *
 * All copy is read from `config.copy.catchUp.*`; kglw-derived song names render as
 * escaped React text only — never `dangerouslySetInnerHTML` (T-15-10/T-15-11).
 */
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Sheet } from "../components/Sheet.tsx";
import { config } from "../config.ts";
import { adoptSuggestion, logSong } from "../db/db.ts";
import { SearchSheet, type SearchSelection } from "../show/SearchSheet.tsx";

/** A tracker-missed feed song offered in the pre-checked confirm-list. */
export interface CatchUpCandidate {
  songId: number;
  songName: string;
}

interface CatchUpSheetProps {
  open: boolean;
  onClose: () => void;
  /** The active session the adopted/searched songs are committed to. */
  sessionId: string;
  /**
   * The tracker-missed candidate list — the guarded `latest` rows NOT already in
   * the trail (built by ShowView). Pre-checked on render (D-03).
   */
  candidates: CatchUpCandidate[];
  /**
   * True when the live feed could not be reached (offline). Shows the feed-error
   * copy but STILL offers the manual search path — never a dead end.
   */
  feedError?: boolean;
}

export function CatchUpSheet({
  open,
  onClose,
  sessionId,
  candidates,
  feedError = false,
}: CatchUpSheetProps) {
  const copy = config.copy.catchUp;
  // Pre-checked confirm-list (D-03): every candidate starts ticked; unticking
  // drops a wrong row.
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [searchOpen, setSearchOpen] = useState(false);
  // Song ids already folded into `checked` this open-session. Lets a later
  // `latest` poll add NEWLY-surfaced misses (pre-checked) without touching rows
  // the user already unticked. Without this, the parent hands us a fresh
  // `candidates` array every poll and a naive full re-seed would silently wipe
  // the user's corrections mid-show, then re-adopt mis-scraped songs (CR-01).
  const seenIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    // Closed: forget everything so the next open starts fresh (all pre-checked).
    if (!open) {
      seenIdsRef.current = new Set();
      setChecked(new Set());
      return;
    }
    // Open: seed on first run, then only ADD candidates we have not seen yet —
    // preserving any unticks the user made since the sheet opened.
    setChecked((prev) => {
      const next = new Set(prev);
      for (const c of candidates) {
        if (!seenIdsRef.current.has(c.songId)) next.add(c.songId);
      }
      return next;
    });
    seenIdsRef.current = new Set(candidates.map((c) => c.songId));
  }, [open, candidates]);

  const close = () => {
    setSearchOpen(false);
    onClose();
  };

  const toggle = (songId: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return next;
    });
  };

  // Add {n}: one adoptSuggestion call per still-checked row (D-03) — NOT a silent
  // bulk auto-adopt. Each backfill carries shownFanSongIds:[] (no on-screen fan
  // predicted it) → classifyOutcome MISS, keeping the denominator honest.
  const handleAdd = () => {
    for (const candidate of candidates) {
      if (!checked.has(candidate.songId)) continue;
      void adoptSuggestion(sessionId, {
        songId: candidate.songId,
        songName: candidate.songName,
        shownFanSongIds: [],
      });
    }
    close();
  };

  // Manual add (D-04) — mirrors ShowView.handleSearchSelect: a search log is
  // always a MISS (shownFanSongIds:[]), and it grows the trail via the SAME path.
  const handleManualSelect = (selection: SearchSelection) => {
    void logSong(sessionId, {
      songId: selection.songId,
      songName: selection.songName,
      outcome: "miss",
      shownFanSongIds: [],
      isPlaceholder: false,
      loggedAt: Date.now(),
    });
    close();
  };

  // No-match "Log as ???" → an instant placeholder miss (renamable later), still
  // a trail-grow through the shared path (never a dead end).
  const handleManualUnknown = () => {
    void logSong(sessionId, {
      songId: null,
      songName: config.copy.show.unknownCta,
      outcome: "miss",
      shownFanSongIds: [],
      isPlaceholder: true,
      loggedAt: Date.now(),
    });
    close();
  };

  // The manual SearchSheet takes over the surface while open (mirrors
  // TrailNodeSheet's search swap). Its Close returns to the confirm-list.
  if (open && searchOpen) {
    return (
      <SearchSheet
        open
        onClose={() => setSearchOpen(false)}
        onSelect={handleManualSelect}
        onUnknown={handleManualUnknown}
      />
    );
  }

  const hasCandidates = candidates.length > 0;
  const checkedCount = candidates.reduce(
    (n, c) => (checked.has(c.songId) ? n + 1 : n),
    0,
  );

  return (
    <Sheet open={open} onClose={close} variant="bottom-sheet" ariaLabel={copy.heading}>
      <p className="text-[20px] font-semibold leading-tight text-text-primary">
        {copy.heading}
      </p>

      {hasCandidates ? (
        <>
          <p className="mt-2 text-base leading-normal text-text-muted">
            {copy.body}
          </p>

          {/* Pre-checked confirm-list — each row a ≥44px checkbox the user can
              untick. Song name is escaped React text only (T-15-11). */}
          <ul className="mt-3 flex flex-col gap-2">
            {candidates.map((candidate) => (
              <li key={candidate.songId}>
                <label className="flex min-h-11 w-full items-center gap-3 rounded-md border border-hairline bg-elevated px-4 py-2 text-left text-base leading-normal text-text-primary touch-manipulation">
                  <input
                    type="checkbox"
                    checked={checked.has(candidate.songId)}
                    onChange={() => toggle(candidate.songId)}
                    className="h-5 w-5 shrink-0 accent-[#22C55E]"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {candidate.songName}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={handleAdd}
            disabled={checkedCount === 0}
            className="mt-4 flex min-h-11 w-full items-center justify-center rounded-md bg-elevated px-4 text-[14px] font-semibold text-text-primary touch-manipulation disabled:opacity-50"
          >
            {copy.addN(checkedCount)}
          </button>
        </>
      ) : (
        // Nothing-to-add (all caught up) OR feed-unavailable — the latter STILL
        // offers manual search below, so it is never a dead end.
        <p className="mt-2 text-base leading-normal text-text-muted">
          {feedError ? copy.feedError : copy.allCaughtUp}
        </p>
      )}

      {/* Manual search — always offered (offline-safe fallback, D-04). */}
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-hairline px-4 text-[14px] font-semibold text-text-primary touch-manipulation"
      >
        <Search size={18} />
        {copy.searchAffordance}
      </button>
    </Sheet>
  );
}

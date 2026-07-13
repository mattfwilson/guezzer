/**
 * Root of `#/show` (04-UI-SPEC §Layout; Component Inventory). Branches the whole
 * Show-Mode lifecycle off the single active show (D-03), driven entirely by the
 * reactive `useShowSession` — Dexie is the source of truth (SHOW-11):
 *
 *   - no active show          → PreShowLauncher (Start Show, D-01/D-02)
 *   - active, matrix unloaded  → calm model-load-failure state (T-04-09, ASVS V7);
 *                                blocks ONLY the orbit, never the AppShell nav
 *   - active, currentSongId==null → the orbit stage with the CenterNode
 *                                "Tap the opener" prompt and NO fan; predict() is
 *                                never called without a real current song. The
 *                                live opener seed (via Search) lands in 04-05.
 *   - active, current song     → the full orbit (CenterNode + adaptive fan)
 *
 * Recenter orchestration (SHOW-03): a plain orb tap logs a HIT (a tapped orb is
 * by definition in the shown fan, D-06), appends + recenters. `logSong` is a
 * write-through — it awaits the Dexie add before `useLiveQuery` recomputes the
 * new centre + re-predicts (T-04-10 no-loss timing). The Info dot opens the
 * "why" and NEVER logs (D-11).
 *
 * AppShell scroll seam (RESEARCH Pitfall 5, resolved here): the orbit stage must
 * NOT scroll/rubber-band (SHOW-13). Resolution = AppShell disables its `<main>`
 * `overflow-y-auto` for `#/show` (see App.tsx `scroll={route !== "show"}`), and
 * ShowView owns a full-height non-scrolling flex column so the OrbitStage is a
 * `flex-1` child that never overflows. The ActionBar + CometTrail slots land in
 * 04-05/04-06.
 */
import { useEffect, useRef, useState } from "react";
import { CircleStop } from "lucide-react";
import { config } from "../config.ts";
import {
  logSong,
  markEncore,
  markSetBreak,
  undoLast,
  type TrackedEntry,
} from "../db/db.ts";
import { acquireWakeLock, releaseWakeLock } from "../wakeLock.ts";
import { classifyOutcome } from "./scoring.ts";
import { ActionBar } from "./ActionBar.tsx";
import { CometTrail } from "./CometTrail.tsx";
import { EndShowDialog } from "./EndShowDialog.tsx";
import { OrbitStage } from "./OrbitStage.tsx";
import { TallyReadout } from "./TallyReadout.tsx";
import { TrailNodeSheet } from "./TrailNodeSheet.tsx";
import { PreShowLauncher } from "./PreShowLauncher.tsx";
import { SearchSheet, type SearchSelection } from "./SearchSheet.tsx";
import { WakeLockNotice } from "./WakeLockNotice.tsx";
import { WhyDetail } from "./WhyDetail.tsx";
import { useShowSession } from "./useShowSession.ts";
import type { OrbitCandidate } from "./PredictionOrb.tsx";

export function ShowView() {
  const session = useShowSession();
  const [whyCandidate, setWhyCandidate] = useState<OrbitCandidate | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [trailNode, setTrailNode] = useState<TrackedEntry | null>(null);
  const [endOpen, setEndOpen] = useState(false);
  const [wakeNoticeVisible, setWakeNoticeVisible] = useState(false);
  const wakeDismissedRef = useRef(false);
  const copy = config.copy.show;

  // Hold a screen wake lock while a show is active (SHOW-12); reacquire on
  // return-to-visible is handled inside wakeLock.ts. The effect runs before the
  // early returns below (hooks must be unconditional), keyed off whether a show
  // is active — finalizing (End Show) flips it false and the cleanup releases.
  // onUnsupported shows the calm once-per-show notice (Pitfall 1: installed iOS
  // PWA < 18.4 resolves a false-positive lock that never holds).
  const isActive = Boolean(session.active);

  // Reset the once-per-show wake-lock notice whenever a NEW active show begins
  // (WR-03/SHOW-12/D-09). ShowView stays mounted across the
  // end-show → pre-show → start-show transition (App.tsx keeps #/show mounted;
  // session.active merely toggles), so without this reset the dismissed-flag
  // would leak from night 1 into night 2 — degrading the intended once-per-show
  // signal to once-per-app-session and silently letting the screen dim mid-set.
  const activeSessionId = session.active?.sessionId;
  useEffect(() => {
    wakeDismissedRef.current = false;
    setWakeNoticeVisible(false);
  }, [activeSessionId]);

  useEffect(() => {
    if (!isActive) return;
    void acquireWakeLock(() => {
      if (!wakeDismissedRef.current) setWakeNoticeVisible(true);
    });
    return () => {
      void releaseWakeLock();
    };
  }, [isActive]);

  // No active show → the pre-show launcher (D-01/D-03).
  if (!session.active) {
    return <PreShowLauncher />;
  }

  // Bundled matrix failed its schemaVersion guard → a calm full-stage failure
  // state instead of a crash (T-04-09, ASVS V7). Blocks only the orbit; the
  // AppShell header + bottom nav stay usable.
  if (!session.matrixOk) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <h1 className="text-[20px] font-semibold leading-tight text-text-primary">
          {copy.modelLoadFailureHeading}
        </h1>
        <p className="mt-2 text-base leading-normal text-text-muted">
          {copy.modelLoadFailureBody}
        </p>
      </div>
    );
  }

  const { sessionId } = session.active;

  // Tap orb → log a hit + recenter (SHOW-03). `classifyOutcome` against the
  // shown fan confirms "hit" (a tapped orb is always in the fan, D-06). logSong
  // stamps position + setNumber itself (04-01 snapshot semantics), so neither is
  // passed here. The write-through drives the recenter via useLiveQuery.
  const handleTapOrb = (candidate: OrbitCandidate) => {
    const outcome = classifyOutcome(candidate.songId, session.shownFanSongIds);
    void logSong(sessionId, {
      songId: candidate.songId,
      songName: candidate.songName,
      outcome,
      shownFanSongIds: session.shownFanSongIds,
      isPlaceholder: false,
      loggedAt: Date.now(),
    });
  };

  // ??? → an instant placeholder MISS with NO confirm (D-14/SHOW-05). songId is
  // null and isPlaceholder true (renamable later from the trail, D-15); the
  // shown fan at log time is the honest hit denominator (empty pre-opener, D-08).
  // The write-through recenters via useLiveQuery.
  const handleUnknown = () => {
    void logSong(sessionId, {
      songId: null,
      songName: copy.unknownCta,
      outcome: "miss",
      shownFanSongIds: session.shownFanSongIds,
      isPlaceholder: true,
      loggedAt: Date.now(),
    });
  };

  // Search-select → a MISS (a search log is never a hit, D-06/D-08) that ALSO
  // seeds the opener from the pre-opener state: pre-opener `shownFanSongIds` is
  // empty (nothing predicted it → honest miss) and this real songId becomes the
  // new currentSongId, so useShowSession renders the first prediction fan —
  // closing the slice-1 live loop. No confirm; as fast as a hit tap (SHOW-04).
  const handleSearchSelect = (selection: SearchSelection) => {
    void logSong(sessionId, {
      songId: selection.songId,
      songName: selection.songName,
      outcome: "miss",
      shownFanSongIds: session.shownFanSongIds,
      isPlaceholder: false,
      loggedAt: Date.now(),
    });
    setSearchOpen(false);
  };

  // Secondary-row wiring (04-06). Set break/Encore only shift the show's
  // snapshotted set number (subsequent logs stamp "2"/"e", SHOW-06) — neither
  // ends the show (D-04). Undo removes the most recent entry in one tap with NO
  // dialog (the common "oops", D-15); the write-through recenters via useLiveQuery.
  const handleSetBreak = () => void markSetBreak(sessionId);
  const handleEncore = () => void markEncore(sessionId);
  const handleUndo = () => void undoLast(sessionId);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {/* Region 1 — Show-Mode header slot extending the AppShell chrome: the
          auto-stamped date (D-01) left, the persistent hit/miss tally right
          (SHOW-09, always visible incl. the 0/0 · — zero-state). text-primary,
          never accent. AppShell owns the app-global header; ShowView owns this
          show-specific sub-header row. */}
      <div className="flex shrink-0 items-center justify-between border-b border-hairline bg-elevated px-4 py-2">
        <span className="tabular-nums text-[14px] leading-tight text-text-muted">
          {session.active.date}
        </span>
        <div className="flex items-center gap-3">
          <TallyReadout tally={session.tally} />
          {/* End Show finalize control (D-04) — opens a destructive confirm; it
              never ends the show on this tap. Required before the next night can
              start (D-03/D-04). Never accent (gold is Start Show only). */}
          <button
            type="button"
            onClick={() => setEndOpen(true)}
            className="flex min-h-11 items-center gap-1 rounded-md border border-hairline px-2 text-[14px] font-semibold text-text-primary touch-manipulation"
          >
            <CircleStop size={18} />
            {copy.endCta}
          </button>
        </div>
      </div>

      {/* SHOW-12 fallback: shown once per show only when the wake lock is
          unsupported/false-positive. The reacquire path is silent (no copy). */}
      <WakeLockNotice
        visible={wakeNoticeVisible}
        onDismiss={() => {
          wakeDismissedRef.current = true;
          setWakeNoticeVisible(false);
        }}
      />

      {/* Region 2 — the comet trail (SHOW-08): last ~4 diminishing hit/miss-ringed
          nodes, +N compression at 30. Reactive over the live entries; returns
          null pre-opener. Node taps open the TrailNodeSheet for edit/delete/rename. */}
      <CometTrail entries={session.entries} onNodeTap={setTrailNode} />

      {/* Region 3 — the orbit stage. Pre-opener (currentSongId === null): the
          CenterNode shows the "Tap the opener" prompt and NO fan is passed, so
          predict() is never exercised without a real current song (04-05). */}
      <OrbitStage
        currentSong={session.currentSong}
        candidates={session.currentSongId === null ? [] : session.fan}
        onTapOrb={handleTapOrb}
        onWhy={setWhyCandidate}
      />

      {/* Region 4 — the persistent D-13 action bar, mounted in BOTH the
          pre-opener and active-fan states (the opener is always enterable via
          Search). The CometTrail (SHOW-08) slot lands in 04-06. */}
      <ActionBar
        onSearch={() => setSearchOpen(true)}
        onUnknown={handleUnknown}
        onSetBreak={handleSetBreak}
        onEncore={handleEncore}
        onUndo={handleUndo}
      />

      {/* Fuzzy catalog search over core searchCatalog — opener-seed + mid-show
          miss (SHOW-04); no-match offers ??? inline. */}
      <SearchSheet
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={handleSearchSelect}
        onUnknown={() => {
          handleUnknown();
          setSearchOpen(false);
        }}
      />

      {/* Older-entry edit / delete (confirm) / rename-??? from a trail tap
          (SHOW-07/D-15). Deleting recomputes the tally via useLiveQuery. */}
      <TrailNodeSheet entry={trailNode} onClose={() => setTrailNode(null)} />

      {/* End Show finalize confirm (D-04) — on confirm calls endShow(sessionId),
          flipping the show read-only so a new night can start (D-03). */}
      <EndShowDialog
        open={endOpen}
        sessionId={sessionId}
        onClose={() => setEndOpen(false)}
      />

      <WhyDetail candidate={whyCandidate} onClose={() => setWhyCandidate(null)} />
    </div>
  );
}

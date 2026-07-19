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
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import {
  bindShowFromLatest,
  diffLatestAgainstTrail,
  resolvePlaceholders,
  type FillHint,
  type LatestSetlistRow,
  type Suggestion,
} from "@guezzer/core";
import { config } from "../config.ts";
import {
  adoptSuggestion,
  bindShow,
  logSong,
  markEncore,
  markSetBreak,
  renameEntry,
  undoLast,
  type TrackedEntry,
} from "../db/db.ts";
import { acquireWakeLock, releaseWakeLock } from "../wakeLock.ts";
import { useLatestPoll } from "../live/useLatestPoll.ts";
import { useOnlineStatus } from "../live/useOnlineStatus.ts";
import { SuggestionStrip } from "../live/SuggestionStrip.tsx";
import { SyncDot } from "../live/SyncDot.tsx";
import { RecapView } from "../dex/RecapView.tsx";
import { coverUrlList } from "../dex/covers.ts";
import { coverUrlForSong } from "../dex/song-cover.ts";
import { classifyOutcome } from "./scoring.ts";
import { FabMenu } from "./FabMenu.tsx";
import { ShowBackground } from "./ShowBackground.tsx";
import { CometTrail } from "./CometTrail.tsx";
import { EndShowDialog } from "./EndShowDialog.tsx";
import { OrbitStage } from "./OrbitStage.tsx";
import { TallyReadout } from "./TallyReadout.tsx";
import { TrailNodeSheet } from "./TrailNodeSheet.tsx";
import { PreShowLauncher } from "./PreShowLauncher.tsx";
import { SearchSheet, type SearchSelection } from "./SearchSheet.tsx";
import { getOpenerSuggestions } from "./openerSuggestions.ts";
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
  // D-13 recap seam (06-09): set by EndShowDialog.onEnded when a show finalizes.
  const [recapSessionId, setRecapSessionId] = useState<string | null>(null);
  const [wakeNoticeVisible, setWakeNoticeVisible] = useState(false);
  const wakeDismissedRef = useRef(false);
  const copy = config.copy.show;
  const reduce = useReducedMotion() ?? false;

  // POLISH (260717-02n / 260717-ij8): ambient LiveGizz background. Seeded with one
  // random bundled album cover at mount (stable across the pre-show → active →
  // end-show transitions). BEFORE any next song is selected, this now CYCLES to a
  // different random cover every PRESHOW_CYCLE_MS (see the effect below) so the
  // pre-show backdrop reads as living texture; the crossfade is ShowBackground's
  // own (it fades whenever coverUrl changes). null (no covers) → plain surface.
  const [ambientCover, setAmbientCover] = useState<string | null>(() => {
    const urls = coverUrlList();
    return urls.length > 0 ? urls[Math.floor(Math.random() * urls.length)] : null;
  });

  // (260717-gvm) Drive the ambient background off the currently-selected next
  // song — BOTH selection paths (tap-orb, search-select) funnel through
  // session.currentSongId, so this one value covers them with no handler edits.
  // selectedCover is the album cover of the current song, or null when that song
  // has no committed art (or is pre-opener). To avoid an art-less selection
  // reverting to the random ambient cover (or flashing empty), remember the last
  // REAL album cover shown and fall back to it; only the random cover backstops
  // the true pre-opener / no-covers-bundled state.
  const selectedCover =
    session.currentSongId != null ? coverUrlForSong(session.currentSongId) : null;
  const [lastSelectedCover, setLastSelectedCover] = useState<string | null>(null);
  useEffect(() => {
    if (selectedCover != null) setLastSelectedCover(selectedCover);
  }, [selectedCover]);

  // (260717-ij8) Cycle the ambient cover ONLY while no next song is selected —
  // i.e. the true pre-opener state (selectedCover == null && lastSelectedCover ==
  // null) — and not under reduced-motion. The instant a song is (or ever was)
  // selected the gate flips false, the interval is cleaned up, and the fallback
  // chain below locks the background to that album cover. <2 covers → no cycle.
  const cycling = selectedCover == null && lastSelectedCover == null && !reduce;
  useEffect(() => {
    if (!cycling) return;
    const urls = coverUrlList();
    if (urls.length < 2) return;
    const pickDifferent = (prev: string | null): string => {
      // Offset a random index by 1..len-1 from prev so we never re-pick prev —
      // ShowBackground no-ops identical URLs, so this guarantees a real crossfade.
      const prevIdx = prev == null ? -1 : urls.indexOf(prev);
      if (prevIdx < 0) return urls[Math.floor(Math.random() * urls.length)];
      const offset = 1 + Math.floor(Math.random() * (urls.length - 1));
      return urls[(prevIdx + offset) % urls.length];
    };
    const id = setInterval(() => {
      setAmbientCover((prev) => pickDifferent(prev));
    }, config.show.background.PRESHOW_CYCLE_MS);
    return () => clearInterval(id);
  }, [cycling]);

  const targetCover = selectedCover ?? lastSelectedCover ?? ambientCover;

  // Wrap a page state in the blurred+dimmed cover backdrop. The frame is the
  // positioned parent (`relative`) the ShowBackground fills; content rides a
  // `config.ui.z.content` column that reproduces the page's full-height
  // non-scrolling flex layout (SHOW-13). Reused by all three in-page states
  // (recap is excluded).
  const withBackground = (content: ReactNode) => (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      <ShowBackground coverUrl={targetCover} />
      <div
        className="relative flex h-full min-h-0 flex-1 flex-col"
        style={{ zIndex: config.ui.z.content }}
      >
        {content}
      </div>
    </div>
  );

  // ── Live sync (Plan 05-04) ─────────────────────────────────────────────────
  // The one poll timer is owned here: gated on active-show + online + visible
  // (SYNC-01/SYNC-03), it write-throughs the raw latest rows into local state.
  // Mounted UNCONDITIONALLY above the early returns (same discipline as the
  // wake-lock effect) so hook order never changes across the show lifecycle.
  const [latestRows, setLatestRows] = useState<LatestSetlistRow[]>([]);
  const online = useOnlineStatus();
  useLatestPoll(session.active, setLatestRows);

  // Dismissed advisory rows (by song id) — non-destructive, local-only (SYNC-02).
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());

  // One-time offline reassurance line (D-08): appears on an online→offline drop
  // and auto-clears on return-to-online. A calm LINE, never a banner.
  const [offlineNoticeVisible, setOfflineNoticeVisible] = useState(false);
  useEffect(() => {
    setOfflineNoticeVisible(!online);
  }, [online]);

  // Advisory suggestions = the next 1–2 un-logged editor songs (deduped by the
  // pure core diff, D-02) plus fill-??? hints (D-04), recomputed when the
  // latest rows, the trail, or dismissals change — the orbit never re-lays-out
  // (SHOW-02). dismissedIds is passed INTO the diff (not post-filtered) so a
  // dismissed song frees its slot and the next editor song slides in (D-01 —
  // UAT Test 2 found the old post-filter emptied the strip after 2 dismissals).
  const suggestions = useMemo(
    () =>
      diffLatestAgainstTrail(
        latestRows,
        session.entries,
        config.live.SUGGESTION_COUNT,
        dismissedIds,
      ),
    [latestRows, session.entries, dismissedIds],
  );
  const fillHints = useMemo(
    () => resolvePlaceholders(latestRows, session.entries),
    [latestRows, session.entries],
  );

  // D-07 guarded auto-bind: after a poll, if the show is unbound AND latest's
  // date matches this show's date, write the canonical show_id/venue once. The
  // wrong-show/date guard + never-overwrite live in the pure core decision fn.
  const activeShow = session.active;
  useEffect(() => {
    if (!activeShow) return;
    if (activeShow.showId !== null) return;
    const binding = bindShowFromLatest(latestRows, activeShow, activeShow.date);
    if (binding) void bindShow(activeShow.sessionId, binding);
  }, [latestRows, activeShow]);

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
    // A new night starts with a clean advisory strip — dismissals don't leak
    // across shows (ShowView stays mounted; session.active merely toggles).
    setDismissedIds(new Set());
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

  // D-13 recap seam (06-09) — LOAD-BEARING ORDER (RESEARCH Pattern 6): confirming
  // End Show finalizes the session synchronously, so the `!session.active` early
  // return below fires the instant the show ends. The recap MUST be checked FIRST
  // or the payoff screen is swallowed. Done clears recapSessionId → the pre-show
  // launcher then renders. A finalized recap is a pure re-derivation over the
  // persisted trackedEntries, so it stays reachable from Dex history forever.
  if (recapSessionId != null) {
    return (
      <RecapView sessionId={recapSessionId} onClose={() => setRecapSessionId(null)} />
    );
  }

  // No active show → the pre-show launcher (D-01/D-03).
  if (!session.active) {
    return withBackground(<PreShowLauncher />);
  }

  // Bundled matrix failed its schemaVersion guard → a calm full-stage failure
  // state instead of a crash (T-04-09, ASVS V7). Blocks only the orbit; the
  // AppShell header + bottom nav stay usable.
  if (!session.matrixOk) {
    return withBackground(
      <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <h1 className="text-[20px] font-semibold leading-tight text-text-primary">
          {copy.modelLoadFailureHeading}
        </h1>
        <p className="mt-2 text-base leading-normal text-text-muted">
          {copy.modelLoadFailureBody}
        </p>
      </div>,
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

  // Adopt an editor suggestion (D-03): a no-confirm advisory→logged fast path.
  // adoptSuggestion stamps source:"editor" and classifies hit/miss against the
  // fan on screen with the SAME rule as a manual log — the tally stays honest
  // (T-05-10). The write-through re-derives the trail/tally + drops the adopted
  // song out of the strip (deduped, D-02) via useLiveQuery — no useState mirror.
  const handleAdopt = (suggestion: Suggestion) => {
    void adoptSuggestion(sessionId, {
      songId: suggestion.songId,
      songName: suggestion.songName,
      shownFanSongIds: session.shownFanSongIds,
    });
  };

  // Dismiss is non-destructive: nothing is logged, manual tracking untouched
  // (SYNC-02). The row is filtered out of the strip locally by song id (D-01).
  const handleDismiss = (songId: number) => {
    setDismissedIds((prev) => new Set(prev).add(songId));
  };

  // Fill a "???" placeholder from the editor's name (D-04) — user-initiated via
  // the Pencil control (never auto-applied). Reuses TrailNodeSheet's rename-path
  // classification: re-classify the outcome against the placeholder entry's own
  // stored fan so filling it honestly flips hit/miss, then write via renameEntry.
  const handleFill = (hint: FillHint) => {
    const entry = session.entries.find((e) => e.position === hint.entryPosition);
    if (entry?.id == null) return;
    const outcome = entry.shownFanSongIds
      ? classifyOutcome(hint.songId, entry.shownFanSongIds)
      : entry.outcome;
    void renameEntry(entry.id, hint.songId, hint.songName, outcome);
  };

  // Dismissals are already excluded inside the diff (slot-freeing, D-01);
  // fill-hints still post-filter since resolvePlaceholders is position-keyed.
  const visibleSuggestions = suggestions;
  const visibleFillHints = fillHints.filter((h) => !dismissedIds.has(h.songId));

  // Opener seeded ⇒ a fan is live. Drives the SuggestionStrip slot reservation
  // (SHOW-02 no-relayout mid-show) and the matching FAB bottom offset. Pre-opener
  // both collapse so the "Search for the opener" orb centers with no blank bar.
  const openerSeeded = session.currentSongId !== null;

  // The FAB lifts above the SuggestionStrip only when it is actually RENDERING
  // rows (advisory suggestions or fill-??? hints) — NOT merely when the fixed slot
  // is reserved. An empty (reserved-but-invisible) strip has nothing to overlap,
  // so the FAB stays in its resting corner and only repositions when a row is
  // genuinely there to clear (owner 2026-07-19, FabMenu.stripHasContent). Mirrors
  // the strip's own `hasContent` (suggestions or fill hints present).
  const stripHasContent =
    visibleSuggestions.length > 0 || visibleFillHints.length > 0;

  // Pre-opener opener suggestions (QUICK-260718-1no) — a stable, module-memoized
  // top-N recency-weighted opener list (NOT a hook, so it's safe below the early
  // returns above); passed to SearchSheet only pre-opener so mid-show an empty
  // search stays blank exactly as today.
  const openerSuggestions = getOpenerSuggestions();

  return withBackground(
    <>
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
          {/* Quiet online/offline indicator (D-08) — passive, next to the tally.
              End Show moved into the FAB speed-dial (last item) — the header now
              carries only passive status (SyncDot + tally). */}
          <SyncDot online={online} />
          <TallyReadout tally={session.tally} />
        </div>
      </div>

      {/* D-08 offline reassurance: a one-time calm LINE on a connectivity drop,
          auto-clearing on return-to-online. Never a banner, never blocking. */}
      {offlineNoticeVisible && (
        <p className="shrink-0 border-b border-hairline bg-elevated px-4 py-2 text-base leading-tight text-text-muted">
          {config.copy.live.offlineReassurance}
        </p>
      )}

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
        onOpenSearch={() => setSearchOpen(true)}
      />

      {/* SuggestionStrip (05-04, D-01): the advisory editor songs + fill-???
          hints, in a FIXED-height slot at the bottom of the column (above the
          app BottomTabBar, now that the in-flow ActionBar is gone — D-20) so its
          appearing/dismissing never re-lays-out the orbit (SHOW-02). Adopt logs
          source:"editor"; dismiss is non-destructive; fill routes through rename. */}
      <SuggestionStrip
        suggestions={visibleSuggestions}
        fillHints={visibleFillHints}
        onAdopt={handleAdopt}
        onDismiss={handleDismiss}
        onFill={handleFill}
        reserveSpace={openerSeeded}
      />

      {/* Region 4 — the D-20 Show-Mode FAB speed-dial (supersedes the Phase-4
          in-flow ActionBar). Fixed-position, so removing the old in-flow rows
          hands the freed height to the orbit stage automatically; mounted in
          BOTH the pre-opener and active-fan states (the opener is always
          enterable via Search). Same five-callback contract ActionBar had. */}
      <FabMenu
        onSearch={() => setSearchOpen(true)}
        onUnknown={handleUnknown}
        onSetBreak={handleSetBreak}
        onEncore={handleEncore}
        onUndo={handleUndo}
        onEndShow={() => setEndOpen(true)}
        stripHasContent={stripHasContent}
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
        openerSuggestions={
          session.currentSongId === null ? openerSuggestions : undefined
        }
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
        onEnded={(id) => setRecapSessionId(id)}
      />

      <WhyDetail candidate={whyCandidate} onClose={() => setWhyCandidate(null)} />
    </>,
  );
}

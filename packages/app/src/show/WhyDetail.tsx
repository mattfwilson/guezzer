/**
 * The orb "why" detail (SHOW-10, D-11; extended 06-06 STAT-01/D-08). Opens from a
 * PredictionOrb's Info dot and renders `PredictionCandidate.reason` VERBATIM as
 * read-only text. The reason is kglw-derived, untrusted-origin content (T-04-05,
 * ASVS V5) — rendered as React text only, NEVER via `dangerouslySetInnerHTML`.
 *
 * Phase 6 adds a muted corpus-stat line (play count · last played · gap, STAT-01)
 * sourced from the module-memoized rarity index. For a song with zero live
 * history (absent from the index) it renders the Debut-candidate framing INSTEAD
 * of any corpus/percentage line (D-08 — never fake precision). Overlay/sheet
 * idiom mirrors AppMenu (bottom sheet, secondary surface, ≥44px close).
 */
import { useRef } from "react";
import { X } from "lucide-react";
import { Sheet } from "../components/Sheet.tsx";
import { config } from "../config.ts";
import { formatOrbPercent } from "./confidence.ts";
import { formatMonYear } from "../dex/formatDate.ts";
import { getRarityIndex } from "../dex/rarityIndex.ts";
import { TierBadge } from "../dex/TierBadge.tsx";
import type { OrbitCandidate } from "./PredictionOrb.tsx";

interface WhyDetailProps {
  /** The candidate whose reason to show, or null when closed. */
  candidate: OrbitCandidate | null;
  onClose: () => void;
}

export function WhyDetail({ candidate, onClose }: WhyDetailProps) {
  const copy = config.copy.dex;

  // ── Phase-22 SHEET-01: PROP-DRIVEN, and what the ref is actually for ────────
  //
  // WHY `open={candidate != null}` instead of the shipped `if (!candidate)
  // return null`: `<Sheet>` can only exit-animate a surface whose `open` PROP
  // flips. A sheet whose parent (or its own early return) stops rendering it
  // dies synchronously, `AnimatePresence` and all — no exit, no close-start
  // window (22-RESEARCH §Pitfall 1). This is one of the two bottom-sheet exit
  // exemplars of the D-21 device sample.
  //
  // WHY the ref — and NOT the reason that looks obvious. It does NOT supply the
  // content you see sliding away. `AnimatePresence` replays the `SheetSurface`
  // ELEMENT it captured on the last render where `open` was true, with frozen
  // props and frozen closures (22-02-PLAN §Pitfall 14); the JSX built below on
  // the closing render is handed to `<Sheet open={false}>`, which renders
  // nothing at all. The ref has one narrow job: let the `candidate === null`
  // render build those immediately-discarded children WITHOUT dereferencing
  // null. Assigned during RENDER, never in an effect — the closing render must
  // already have the value.
  const lastCandidateRef = useRef<OrbitCandidate | null>(null);
  if (candidate) lastCandidateRef.current = candidate;
  const shown = candidate ?? lastCandidateRef.current;

  // Every derived read must come off `shown`, not `candidate`, or the closing
  // render throws while building the JSX it is about to discard.
  const rarity = shown != null ? getRarityIndex()?.get(shown.songId) : undefined;

  // A11Y-01 (D-01/D-02, Open Q1): the orb "why" sheet is now the shared modal
  // <Sheet> — Escape-dismiss + focus-trap + focus-restore to the long-press
  // trigger (the primitive captures document.activeElement automatically). The
  // header-X and backdrop both map to `onClose`; the "why" content is unchanged.
  return (
    <Sheet
      open={candidate != null}
      onClose={onClose}
      modal
      variant="bottom-sheet"
      // `shown` is null only before anything was EVER opened. The sheet is closed
      // on that render, so it emits zero DOM nodes and this name is never
      // announced — hence a constant fallback rather than invented copy.
      ariaLabel={shown != null ? `Why ${shown.songName}?` : ""}
    >
      {shown != null && (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[20px] font-semibold leading-tight text-text-primary">
              {shown.songName}
            </span>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-text-muted"
            >
              <X size={22} />
            </button>
          </div>

          {/* reason rendered as text only — untrusted kglw-derived content (T-04-05). */}
          <p className="mt-3 text-base leading-normal text-text-muted">
            {shown.reason}
          </p>

          {/* "Max's predictor" line (2026-07-30) — the transformer's own probability
              and rank for this song, shown whenever the model ranks it in top-K. */}
          {shown.nn && (
            <p className="mt-2 text-[14px] font-semibold leading-tight tabular-nums text-text-primary">
              {config.copy.show.nn.whyLine(
                formatOrbPercent(shown.nn.nnProb),
                shown.nn.nnRank,
              )}
            </p>
          )}

          {/* STAT-01 corpus line, or the D-08 debut framing for zero-history songs. */}
          {rarity != null ? (
            <p className="mt-3 text-[14px] font-semibold leading-tight tabular-nums text-text-muted">
              {copy.whyCorpusStat(
                rarity.playCount,
                formatMonYear(rarity.lastPlayedDate),
                rarity.corpusGap,
              )}
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              <TierBadge tier="debut" />
              <p className="text-base leading-normal text-text-muted">
                {copy.debutDetail}
              </p>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}

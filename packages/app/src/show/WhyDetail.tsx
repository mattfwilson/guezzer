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
import { X } from "lucide-react";
import { config } from "../config.ts";
import { formatMonYear } from "../dex/formatMonYear.ts";
import { getRarityIndex } from "../dex/rarityIndex.ts";
import { TierBadge } from "../dex/TierBadge.tsx";
import type { OrbitCandidate } from "./PredictionOrb.tsx";

interface WhyDetailProps {
  /** The candidate whose reason to show, or null when closed. */
  candidate: OrbitCandidate | null;
  onClose: () => void;
}

export function WhyDetail({ candidate, onClose }: WhyDetailProps) {
  if (!candidate) return null;

  const copy = config.copy.dex;
  const rarity = getRarityIndex()?.get(candidate.songId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Why ${candidate.songName}?`}
      className="fixed inset-0 z-20 flex flex-col justify-end bg-black/50"
      onClick={onClose}
    >
      <div
        className="rounded-t-2xl border-t border-hairline bg-elevated px-4 pt-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 32px)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-[20px] font-semibold leading-tight text-text-primary">
            {candidate.songName}
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
          {candidate.reason}
        </p>

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
      </div>
    </div>
  );
}

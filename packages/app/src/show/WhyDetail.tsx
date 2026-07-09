/**
 * The orb "why" detail (SHOW-10, D-11). Opens from a PredictionOrb's Info dot and
 * renders `PredictionCandidate.reason` VERBATIM as read-only text. The reason is
 * kglw-derived, untrusted-origin content (T-04-05, ASVS V5) — it is rendered as
 * React text only, NEVER via `dangerouslySetInnerHTML`. Overlay/sheet idiom
 * mirrors AppMenu (bottom sheet, secondary surface, ≥44px close).
 */
import { X } from "lucide-react";
import type { OrbitCandidate } from "./PredictionOrb.tsx";

interface WhyDetailProps {
  /** The candidate whose reason to show, or null when closed. */
  candidate: OrbitCandidate | null;
  onClose: () => void;
}

export function WhyDetail({ candidate, onClose }: WhyDetailProps) {
  if (!candidate) return null;

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
      </div>
    </div>
  );
}

/**
 * The dex header (06-06, D-07) — the collection's face. A dumb component over the
 * derived `DexStats`: the Display-size completion headline (`{caught}/{total} ·
 * {pct}%`, `tabular-nums` — the first real use of the Display role since Phase 3),
 * the "caught" caption, the rarest-catch subline with its tier pill, and the
 * attended-show count. Generous `xl` rhythm.
 *
 * The accent Share-card CTA lives here (reserved accent use #1, §Color A): the
 * only accent control on the dex face, opening the share-card preview sheet
 * (plan 06-11). The rarest-catch song name is kglw-derived, rendered as React
 * text only (never dangerouslySetInnerHTML).
 */
import type { ArchiveArtifact, DexStats } from "@guezzer/core";
import { Share2 } from "lucide-react";
import { config } from "../config.ts";
import { TierBadge } from "./TierBadge.tsx";

interface DexHeaderProps {
  dex: DexStats;
  archive: ArchiveArtifact;
  /** Open the share-card preview sheet (accent CTA, plan 06-11). */
  onShare: () => void;
}

export function DexHeader({ dex, archive, onShare }: DexHeaderProps) {
  const copy = config.copy.dex;
  const shareCopy = config.copy.share;
  const { caught, total, pct } = dex.completion;

  const rarestName =
    dex.rarestCatch != null
      ? (archive.songs[String(dex.rarestCatch.songId)] ?? null)
      : null;

  return (
    <header className="flex flex-col gap-2 px-4 pt-8 pb-6">
      <div className="flex flex-col gap-1">
        <p className="text-[28px] font-semibold leading-tight tabular-nums text-text-primary">
          {caught}/{total} · {pct}%
        </p>
        <p className="text-[14px] font-semibold leading-tight text-text-muted">
          {copy.caughtCaption}
        </p>
      </div>

      {dex.rarestCatch != null && rarestName != null && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base leading-normal text-text-muted">
            {copy.rarestCatchLabel(rarestName)}
          </span>
          <TierBadge tier={dex.rarestCatch.tier} />
        </div>
      )}

      <p className="text-base leading-normal text-text-muted tabular-nums">
        {copy.showsAttended(dex.showCount)}
      </p>

      {/* The accent Share-card CTA — reserved accent use #1 (§Color A). */}
      <button
        type="button"
        onClick={onShare}
        className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-4 text-[14px] font-semibold text-surface touch-manipulation"
      >
        <Share2 size={18} aria-hidden="true" />
        {shareCopy.cta}
      </button>
    </header>
  );
}

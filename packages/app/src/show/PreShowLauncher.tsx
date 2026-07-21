/**
 * Pre-show launcher (04-UI-SPEC §Layout, Component Inventory; D-01/D-02). The
 * "Ready when you are" empty state with the single accent-gold **Start Show**
 * CTA — the one pre-show tap. Tapping it calls `startShow()`, which auto-stamps
 * today's date and writes the provisional-attendance trackedShows row (the row
 * itself IS the dex credit, DEX-01/D-02) — no venue picker, no network.
 *
 * Phase 16 (BINGO-04, D-07/D-08/D-09): the Start-Show trigger is now also the
 * bingo lock connection. AFTER `startShow()` resolves to the active sessionId,
 * it looks up any bingo card dealt for that session:
 *  - a draft (unlocked) card → `lockCard(sessionId, caughtSongIds)` FREEZES it,
 *    stamping the caught-set from the LIVE dex AS OF the lock (`deriveDex(...).
 *    perSong.keys()`, RESEARCH Pitfall 1 — a snapshot array, never a live
 *    reference), so a later catch can never retroactively drift a replayed square.
 *    The lock is fire-and-forget AFTER the show starts — it NEVER blocks or delays
 *    the show going active (T-16-08); `startShow` resolving IS the show start.
 *  - no card → `onStartedWithoutCard(sessionId)` fires the dismissible D-08 nudge
 *    (rendered by ShowView, which survives the pre-show → active transition; a
 *    nudge owned here would unmount the instant the show goes active).
 *
 * Reuses PlaceholderView's Heading/Body token classes verbatim (the inherited
 * Phase 3 centered-state idiom). Accent gold is reserved (04-UI-SPEC §Color) —
 * the Start Show fill is one of its three sanctioned uses.
 */
import { Play } from "lucide-react";
import { config } from "../config.ts";
import { db, lockCard, startShow } from "../db/db.ts";
import { dexSnapshot } from "../games/bingoContext.ts";
import { useDexStats } from "../dex/useDexStats.ts";

export interface PreShowLauncherProps {
  /**
   * Fired when Start Show mints a session that has NO bingo card (D-08): the
   * caller (ShowView) shows the dismissible "Deal a card for tonight?" nudge.
   * Optional — omitting it just skips the nudge (the lock path is unaffected).
   */
  onStartedWithoutCard?: (sessionId: string) => void;
}

export function PreShowLauncher({ onStartedWithoutCard }: PreShowLauncherProps = {}) {
  const copy = config.copy.show;
  // The live dex — its caught-set is FROZEN onto the card at lock time (D-08).
  const { dex } = useDexStats();

  // The one pre-show tap (D-01) → start the show, THEN wire the bingo lock/nudge.
  const handleStartShow = async () => {
    const show = await startShow(); // resolving THIS is the show start (T-16-08)
    const { sessionId } = show;

    // Look up any card dealt for this session. A draft (unlocked) card locks with
    // the frozen caught-set; already-locked is a lockCard no-op (first-freeze-wins);
    // no card → the D-08 nudge. The lock is fire-and-forget — never awaited before
    // the show is considered started (it already is, above).
    const row = await db.bingoCards.where("sessionId").equals(sessionId).first();
    if (row && row.lockedAt == null) {
      // Freeze the caught songIds AS OF lock (Pitfall 1) — a snapshot array, never
      // the live dex. `[]` only in the extreme loader-failure case (dex == null),
      // which already degrades the whole dex; never a crash on the show-start path.
      const caughtSongIds = dex ? [...dexSnapshot(dex)] : [];
      void lockCard(sessionId, caughtSongIds);
    } else if (!row) {
      onStartedWithoutCard?.(sessionId);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 text-center">
      <div>
        <h1 className="text-[20px] font-semibold leading-tight text-text-primary">
          {copy.preShowHeading}
        </h1>
        <p className="mt-2 max-w-xs text-base leading-normal text-text-muted">
          {copy.preShowBody}
        </p>
      </div>

      <button
        type="button"
        onClick={() => void handleStartShow()}
        className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent px-8 py-4 text-[20px] font-semibold text-surface"
      >
        <Play size={22} />
        {copy.startCta}
      </button>
    </div>
  );
}

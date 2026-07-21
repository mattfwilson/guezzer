/**
 * Phase-16 (BINGO-01, D-01) deal screen: the three vibe buttons ARE the deal.
 * There is no separate "deal" affordance — tapping "Deal Chill" / "Deal Balanced"
 * / "Deal Glory-hunter" immediately mints a complete 4×4 card for that vibe and
 * persists it as the active session's unlocked draft (never a blank grid).
 *
 * Flow per tap (D-01/D-07): resolve the memoized bingo context + live caught-set
 * → ensure a session exists (a card can be dealt PRE-show, so reuse the active
 * show if one is running, else `startShow()` mints tonight's provisional session,
 * D-07) → seed a fresh deal → resolve real display labels onto the card
 * (bingoLabels, so the board shows song/album names not "Song 132") →
 * `saveDraftCard` (overwrites the session's draft in place, D-08). Lock happens
 * later at Start Show (Phase-15 `lockCard`); this screen only deals the draft.
 *
 * Copy is read from `config.copy.games.bingo`; buttons are `bg-elevated` cards
 * (accent stays reserved, 16-UI-SPEC §Color) with a `text-text-muted` gamble hint.
 */
import { deal, type BingoVibe } from "@guezzer/core";
import { config } from "../config.ts";
import { getActiveShow, saveDraftCard, startShow } from "../db/db.ts";
import { useDexStats } from "../dex/useDexStats.ts";
import { dexSnapshot, getBingoContext } from "./bingoContext.ts";
import { getBingoNameMaps, resolveCardLabels } from "./bingoLabels.ts";
import { randomUUID } from "../uuid.ts";

/** The three vibes in their fixed display order (D-01), keyed into the copy maps. */
const VIBES: readonly BingoVibe[] = ["chill", "balanced", "glory"];

export function DealScreen() {
  const copy = config.copy.games.bingo;
  const stats = useDexStats();
  const ctxResult = getBingoContext();

  const ready = ctxResult != null && stats.dex != null;

  const handleDeal = async (vibe: BingoVibe): Promise<void> => {
    // Guard: context/dex not yet loaded — the buttons still render (never a blank
    // screen), the tap is a calm no-op until the artifacts resolve.
    if (ctxResult == null || stats.dex == null) return;

    const snapshot = dexSnapshot(stats.dex);
    // D-07: dealing may happen pre-show — reuse the active session if one exists,
    // otherwise start tonight's provisional session to attach the draft to.
    const show = (await getActiveShow()) ?? (await startShow());

    const seed = randomUUID();
    const card = resolveCardLabels(
      deal(seed, vibe, ctxResult.ctx, snapshot, ctxResult.corpusVersion),
      getBingoNameMaps(),
    );

    await saveDraftCard({
      sessionId: show.sessionId,
      card,
      showDate: show.date,
      venueName: show.venueName,
      city: show.city,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-[20px] font-semibold leading-tight text-text-primary">
        {copy.dealHeading}
      </h2>

      <div className="flex flex-col gap-3">
        {VIBES.map((vibe) => (
          <button
            key={vibe}
            type="button"
            onClick={() => void handleDeal(vibe)}
            aria-disabled={!ready}
            className="flex min-h-11 flex-col items-start gap-1 rounded-md border border-hairline bg-elevated px-4 py-3 text-left touch-manipulation"
          >
            <span className="text-base font-semibold text-text-primary">
              {copy.vibeLabels[vibe]}
            </span>
            <span className="text-[14px] leading-tight text-text-muted">
              {copy.gambleHints[vibe]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

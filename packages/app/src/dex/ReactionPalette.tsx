/**
 * Phase-20 (PRES-02/05/06, D-04/D-05/D-06/D-08) reaction send surface — the ONE
 * unified "pick an emoji, then pick a target" palette shared by the Friends-header
 * "React" entry and the pre-targeted FriendDetail button (D-07). A thin UI shell
 * over the shipped `Sheet` (view-state, no new hash route, no new z-tier — Sheet
 * owns `sheet` tier 50) that echoes the `DexView` segment-control button grid,
 * departing only in that selection is an accent RING, not a fill (UI-SPEC §Color).
 *
 * Fixed 4-emoji set, wave-led (D-05/D-06): the chips render from the SINGLE
 * `config.presence.EMOJIS` source (the same allow-list `validateWave` consumes),
 * so a peer can never receive an emoji the palette can't send — there is no custom
 * picker. The 🎯 chip carries the visible `caught it!` label; the other three are
 * emoji-only. Every chip and target row is ≥44px (`min-h-11 min-w-11`) with an
 * accessible name (T-20 a11y). No send rate-limit (D-08) — the receive-side toast
 * cap (WaveToast) bounds on-screen flooding.
 *
 * Send path (D-07): choosing (emoji, target) calls the single module-level
 * `sendWave(emoji, to)` primitive exactly once, then closes. `Everyone` → `to:null`
 * (broadcast); a friend row → `to:friend.userId` (targeted, PRES-05). The friend
 * `displayName` is untrusted (Supabase-synced) — rendered as escaped React text,
 * `truncate min-w-0` clamped, never `dangerouslySetInnerHTML` (T-20-06).
 */
import { useEffect, useState } from "react";
import { config } from "../config.ts";
import { Sheet } from "../components/Sheet.tsx";
import type { FriendRowData } from "../sync/friendCache.ts";
import { sendWave } from "../sync/presenceSync.ts";
import { IdentityGlyph } from "./FriendRow.tsx";

const presence = config.copy.presence;

/** Per-emoji accessible names, positionally aligned to `config.presence.EMOJIS`. */
const CHIP_LABELS = [
  presence.chipLabels.wave,
  presence.chipLabels.fire,
  presence.chipLabels.lizard,
  presence.chipLabels.caught,
] as const;

interface ReactionPaletteProps {
  open: boolean;
  onClose: () => void;
  /** Pre-selected target userId (from FriendDetail); omitted/undefined = no pre-selection. */
  initialTarget?: string | null;
  friends: FriendRowData[];
}

export function ReactionPalette({
  open,
  onClose,
  initialTarget,
  friends,
}: ReactionPaletteProps) {
  // Two-step pick (D-04): an emoji AND a target complete a send. A friend may be
  // pre-selected (FriendDetail entry) so only the emoji tap remains.
  const [emoji, setEmoji] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(initialTarget ?? null);
  const [targetChosen, setTargetChosen] = useState<boolean>(initialTarget != null);

  // WR-01 (20-REVIEW.md): FriendsList keeps this palette PERMANENTLY MOUNTED and only
  // toggles `open`, so the mount-time useState initialisers above never re-run after a
  // send/close — leaving a stale emoji/target/targetChosen that would fire an unintended
  // wave on the first tap of a reopened sheet. Re-seed the two-step selection on every
  // open (and whenever the pre-selected target changes) so each open starts clean.
  useEffect(() => {
    if (!open) return;
    setEmoji(null);
    setTarget(initialTarget ?? null);
    setTargetChosen(initialTarget != null);
  }, [open, initialTarget]);

  function send(e: string, to: string | null): void {
    sendWave(e, to);
    onClose();
  }

  function pickEmoji(e: string): void {
    if (targetChosen) {
      send(e, target);
      return;
    }
    setEmoji(e);
  }

  function pickTarget(to: string | null): void {
    if (emoji != null) {
      send(emoji, to);
      return;
    }
    setTarget(to);
    setTargetChosen(true);
  }

  const ring = "ring-2 ring-accent";

  return (
    <Sheet open={open} onClose={onClose} ariaLabel={presence.reactionTitle}>
      <h2 className="mb-3 text-base font-semibold leading-normal text-text-primary">
        {presence.reactionTitle}
      </h2>

      {/* Fixed 4-emoji chips from the single config source (D-05/D-06, wave-led). */}
      <div className="mb-4 flex gap-2">
        {config.presence.EMOJIS.map((chipEmoji, i) => {
          const selected = emoji === chipEmoji;
          const isCaught = i === config.presence.EMOJIS.length - 1;
          return (
            <button
              key={chipEmoji}
              type="button"
              aria-label={CHIP_LABELS[i]}
              aria-pressed={selected}
              onClick={() => pickEmoji(chipEmoji)}
              className={`flex min-h-11 min-w-11 flex-1 items-center justify-center gap-1 rounded-md border border-hairline px-3 py-2 text-2xl leading-none touch-manipulation ${
                selected ? ring : ""
              }`}
            >
              <span aria-hidden="true">{chipEmoji}</span>
              {isCaught && (
                <span className="text-[13px] font-semibold text-text-muted">
                  {presence.caughtLabel}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Target picker: Everyone (top/default → to:null) then one row per friend. */}
      <div className="flex flex-col gap-1 border-t border-hairline pt-3">
        <button
          type="button"
          aria-pressed={targetChosen && target === null}
          onClick={() => pickTarget(null)}
          className={`flex min-h-11 min-w-11 items-center gap-2 rounded-md px-3 py-2 text-left text-base leading-normal text-text-primary touch-manipulation ${
            targetChosen && target === null ? ring : ""
          }`}
        >
          {presence.targetEveryone}
        </button>

        {friends.map((friend) => {
          const selected = targetChosen && target === friend.userId;
          return (
            <button
              key={friend.userId}
              type="button"
              aria-pressed={selected}
              onClick={() => pickTarget(friend.userId)}
              className={`flex min-h-11 min-w-11 items-center gap-2 rounded-md px-3 py-2 text-left touch-manipulation ${
                selected ? ring : ""
              }`}
            >
              <IdentityGlyph
                userId={friend.userId}
                displayName={friend.displayName}
              />
              <span className="min-w-0 flex-1 truncate text-base leading-normal text-text-primary">
                {friend.displayName}
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

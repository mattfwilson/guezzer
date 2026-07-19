/**
 * The advisory SuggestionStrip (D-01/D-02/D-04, 05-UI-SPEC §Layout item 4 +
 * §Component Inventory). A "second set of eyes, never a clobber": the next 1–2
 * un-logged editor songs (deduped upstream by `diffLatestAgainstTrail`) plus any
 * fill-`???` hints (`resolvePlaceholders`), rendered directly below the orbit and
 * above the ActionBar.
 *
 * Hard invariants:
 *   - FIXED height (`config.ui.SUGGESTION_STRIP_HEIGHT`, inline style, ALWAYS
 *     allocated) so a suggestion appearing/dismissing never re-lays-out the orbit
 *     fan (SHOW-02 preservation). When empty, the slot is blank calm space — no
 *     empty-state card.
 *   - Editor strings (`songName`) are UNTRUSTED and rendered as escaped React
 *     text ONLY — never `dangerouslySetInnerHTML` (T-05-12, SCHEMA §12).
 *   - Advisory only: adopt/dismiss/fill are the ONLY actions; dismiss is
 *     non-destructive (nothing is logged, SYNC-02/D-01). Each row dismisses via
 *     BOTH a tap-`X` and a horizontal swipe (05-UI-SPEC "X/swipe dismisses").
 *   - Calm palette: text-primary/​text-muted/​hairline only — never hit-green,
 *     miss-red, or accent-gold.
 */
import { useRef } from "react";
import { Plus, Pencil, X } from "lucide-react";
import type { Suggestion, FillHint } from "@guezzer/core";
import { config } from "../config.ts";

interface SuggestionStripProps {
  /** The next 1–2 un-logged editor songs (deduped upstream, D-02). */
  suggestions: Suggestion[];
  /** Fill-`???` hints for placeholder positions the editor can now name (D-04). */
  fillHints: FillHint[];
  /** Adopt a suggestion → logged as `source:'editor'` (no confirm, fast path). */
  onAdopt: (suggestion: Suggestion) => void;
  /** Dismiss a row by its song id — non-destructive, nothing logged (SYNC-02). */
  onDismiss: (songId: number) => void;
  /** Fill a `???` placeholder → routes through the Phase-4 rename path (D-04). */
  onFill: (hint: FillHint) => void;
  /**
   * Reserve the fixed slot height even when empty. TRUE once the opener is
   * seeded (a fan exists to protect) so a suggestion appearing/dismissing never
   * re-lays-out the orbit (SHOW-02). FALSE pre-opener → the slot collapses to
   * zero height so the centered "Search for the opener" orb isn't pushed up and
   * no blank bar shows above the tab bar.
   */
  reserveSpace: boolean;
}

/** Horizontal-swipe distance (px) past which a row is dismissed (05-UI-SPEC). */
const SWIPE_DISMISS_THRESHOLD = 40;

/**
 * One strip row. Isolated so each row owns its own pointer-swipe state without a
 * shared ref map. Both the tap-`X` and a horizontal swipe past the threshold
 * call `onDismiss` for THIS row (non-destructive).
 */
function StripRow({
  eyebrow,
  songName,
  songId,
  onDismiss,
  action,
}: {
  eyebrow: string;
  songName: string;
  songId: number;
  onDismiss: (songId: number) => void;
  action: { icon: "add" | "fill"; label: string; onClick: () => void };
}) {
  const startXRef = useRef<number | null>(null);

  const handlePointerDown = (event: React.PointerEvent) => {
    startXRef.current = event.clientX;
  };
  const handlePointerUp = (event: React.PointerEvent) => {
    const startX = startXRef.current;
    startXRef.current = null;
    if (startX === null) return;
    if (Math.abs(event.clientX - startX) >= SWIPE_DISMISS_THRESHOLD) {
      onDismiss(songId); // swipe-to-dismiss (non-destructive, SYNC-02)
    }
  };

  const ActionIcon = action.icon === "add" ? Plus : Pencil;

  return (
    <div
      className="flex min-h-11 items-center gap-2 px-4 touch-pan-y"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        {/* Muted provenance eyebrow (Label). */}
        <span className="text-[14px] font-semibold leading-tight text-text-muted">
          {eyebrow}
        </span>
        {/* Untrusted editor content — escaped React text ONLY (T-05-12). */}
        <span className="truncate text-base leading-tight text-text-primary">
          {songName}
        </span>
      </div>

      {/* Add (adopt) or Pencil (fill-???) — the primary per-row action, ≥44px. */}
      <button
        type="button"
        aria-label={action.label}
        onClick={action.onClick}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-hairline text-text-primary touch-manipulation"
      >
        <ActionIcon size={18} />
      </button>

      {/* Dismiss — the tap-X twin of swipe-to-dismiss; non-destructive, ≥44px. */}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => onDismiss(songId)}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-text-muted touch-manipulation"
      >
        <X size={18} />
      </button>
    </div>
  );
}

export function SuggestionStrip({
  suggestions,
  fillHints,
  onAdopt,
  onDismiss,
  onFill,
  reserveSpace,
}: SuggestionStripProps) {
  const copy = config.copy.live;
  const hasContent = suggestions.length > 0 || fillHints.length > 0;

  return (
    // Reserve the fixed height whenever content is shown OR the fan is live
    // (reserveSpace) so a suggestion appearing/dismissing never re-lays-out the
    // orbit (SHOW-02). Pre-opener (reserveSpace false, empty) → zero height so the
    // orb centers and there's no bar. Visible chrome (border/bg) only when there's
    // actual content — an empty reserved slot is invisible calm space, not a bar.
    <div
      className={`flex shrink-0 flex-col justify-center overflow-y-auto ${
        hasContent ? "border-t border-hairline bg-elevated" : ""
      }`}
      style={{
        height:
          reserveSpace || hasContent ? config.ui.SUGGESTION_STRIP_HEIGHT : 0,
      }}
    >
      {suggestions.map((suggestion) => (
        <StripRow
          key={`s-${suggestion.songId}`}
          eyebrow={copy.suggestionEyebrow}
          songName={suggestion.songName}
          songId={suggestion.songId}
          onDismiss={onDismiss}
          action={{
            icon: "add",
            label: "Add",
            onClick: () => onAdopt(suggestion),
          }}
        />
      ))}
      {fillHints.map((hint) => (
        <StripRow
          key={`f-${hint.songId}-${hint.entryPosition}`}
          eyebrow={copy.fillPlaceholderEyebrow}
          songName={hint.songName}
          songId={hint.songId}
          onDismiss={onDismiss}
          action={{
            icon: "fill",
            label: copy.fillPlaceholderEyebrow,
            onClick: () => onFill(hint),
          }}
        />
      ))}
    </div>
  );
}

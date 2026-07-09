/**
 * End Show finalize confirm (04-UI-SPEC §Component Inventory, D-04). A
 * destructive bottom-sheet confirm — heading "End show?", body, and a
 * destructive-styled "End show" / "Keep tracking" pair (04-UI-SPEC copy). Only
 * on an explicit confirm does it call `endShow(sessionId)`, flipping the show to
 * `status: "finalized"` (read-only). This is the single guarded end to the night
 * (T-04-18): finalizing is required before the next night can start (D-03/D-04),
 * and the confirm prevents an accidental mid-show ending.
 *
 * Shares the TrailNodeSheet overlay idiom (AppMenu bottom sheet); song text is
 * static copy so there is no untrusted-string surface here.
 */
import { config } from "../config.ts";
import { endShow } from "../db/db.ts";

interface EndShowDialogProps {
  /** Whether the confirm sheet is shown. */
  open: boolean;
  /** The active show to finalize on confirm (D-04). */
  sessionId: string;
  onClose: () => void;
}

export function EndShowDialog({ open, sessionId, onClose }: EndShowDialogProps) {
  const copy = config.copy.show;

  if (!open) return null;

  // Only finalize on an explicit confirm (D-04) — never on the backdrop/cancel.
  const handleConfirm = () => {
    void endShow(sessionId);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.endHeading}
      className="fixed inset-0 z-30 flex flex-col justify-end bg-black/50"
      onClick={onClose}
    >
      <div
        className="rounded-t-2xl border-t border-hairline bg-elevated px-4 pt-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 32px)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-[20px] font-semibold leading-tight text-text-primary">
          {copy.endHeading}
        </p>
        <p className="mt-2 text-base leading-normal text-text-muted">
          {copy.endBody}
        </p>

        {/* Destructive confirm — finalizes to read-only (D-04). */}
        <button
          type="button"
          onClick={handleConfirm}
          className="mt-4 flex min-h-11 w-full items-center justify-center rounded-md bg-destructive px-4 text-[14px] font-semibold text-surface touch-manipulation"
        >
          {copy.endConfirm}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 flex min-h-11 w-full items-center justify-center rounded-md border border-hairline px-4 text-[14px] font-semibold text-text-primary touch-manipulation"
        >
          {copy.endCancel}
        </button>
      </div>
    </div>
  );
}

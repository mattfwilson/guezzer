/**
 * End Show finalize confirm (04-UI-SPEC §Component Inventory, D-04) + the
 * Phase-5 auto-backup nudge (05-UI-SPEC `BackupNudge`, D-13). A destructive
 * bottom-sheet confirm — heading "End show?", body, and a destructive-styled
 * "End show" / "Keep tracking" pair. Only on an explicit confirm does it call
 * `endShow(sessionId)`, flipping the show to `status: "finalized"` (read-only).
 * This is the single guarded end to the night (T-04-18): finalizing is required
 * before the next night can start (D-03/D-04), and the confirm prevents an
 * accidental mid-show ending.
 *
 * Phase-5 additions (D-13):
 *  - On confirm, AFTER `endShow`, the JSON backup auto-downloads via
 *    `exportBackup()` (never-throws) so the export backstop is surfaced at the
 *    highest-value moment. A muted, non-blocking nudge line announces it — never
 *    a blocking dialog or a per-show nag.
 *  - If `persist()` was denied (persistStatus !== "persisted"), a ONE-TIME
 *    `ShieldAlert` warning is shown (gated by the `persistWarningShown` meta
 *    flag so it never nags again), offering an inline Export.
 *
 * Shares the TrailNodeSheet overlay idiom (AppMenu bottom sheet); song text is
 * static copy so there is no untrusted-string surface here.
 */
import { CircleCheck, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { config } from "../config.ts";
import { endShow, getMeta, setMeta } from "../db/db.ts";
import type { PersistStatus } from "../pwa/persist.ts";
import { exportBackup } from "../settings/exportDownload.ts";

interface EndShowDialogProps {
  /** Whether the confirm sheet is shown. */
  open: boolean;
  /** The active show to finalize on confirm (D-04). */
  sessionId: string;
  onClose: () => void;
}

/** Meta flag key gating the one-time persist-denied warning (D-13). */
const PERSIST_WARNING_SHOWN = "persistWarningShown";

export function EndShowDialog({ open, sessionId, onClose }: EndShowDialogProps) {
  const copy = config.copy.show;
  const settingsCopy = config.copy.settings;
  const [showPersistWarning, setShowPersistWarning] = useState(false);

  // D-13: decide the one-time persist-denied warning when the sheet opens. Read
  // the recorded persistStatus (Plan 04) and the one-time flag; show at most
  // once, marking the flag as shown so it never nags again. Guarded + silent —
  // a failing meta read must never break the End-Show flow (persist.ts idiom).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const alreadyShown = await getMeta<boolean>(PERSIST_WARNING_SHOWN);
        if (alreadyShown) return;
        const status = await getMeta<PersistStatus>("persistStatus");
        if (status === "persisted") return;
        if (cancelled) return;
        setShowPersistWarning(true);
        await setMeta(PERSIST_WARNING_SHOWN, true);
      } catch {
        // Silent — no scary UI on the finalize path (D-13).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  // Only finalize on an explicit confirm (D-04) — never on the backdrop/cancel.
  // The backup runs on the SAME confirm, AFTER finalize; both `endShow` and
  // `exportBackup` are fired synchronously here (exportBackup never throws), so
  // the finalize + close contract (T-04-18) is preserved unchanged.
  const handleConfirm = () => {
    void endShow(sessionId);
    void exportBackup(); // D-13 auto-backup — never-throws, fire-and-forget
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

        {/* D-13 auto-backup nudge — muted, non-blocking, not a per-show nag. */}
        <p className="mt-3 flex items-center gap-2 text-base leading-normal text-text-muted">
          <CircleCheck size={16} className="shrink-0" />
          <span>{settingsCopy.endShowBackupConfirmation}</span>
        </p>

        {/* D-13 one-time persist-denied warning, offering an inline Export. */}
        {showPersistWarning && (
          <div className="mt-3 flex flex-col gap-2 rounded-md border border-hairline bg-surface p-3">
            <p className="flex items-center gap-2 text-[14px] font-semibold leading-tight text-text-primary">
              <ShieldAlert size={16} className="shrink-0" />
              {settingsCopy.storageNotProtected}
            </p>
            <p className="text-base leading-normal text-text-muted">
              {settingsCopy.storageNotProtectedBody}
            </p>
            <button
              type="button"
              onClick={() => void exportBackup()}
              className="mt-1 flex min-h-11 w-full items-center justify-center rounded-md border border-hairline px-4 text-[14px] font-semibold text-text-primary touch-manipulation"
            >
              {settingsCopy.exportCta}
            </button>
          </div>
        )}

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

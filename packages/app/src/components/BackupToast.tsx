import { useEffect, useState } from "react";
import { config } from "../config";
import {
  useBottomOverlayHeightRegistration,
  useBottomOverlayOffset,
} from "../pwa/bottomOverlayInset";

/**
 * App-level, ephemeral "Backup saved" toast (SAFE-03, D-05). Renders nothing
 * until `showBackupToast()` fires, then appears briefly and auto-dismisses.
 *
 * Why a module-level emitter instead of props/context: confirming End Show makes
 * `ShowView` early-return `<RecapView>`, unmounting the End-Show dialog's whole
 * subtree. A dialog- or ShowView-owned toast would be torn down before it could
 * ever render (RESEARCH §SAFE-03 landmine). This toast is hosted at App level
 * (sibling of `<UpdateToast/>`), so it survives the ShowView→RecapView swap; the
 * emitter is the decoupled seam that lets `handleConfirm` trigger it without a
 * `setState` on the unmounting dialog.
 *
 * Mirrors `UpdateToast` for layout/inset behavior: same fixed overlay pinned
 * above the tab bar via the FOUND-02 owner's `--gz-chrome-reserve`,
 * `role="status"`, `config.ui.z.toast` z-tier, and its own measured height
 * registered under the `"backupToast"` key so AppShell reserves space and
 * this toast never covers/intercepts taps on page content underneath it.
 */

/** Single active listener — the mounted `<BackupToast/>` subscribes here. */
let listener: (() => void) | null = null;

/**
 * Emit a "backup saved" notification. Called from `EndShowDialog.handleConfirm`
 * ONLY after `exportBackup()` resolves `{ ok: true }`. A no-op if no toast is
 * mounted (e.g. in a unit test that doesn't render `<BackupToast/>`).
 */
export function showBackupToast(): void {
  listener?.();
}

/** Subscribe the mounted toast to emits; returns an unsubscribe. */
export function subscribeBackupToast(fn: () => void): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

/** How long the toast stays visible before auto-dismissing (ms). */
const AUTO_DISMISS_MS = 4000;

export function BackupToast() {
  const [visible, setVisible] = useState(false);
  const ref = useBottomOverlayHeightRegistration("backupToast", visible);
  // CR-01: stacks above the InstallBanner and the update prompt rather than
  // painting on top of either.
  const bottomOffset = useBottomOverlayOffset("backupToast");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeBackupToast(() => {
      setVisible(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setVisible(false), AUTO_DISMISS_MS);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!visible) return null;

  const { endShowBackupConfirmation } = config.copy.settings;

  return (
    <div
      ref={ref}
      role="status"
      className="fixed inset-x-0 flex items-center border-t border-hairline bg-elevated px-4 py-4 motion-safe:transition-all motion-safe:duration-200"
      style={{
        zIndex: config.ui.z.toast,
        // D-09 / FOUND-02: this was a Tailwind bottom utility hard-coding the tab
        // bar's NOMINAL height, measured from the viewport — one home-indicator
        // inset short of the bar's real height, so this toast overlapped the bar's
        // buttons on an installed instance.
        //
        // The `paddingBottom` deleted from here (a raw safe-area bottom read) was
        // the compensation for that shortfall. Now that the offset comes from the
        // chrome reserve, which already includes the inset, keeping it would
        // double-count: ~34px of dead space inside the toast, and one inset of
        // over-reserve in the overlay store measuring this element.
        //
        // CR-01: the offset is ADDITIVE to the chrome reserve, never a
        // replacement — this toast still follows the chrome collapse for free.
        bottom: `calc(var(--gz-chrome-reserve) + ${bottomOffset}px)`,
      }}
    >
      <p className="text-base leading-normal text-text-primary">
        {endShowBackupConfirmation}
      </p>
    </div>
  );
}

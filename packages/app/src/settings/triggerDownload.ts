/**
 * Single browser-only anchor-download helper (SAFE-02, D-06/D-07). Centralizes
 * the anchor-download-with-object-URL idiom that was copied into both
 * `exportDownload.ts` (backup JSON) and `shareCard.ts` (share-card PNG). The
 * fix lives in ONE place so it can't drift: the object URL is freed only AFTER
 * `config.dataSafety.OBJECT_URL_REVOKE_DELAY_MS` elapses, never on the click
 * tick — a same-tick `revokeObjectURL` silently aborts the download on iOS
 * Safari, the primary target.
 *
 * Browser-only (touches `document` / `URL` / `setTimeout`) → lives in
 * `packages/app`, NOT core (CLAUDE.md core-purity constraint).
 */
import { config } from "../config.ts";

/**
 * Trigger a browser download of `data` as `filename` via a transient anchor,
 * then defer the object-URL revoke so iOS Safari has time to begin the
 * download. NEVER revokes on the click tick (SAFE-02).
 */
export function triggerDownload(data: Blob | File, filename: string): void {
  const url = URL.createObjectURL(data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Deferred revoke (D-06): a same-tick free aborts the download on iOS Safari.
  setTimeout(
    () => URL.revokeObjectURL(url),
    config.dataSafety.OBJECT_URL_REVOKE_DELAY_MS,
  );
}

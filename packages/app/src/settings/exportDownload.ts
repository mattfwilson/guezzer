/**
 * Export backup as a downloaded JSON file (PWA-04 / D-09 / D-13). The download
 * is the genuine eviction backstop: iOS Safari can clear IndexedDB, so the file
 * the user saves is the real safety net.
 *
 * Never-throw contract (mirrors pwa/persist.ts): every browser call is wrapped
 * so a failed Blob/anchor/DB read surfaces as `{ ok: false }` rather than an
 * exception — the End-Show auto-backup (Task 3) fires this on the same confirm
 * that finalizes the show and must never break that flow.
 *
 * Serialization itself is pure and lives in @guezzer/core (`serializeExport`);
 * this module only reads the four Dexie tables into an `ExportSnapshot`, wraps
 * the result in a Blob, and triggers an anchor download. The File System Access
 * API (`showSaveFilePicker`) is deliberately NOT used — it is unavailable on
 * iOS Safari, the primary target (05-RESEARCH §Don't Hand-Roll).
 */
import { serializeExport } from "@guezzer/core";
import { config } from "../config.ts";
import { snapshot } from "../db/db.ts";

/** Dated `YYYY-MM-DD` stamp for the backup filename (local time). */
function backupDateStamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Read the full Dexie snapshot, serialize the D-09 envelope, and trigger a
 * dated anchor download. Never throws (persist.ts idiom): returns `{ ok: true }`
 * on a completed download attempt, `{ ok: false }` if any step failed.
 */
export async function exportBackup(): Promise<{ ok: boolean }> {
  try {
    // Single assembly path (plan 06-07): db.snapshot() reads every table plus
    // the `owner` identity, so the v2 envelope (owner + archiveShows) is built
    // in ONE place shared with the import's local-snapshot read.
    const dbSnapshot = await snapshot();

    const envelope = serializeExport(
      dbSnapshot,
      config.dataSafety.SCHEMA_VERSION,
    );
    const json = JSON.stringify(envelope, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    try {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `guezzer-backup-${backupDateStamp()}.json`;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      // Always release the object URL, even if the click threw.
      URL.revokeObjectURL(url);
    }

    return { ok: true };
  } catch {
    // Never throw (D-13): a failed export must not break the End-Show finalize
    // flow that fires it. The prominent Settings export remains the retry path.
    return { ok: false };
  }
}

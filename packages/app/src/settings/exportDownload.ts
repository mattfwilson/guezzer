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
import { readIdentityRecord } from "../auth/identityRecord.ts";
import { triggerDownload } from "./triggerDownload.ts";

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
    // Scope the export to the signed-in identity (AUTH-05 / D-09, plan 18-07):
    // a backup carries ONLY that identity's rows, never a co-resident friend's
    // catches (Pitfall 6). With no identity present, ABORT rather than dump an
    // unscoped/foreign snapshot — the never-throw contract holds ({ ok: false }).
    const userId = readIdentityRecord()?.userId;
    if (userId == null) return { ok: false };

    // Single assembly path (plan 06-07): db.snapshot() reads every table plus
    // the `owner` identity, so the v2 envelope (owner + archiveShows) is built
    // in ONE place shared with the import's local-snapshot read.
    const dbSnapshot = await snapshot(userId);

    const envelope = serializeExport(
      dbSnapshot,
      config.dataSafety.SCHEMA_VERSION,
    );
    const json = JSON.stringify(envelope, null, 2);
    const blob = new Blob([json], { type: "application/json" });

    // Single anchor-download idiom (SAFE-02, D-07): defers the object-URL
    // revoke so iOS Safari has time to begin the download — a same-tick
    // revoke silently aborted the backup here (D-06).
    triggerDownload(blob, `guezzer-backup-${backupDateStamp()}.json`);

    return { ok: true };
  } catch {
    // Never throw (D-13): a failed export must not break the End-Show finalize
    // flow that fires it. The prominent Settings export remains the retry path.
    return { ok: false };
  }
}

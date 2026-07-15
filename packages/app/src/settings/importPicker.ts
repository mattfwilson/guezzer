/**
 * Import a backup file (PWA-04 / D-10 / D-12). The trust boundary: `file` is a
 * user- or friend-supplied file crossing into the local dex. It is treated as
 * hostile — validation, migration, and union-merge happen entirely in core
 * (`parseAndMergeImport`), which touches no DB. Only on `{ ok: true }` does this
 * module commit the merged snapshot in ONE Dexie transaction (`importSnapshot`).
 *
 * Atomicity (Pitfall 5 / T-05-15): a rejected import performs ZERO DB writes —
 * the merge never began, so partial state is impossible. A mid-write throw on a
 * valid import rolls the whole transaction back inside `db.importSnapshot`.
 *
 * Never-throw contract (mirrors pwa/persist.ts): `file.text()` and the commit
 * are wrapped so a read/write failure surfaces as an `{ ok: false }`
 * ImportResult rather than an exception the SettingsView would have to catch.
 */
import { parseAndMergeImport, type ImportResult } from "@guezzer/core";
import { config } from "../config.ts";
import { importSnapshot, snapshot } from "../db/db.ts";

/**
 * Validate + merge `file` via core, then (only on success) commit atomically.
 * On `{ ok: false }` the core result is returned UNCHANGED and no DB write
 * happens (D-12). Never throws — a read/commit failure returns `{ ok: false }`.
 */
export async function pickAndImport(file: File): Promise<ImportResult> {
  try {
    const text = await file.text();
    // The local snapshot core merges against — the same single assembly path
    // exportBackup uses (plan 06-07), so `owner`/`archiveShows` are included.
    const local = await snapshot();
    const result = parseAndMergeImport(
      text,
      local,
      config.dataSafety.SCHEMA_VERSION,
    );

    // Rejected file: return the core error verbatim, touch NOTHING (Pitfall 5).
    if (!result.ok) return result;

    // Valid file: commit the fully-merged snapshot in one rw transaction.
    await importSnapshot(result.merged);
    return result;
  } catch {
    // Never throw: a read/commit failure is reported like any rejected import.
    // This internal string is not user-facing — the SettingsView renders
    // config.copy.settings.importError* on any `ok: false` result.
    return { ok: false, error: "import-failed" };
  }
}

/**
 * Open a native file picker for a single JSON backup and hand the chosen file
 * to `onFile`. Uses a plain `<input type="file">` (works on iOS Safari, unlike
 * the File System Access API). Never throws.
 */
export function openBackupFilePicker(onFile: (file: File) => void): void {
  try {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) onFile(file);
    });
    input.click();
  } catch {
    // Never throw — a picker that fails to open simply does nothing.
  }
}

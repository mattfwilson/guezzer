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
import {
  exportEnvelope,
  parseAndMergeImport,
  type ExportEnvelope,
  type ImportResult,
} from "@guezzer/core";
import { config } from "../config.ts";
import { importSnapshot, snapshot } from "../db/db.ts";
import { readIdentityRecord } from "../auth/identityRecord.ts";

/**
 * The D-17 compare-vs-merge fork outcome (RESEARCH Pattern 5). `classifyImport`
 * runs the strict zod gate FIRST, then forks on `envelope.owner` vs the local
 * owner name BEFORE any merge code is reachable:
 *   - `invalid` — bad JSON or not a Guezzer backup (existing rejection path).
 *   - `mine`    — owner matches the local name → the Phase-5 merge path VERBATIM.
 *   - `friend`  — owner names someone else → route the PARSED envelope to the
 *                 read-only CompareView (structurally never reaches a write).
 *   - `unowned` — owner is null (a v1/unstamped file) OR the file is owned but the
 *                 LOCAL owner is unknown (e.g. an evicted DB — WARNING-1) → the app
 *                 prompts "Whose dex is this?"; the answer routes to mine or friend.
 */
export type ImportClassification =
  | { kind: "invalid"; error: string }
  | { kind: "mine"; rawJson: string }
  | { kind: "friend"; envelope: ExportEnvelope }
  | { kind: "unowned"; envelope: ExportEnvelope };

/**
 * Fork an import file's raw text into one of four outcomes (D-17 / Pattern 5).
 * Validation happens FIRST via the same strict `exportEnvelope` gate the merge
 * uses; only a valid envelope is ever routed. Owner comparison is trimmed +
 * case-insensitive. This is the structural guarantee: the friend/unowned kinds
 * carry the parsed envelope OUT to the compare view — they never touch a DB, and
 * `pickAndImport` (below) is called ONLY for the `mine` kind.
 */
export function classifyImport(
  rawJson: string,
  localOwnerName: string | null,
): ImportClassification {
  // Parse (T-05-05) then strict-shape gate (T-05-06) — reject the whole file on
  // any failure, exactly as parseAndMergeImport does, BEFORE any fork decision.
  let parsedUnknown: unknown;
  try {
    parsedUnknown = JSON.parse(rawJson);
  } catch {
    return { kind: "invalid", error: "invalid-json" };
  }
  const parsed = exportEnvelope.safeParse(parsedUnknown);
  if (!parsed.success) return { kind: "invalid", error: "invalid-shape" };
  const envelope = parsed.data;

  // Owner is the D-17 fork key. Absent/blank → prompt path (v1 files, unstamped).
  const fileOwner = envelope.owner?.trim();
  if (!fileOwner) return { kind: "unowned", envelope };

  // No local identity to compare against — e.g. an iOS-eviction reinstall wiped
  // the `ownerName` meta row (WARNING-1). We CANNOT tell an own-backup from a
  // friend's file, so route to the "Whose dex is this?" prompt rather than
  // silently assuming `friend` (which opens read-only compare and skips the
  // restore this export exists for, PWA-04). The prompt's "It's mine, restore
  // it" button reaches the merge path.
  const local = localOwnerName?.trim().toLowerCase();
  if (!local) return { kind: "unowned", envelope };
  if (local === fileOwner.toLowerCase()) return { kind: "mine", rawJson };
  return { kind: "friend", envelope };
}

/**
 * Validate + merge `file` via core, then (only on success) commit atomically.
 * On `{ ok: false }` the core result is returned UNCHANGED and no DB write
 * happens (D-12). Never throws — a read/commit failure returns `{ ok: false }`.
 */
export async function pickAndImport(file: File): Promise<ImportResult> {
  try {
    // Scope the import to the signed-in identity (AUTH-05 / D-09, plan 18-07):
    // the local snapshot is read for THIS identity, and the merged rows are
    // stamped with it on commit. With no identity present there is no scoped
    // merge to perform — reject rather than merge into a foreign/unscoped dex.
    const userId = readIdentityRecord()?.userId;
    if (userId == null) return { ok: false, error: "import-failed" };

    const text = await file.text();
    // The local snapshot core merges against — the same single assembly path
    // exportBackup uses (plan 06-07), so `owner`/`archiveShows` are included.
    const local = await snapshot(userId);
    const result = parseAndMergeImport(
      text,
      local,
      config.dataSafety.SCHEMA_VERSION,
    );

    // Rejected file: return the core error verbatim, touch NOTHING (Pitfall 5).
    if (!result.ok) return result;

    // Valid file: commit the fully-merged snapshot in one rw transaction, stamped
    // with the importing identity.
    await importSnapshot(result.merged, userId);
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

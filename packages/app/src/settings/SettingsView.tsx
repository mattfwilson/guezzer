/**
 * `#/settings` — the Backup & data surface (D-14 / PWA-04). Reached via the
 * AppMenu Settings entry (no 4th bottom tab). Scope-limited by design: ONE
 * section with the accent **Export backup** CTA (the single gold "losing a
 * phone can't lose a dex" action), a NEUTRAL **Import backup** flow with inline
 * success/error feedback, and a storage-protection readout. Ships NO
 * destructive/clear control (D-14 — no data-loss footgun on a hard-bar phase).
 *
 * Security (T-05-16): the import result surfaces fixed config copy and merge
 * COUNTS only — never an echoed imported string — and everything renders as
 * escaped React text (no dangerouslySetInnerHTML).
 */
import type { ImportResult } from "@guezzer/core";
import { useLiveQuery } from "dexie-react-hooks";
import {
  CircleCheck,
  Download,
  ShieldAlert,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { config } from "../config.ts";
import { getMeta, setMeta } from "../db/db.ts";
import type { PersistStatus } from "../pwa/persist.ts";
import { exportBackup } from "./exportDownload.ts";
import { openBackupFilePicker, pickAndImport } from "./importPicker.ts";

export function SettingsView() {
  const copy = config.copy.settings;
  const [exportDone, setExportDone] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Reactive read of the persistence status recorded by requestPersistenceOnce
  // (Plan 04). `undefined` while loading is treated as "not yet protected".
  const persistStatus = useLiveQuery(() =>
    getMeta<PersistStatus>("persistStatus"),
  );
  const isProtected = persistStatus === "persisted";

  // D-17 owner identity: reactive read of the meta `ownerName` row. Dexie is the
  // single source of truth (no useState mirror) — the input is a controlled
  // field over the live value, saved back on every change.
  const ownerName = useLiveQuery(() => getMeta<string>("ownerName"));

  const handleOwnerChange = (value: string) => {
    // Persist the trimmed name; an empty field clears the row (owner → null in
    // the export). The schema clamp is the security control; maxLength is UX.
    void setMeta("ownerName", value.trim());
  };

  const handleExport = async () => {
    const res = await exportBackup();
    setExportDone(res.ok);
  };

  const handleImport = () => {
    // Fresh attempt clears the previous result; the picker callback resolves
    // the merge and surfaces counts (success) or the rejection copy (failure).
    setImportResult(null);
    openBackupFilePicker((file) => {
      void pickAndImport(file).then(setImportResult);
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-8 pb-16">
      {/* Owner identity (D-17) — stamped on every export so friend imports fork
          to compare, never merge. */}
      <section className="flex flex-col gap-2">
        <label
          htmlFor="owner-name"
          className="text-[20px] font-semibold leading-tight text-text-primary"
        >
          {copy.ownerNameHeading}
        </label>
        <input
          id="owner-name"
          type="text"
          value={ownerName ?? ""}
          onChange={(e) => handleOwnerChange(e.target.value)}
          maxLength={config.dex.OWNER_NAME_MAX_LENGTH}
          placeholder={copy.ownerNamePlaceholder}
          autoComplete="off"
          className="min-h-11 w-full rounded-md border border-hairline bg-elevated px-3 text-base text-text-primary placeholder:text-text-muted touch-manipulation"
        />
        <p className="text-base leading-normal text-text-muted">
          {copy.ownerNameDescription}
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h1 className="text-[20px] font-semibold leading-tight text-text-primary">
          {copy.sectionHeading}
        </h1>

        {/* Export — the single accent CTA (D-13 / PWA-04). */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void handleExport()}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-4 text-[14px] font-semibold text-surface touch-manipulation"
          >
            <Download size={18} />
            {copy.exportCta}
          </button>
          <p className="text-base leading-normal text-text-muted">
            {copy.exportDescription}
          </p>
          {exportDone && (
            <p className="flex items-center gap-2 text-base leading-normal text-text-muted">
              <CircleCheck size={16} />
              <span>
                {copy.exportSuccess} {copy.exportSuccessDetail}
              </span>
            </p>
          )}
        </div>

        {/* Import — NEUTRAL (never accent); union-merge, non-destructive. */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleImport}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-hairline px-4 text-[14px] font-semibold text-text-primary touch-manipulation"
          >
            <Upload size={18} />
            {copy.importCta}
          </button>
          <p className="text-base leading-normal text-text-muted">
            {copy.importDescription}
          </p>

          {importResult?.ok && (
            <div className="flex flex-col gap-1 rounded-md border border-hairline bg-elevated p-3">
              <p className="flex items-center gap-2 text-[14px] font-semibold leading-tight text-text-primary">
                <CircleCheck size={16} />
                {copy.importSuccessHeading}
              </p>
              <p className="text-base leading-normal text-text-muted">
                {copy.importSuccessBody(
                  importResult.added.shows,
                  importResult.added.songs,
                )}
              </p>
            </div>
          )}

          {importResult && !importResult.ok && (
            <div className="flex flex-col gap-1 rounded-md border border-hairline bg-elevated p-3">
              <p className="text-[14px] font-semibold leading-tight text-text-primary">
                {copy.importErrorHeading}
              </p>
              <p className="text-base leading-normal text-text-muted">
                {copy.importErrorBody}
              </p>
            </div>
          )}
        </div>

        {/* Storage-protection readout (D-13) — status only, no control. */}
        <div className="flex items-start gap-2 border-t border-hairline pt-4">
          {isProtected ? (
            <ShieldCheck size={18} className="mt-0.5 shrink-0" />
          ) : (
            <ShieldAlert size={18} className="mt-0.5 shrink-0" />
          )}
          <div className="flex flex-col gap-1">
            <p className="text-base leading-normal text-text-primary">
              {isProtected ? copy.storageProtected : copy.storageNotProtected}
            </p>
            {!isProtected && (
              <p className="text-base leading-normal text-text-muted">
                {copy.storageNotProtectedBody}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

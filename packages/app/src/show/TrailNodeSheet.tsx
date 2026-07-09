/**
 * The trail-node edit sheet (04-UI-SPEC §Component Inventory, SHOW-07/D-15).
 * Opened by a CometTrail node tap. AppMenu bottom-sheet overlay idiom.
 *
 * Two shapes, keyed on `entry.isPlaceholder`:
 *   - A normal entry offers **Edit** (re-pick the song via the SearchSheet) and
 *     **Delete**. Delete is DESTRUCTIVE and requires an explicit confirm
 *     ("Delete this song?", red Delete / Cancel) — the D-15 split from the
 *     no-dialog one-tap Undo (04-06 Task 1). Confirming removes the entry by id;
 *     the derived tally recomputes automatically off the live query (SHOW-09).
 *   - A "???" placeholder offers **Name this song** (rename via the SearchSheet
 *     → `renameEntry`, clearing `isPlaceholder`, D-14/D-15) and **Skip** (leaves
 *     it as ???). It can also be deleted with the same confirm.
 *
 * Edit and rename share one path: both re-pick a real song through the core
 * `searchCatalog` engine and write via `renameEntry(id, songId, songName)`
 * (which also clears the placeholder flag). Song names render as React text
 * only — never `dangerouslySetInnerHTML` (T-04-14, ASVS V5).
 */
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { config } from "../config.ts";
import { deleteEntry, renameEntry, type TrackedEntry } from "../db/db.ts";
import { SearchSheet, type SearchSelection } from "./SearchSheet.tsx";

interface TrailNodeSheetProps {
  /** The tapped trail entry, or null when the sheet is closed. */
  entry: TrackedEntry | null;
  onClose: () => void;
}

export function TrailNodeSheet({ entry, onClose }: TrailNodeSheetProps) {
  const copy = config.copy.show;
  const [searchOpen, setSearchOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (!entry) return null;

  const close = () => {
    setSearchOpen(false);
    setConfirmingDelete(false);
    onClose();
  };

  // Edit + rename share this path: re-pick a real song and write via
  // renameEntry, which also clears isPlaceholder (D-14/D-15).
  const handlePick = (selection: SearchSelection) => {
    if (entry.id != null) {
      void renameEntry(entry.id, selection.songId, selection.songName);
    }
    close();
  };

  const handleDelete = () => {
    if (entry.id != null) void deleteEntry(entry.id);
    close();
  };

  // Edit / rename re-uses the fuzzy SearchSheet over the core catalog. Its
  // no-match "???" offer just cancels here (renaming to ??? is a no-op).
  if (searchOpen) {
    return (
      <SearchSheet
        open
        onClose={close}
        onSelect={handlePick}
        onUnknown={close}
      />
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={entry.songName}
      className="fixed inset-0 z-30 flex flex-col justify-end bg-black/50"
      onClick={close}
    >
      <div
        className="rounded-t-2xl border-t border-hairline bg-elevated px-4 pt-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 32px)" }}
        onClick={(event) => event.stopPropagation()}
      >
        {confirmingDelete ? (
          // Destructive confirm (D-15) — the split from one-tap Undo.
          <>
            <p className="text-[20px] font-semibold leading-tight text-text-primary">
              {copy.deleteHeading}
            </p>
            <p className="mt-2 text-base leading-normal text-text-muted">
              {copy.deleteBody}
            </p>
            <button
              type="button"
              onClick={handleDelete}
              className="mt-4 flex min-h-11 w-full items-center justify-center rounded-md bg-destructive px-4 text-[14px] font-semibold text-surface touch-manipulation"
            >
              {copy.deleteConfirm}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="mt-2 flex min-h-11 w-full items-center justify-center rounded-md border border-hairline px-4 text-[14px] font-semibold text-text-primary touch-manipulation"
            >
              {copy.deleteCancel}
            </button>
          </>
        ) : (
          <>
            <span className="block truncate text-[20px] font-semibold leading-tight text-text-primary">
              {entry.songName}
            </span>

            {/* Edit (normal) or Name this song (??? placeholder) — both re-pick
                via the SearchSheet and write through renameEntry. */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="mt-3 flex min-h-11 w-full items-center gap-2 rounded-md border border-hairline px-4 py-2 text-[14px] font-semibold text-text-primary touch-manipulation"
            >
              <Pencil size={18} />
              {entry.isPlaceholder ? copy.renameHeading : copy.editCta}
            </button>

            {/* Delete — opens the destructive confirm (never removes on this tap). */}
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="mt-2 flex min-h-11 w-full items-center gap-2 rounded-md border border-hairline px-4 py-2 text-[14px] font-semibold text-destructive touch-manipulation"
            >
              <Trash2 size={18} />
              {copy.deleteConfirm}
            </button>

            {/* ??? placeholders get an explicit Skip that leaves them as ???. */}
            {entry.isPlaceholder && (
              <button
                type="button"
                onClick={close}
                className="mt-2 flex min-h-11 w-full items-center justify-center rounded-md px-4 py-2 text-[14px] font-semibold text-text-muted touch-manipulation"
              >
                {copy.renameSkip}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

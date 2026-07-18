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
import { Sheet } from "../components/Sheet.tsx";
import { config } from "../config.ts";
import { deleteEntry, renameEntry, type TrackedEntry } from "../db/db.ts";
import { classifyOutcome } from "./scoring.ts";
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
  // renameEntry, which also clears isPlaceholder (D-14/D-15). The outcome is
  // re-classified against THIS entry's stored fan snapshot — the same
  // shownFanSongIds the trail rings read — so correcting a mis-logged song
  // honestly flips hit↔miss instead of preserving a stale hit (WR-01, SHOW-09).
  // A "???" placeholder's fan is empty (D-08), so its recomputed outcome stays a
  // miss. Fallback: if an entry somehow has no stored fan snapshot we can't
  // reclassify, so preserve its current outcome.
  const handlePick = (selection: SearchSelection) => {
    if (entry.id != null) {
      const outcome = entry.shownFanSongIds
        ? classifyOutcome(selection.songId, entry.shownFanSongIds)
        : entry.outcome;
      void renameEntry(entry.id, selection.songId, selection.songName, outcome);
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

  // A11Y-01 (D-01/D-02): the trail-node editor is now the shared modal <Sheet>.
  // Escape is centralized in the plan-01 dialogStack LIFO — we add NO bespoke
  // `document` keydown listener here, so when this sheet swaps to the SearchSheet
  // only the topmost dialog dismisses (RESEARCH Pitfall 2). The one-tap Undo lives
  // elsewhere (04-06); the confirm-gated deleteEntry split (D-15) is unchanged.
  return (
    <Sheet
      open
      onClose={close}
      modal
      variant="bottom-sheet"
      ariaLabel={entry.songName}
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
    </Sheet>
  );
}

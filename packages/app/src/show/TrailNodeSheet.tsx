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
import { useRef, useState } from "react";
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

  // ── Phase-22 SHEET-01: PROP-DRIVEN, and what the ref is actually for ────────
  //
  // WHY `open={entry != null}` instead of the shipped `if (!entry) return null`:
  // `<Sheet>` can only exit-animate a surface whose `open` PROP flips. A sheet
  // whose parent (or its own early return) stops rendering it dies
  // synchronously, `AnimatePresence` and all — no exit, no close-start window
  // (22-RESEARCH §Pitfall 1). This is one of the two bottom-sheet exit exemplars
  // of the D-21 device sample.
  //
  // WHY the ref — and NOT the reason that looks obvious. It does NOT supply the
  // content you see sliding away. `AnimatePresence` replays the `SheetSurface`
  // ELEMENT it captured on the last render where `open` was true, with frozen
  // props and frozen closures (22-02-PLAN §Pitfall 14); the JSX built below on
  // the closing render is handed to `<Sheet open={false}>`, which renders
  // nothing at all. The ref has one narrow job: let the `entry === null` render
  // build those immediately-discarded children WITHOUT dereferencing null.
  // Assigned during RENDER, never in an effect — the closing render must already
  // have the value.
  //
  // ⚠ ONLY THE RENDER READS `shown`. Every handler below reads the `entry` PROP.
  // See `handlePick` / `handleDelete` for why the ref would be the UNSAFE choice
  // there (T-22-36).
  const lastEntryRef = useRef<TrackedEntry | null>(null);
  if (entry) lastEntryRef.current = entry;
  const shown = entry ?? lastEntryRef.current;

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
  //
  // ⚠ T-22-36 — reads the `entry` PROP, never `shown` / `lastEntryRef.current`.
  // Inside a retained EXITING subtree this closure is FROZEN at the last present
  // render, so `entry` is exactly the row the sheet was opened on: the correct
  // write target. A call-time ref read would NOT be — if a new node were opened
  // during the ~200ms exit window, `lastEntryRef.current` would already point at
  // a DIFFERENT row while this frozen closure still belongs to the old one.
  const handlePick = (selection: SearchSelection) => {
    if (entry != null && entry.id != null) {
      const outcome = entry.shownFanSongIds
        ? classifyOutcome(selection.songId, entry.shownFanSongIds)
        : entry.outcome;
      void renameEntry(entry.id, selection.songId, selection.songName, outcome);
    }
    close();
  };

  // ⚠ T-22-36 — same rule as handlePick: the `entry` PROP, never the ref.
  const handleDelete = () => {
    if (entry != null && entry.id != null) void deleteEntry(entry.id);
    close();
  };

  // Edit / rename re-uses the fuzzy SearchSheet over the core catalog. Its
  // no-match "???" offer just cancels here (renaming to ??? is a no-op).
  //
  // This branch stays a REAL early return: it swaps one surface for another, and
  // `SearchSheet` is one of the five hand-rolled sheets D-16 deliberately keeps
  // off the primitive, so nothing here animates. It is also why the `<Sheet
  // open={…}>` below must NOT additionally be gated on `!searchOpen` — that
  // would re-introduce exactly the parent-conditional unmount this conversion
  // removed, killing the exit animation again.
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
      open={entry != null}
      onClose={close}
      modal
      variant="bottom-sheet"
      // `shown` is null only before anything was EVER opened. The sheet is closed
      // on that render, so it emits zero DOM nodes and this name is never
      // announced.
      ariaLabel={shown?.songName ?? ""}
    >
      {shown != null &&
        (confirmingDelete ? (
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
              {shown.songName}
            </span>

            {/* Edit (normal) or Name this song (??? placeholder) — both re-pick
                via the SearchSheet and write through renameEntry. */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="mt-3 flex min-h-11 w-full items-center gap-2 rounded-md border border-hairline px-4 py-2 text-[14px] font-semibold text-text-primary touch-manipulation"
            >
              <Pencil size={18} />
              {shown.isPlaceholder ? copy.renameHeading : copy.editCta}
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
            {shown.isPlaceholder && (
              <button
                type="button"
                onClick={close}
                className="mt-2 flex min-h-11 w-full items-center justify-center rounded-md px-4 py-2 text-[14px] font-semibold text-text-muted touch-manipulation"
              >
                {copy.renameSkip}
              </button>
            )}
          </>
        ))}
    </Sheet>
  );
}

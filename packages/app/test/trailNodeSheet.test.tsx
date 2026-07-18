import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrackedEntry } from "../src/db/db.ts";

/**
 * TrailNodeSheet wiring (SHOW-07/D-15). The db write helpers and the SearchSheet
 * are mocked so this is a focused unit test of the sheet's logic: the
 * destructive-delete confirm split (vs one-tap Undo), and that edit/rename
 * re-pick a song through the SearchSheet and write via renameEntry. Mocking
 * SearchSheet also avoids the @matrix bundle alias (unresolved under the vitest
 * app project).
 */
const deleteEntryMock = vi.fn();
const renameEntryMock = vi.fn();

vi.mock("../src/db/db.ts", () => ({
  deleteEntry: (...args: unknown[]) => deleteEntryMock(...args),
  renameEntry: (...args: unknown[]) => renameEntryMock(...args),
}));

vi.mock("../src/show/SearchSheet.tsx", () => ({
  SearchSheet: ({
    open,
    onSelect,
  }: {
    open: boolean;
    onSelect: (s: { songId: number; songName: string }) => void;
  }) =>
    open ? (
      <button
        type="button"
        onClick={() => onSelect({ songId: 205, songName: "Work This Time" })}
      >
        mock-search-pick
      </button>
    ) : null,
}));

// scoring.ts is NOT mocked — the sheet must run the real classifyOutcome so the
// edit path honestly re-derives hit/miss against the entry's stored fan (WR-01).

const { TrailNodeSheet } = await import("../src/show/TrailNodeSheet.tsx");
const { config } = await import("../src/config.ts");
const copy = config.copy.show;

function normalEntry(): TrackedEntry {
  return {
    id: 1,
    sessionId: "s",
    position: 1,
    songId: 101,
    songName: "Rattlesnake",
    setNumber: "1",
    outcome: "hit",
    shownFanSongIds: [101],
    isPlaceholder: false,
    source: "manual",
    loggedAt: 0,
  };
}

function placeholderEntry(): TrackedEntry {
  return {
    id: 2,
    sessionId: "s",
    position: 2,
    songId: null,
    songName: "???",
    setNumber: "1",
    outcome: "miss",
    shownFanSongIds: [],
    isPlaceholder: true,
    source: "manual",
    loggedAt: 0,
  };
}

describe("TrailNodeSheet edit/delete/rename (SHOW-07/D-15)", () => {
  afterEach(() => {
    cleanup();
    deleteEntryMock.mockClear();
    renameEntryMock.mockClear();
  });

  it("delete: goes through a destructive confirm before removing (the D-15 split from one-tap Undo)", () => {
    const onClose = vi.fn();
    render(<TrailNodeSheet entry={normalEntry()} onClose={onClose} />);

    // Normal entry offers Edit + Delete.
    expect(screen.getByRole("button", { name: copy.editCta })).toBeTruthy();

    // First Delete tap opens the confirm — nothing removed yet.
    fireEvent.click(screen.getByRole("button", { name: copy.deleteConfirm }));
    expect(deleteEntryMock).not.toHaveBeenCalled();
    expect(screen.getByText(copy.deleteHeading)).toBeTruthy();

    // Confirm actually removes the entry by id.
    fireEvent.click(screen.getByRole("button", { name: copy.deleteConfirm }));
    expect(deleteEntryMock).toHaveBeenCalledWith(1);
    expect(onClose).toHaveBeenCalled();
  });

  it("rename: a ??? placeholder re-picks via SearchSheet and calls renameEntry (isPlaceholder cleared)", () => {
    const onClose = vi.fn();
    render(<TrailNodeSheet entry={placeholderEntry()} onClose={onClose} />);

    // Placeholder offers Name this song + Skip.
    expect(screen.getByRole("button", { name: copy.renameSkip })).toBeTruthy();

    // Opening rename mounts the (mocked) SearchSheet; picking writes renameEntry.
    fireEvent.click(screen.getByRole("button", { name: copy.renameHeading }));
    fireEvent.click(screen.getByText("mock-search-pick"));

    // A ??? placeholder's stored fan is empty (D-08), so the recomputed outcome
    // stays a miss (WR-01).
    expect(renameEntryMock).toHaveBeenCalledWith(2, 205, "Work This Time", "miss");
    expect(onClose).toHaveBeenCalled();
  });

  it("edit: correcting a real HIT to a song outside that moment's fan flips it to a miss (WR-01)", () => {
    // A hit entry whose stored fan does NOT contain the corrected song id 205.
    // Editing it must re-classify against that fan, honestly flipping hit→miss
    // (the tally SHOW-09 depends on this).
    const entry: TrackedEntry = {
      ...normalEntry(),
      outcome: "hit",
      shownFanSongIds: [101, 102, 103], // 205 is NOT in the shown fan
    };
    const onClose = vi.fn();
    render(<TrailNodeSheet entry={entry} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: copy.editCta }));
    fireEvent.click(screen.getByText("mock-search-pick"));

    expect(renameEntryMock).toHaveBeenCalledWith(1, 205, "Work This Time", "miss");
    expect(onClose).toHaveBeenCalled();
  });

  it("edit: correcting a real entry to a song that WAS in that moment's fan stays a hit (WR-01)", () => {
    // The corrected song id 205 IS in the stored fan → outcome remains a hit.
    const entry: TrackedEntry = {
      ...normalEntry(),
      outcome: "miss",
      shownFanSongIds: [205, 300], // 205 IS in the shown fan
    };
    const onClose = vi.fn();
    render(<TrailNodeSheet entry={entry} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: copy.editCta }));
    fireEvent.click(screen.getByText("mock-search-pick"));

    expect(renameEntryMock).toHaveBeenCalledWith(1, 205, "Work This Time", "hit");
    expect(onClose).toHaveBeenCalled();
  });

  it("skip: leaves a ??? placeholder unchanged (no rename, no delete)", () => {
    const onClose = vi.fn();
    render(<TrailNodeSheet entry={placeholderEntry()} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: copy.renameSkip }));

    expect(renameEntryMock).not.toHaveBeenCalled();
    expect(deleteEntryMock).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  // A11Y-01 (D-01): migrated onto the shared <Sheet modal>, so Escape dismisses
  // via the LIFO dialogStack — and dismissing must NOT delete the entry.
  it("dismisses on Escape without deleting (A11Y-01)", () => {
    const onClose = vi.fn();
    render(<TrailNodeSheet entry={normalEntry()} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
    expect(deleteEntryMock).not.toHaveBeenCalled();
  });
});

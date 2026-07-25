import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArchiveArtifact, RarityIndex } from "@guezzer/core";

/**
 * SetlistView's first direct render coverage (plan 21-05, FOUND-04 / D-32 /
 * D-33). The component was previously exercised only indirectly, through
 * `showsList.test.tsx`'s retro drill-in, which asserts set headings and song
 * rows but never the header date.
 *
 * Pinned here — the two converted full-date sites, which are the same string in
 * two places and must not drift apart:
 *
 *  1. The visible header renders "Mon D, YYYY", never raw ISO.
 *  2. The dialog's `aria-label` announces that SAME text (D-33). Before the
 *     conversion it was the bare ISO date, which VoiceOver reads as a number
 *     sequence — the drill-in's only accessible name.
 *  3. The header span keeps `tabular-nums`: "Mon D, YYYY" still has a numeric
 *     day and year, so a column of dates stays optically aligned (UI-SPEC
 *     §Typography).
 *
 * `useLiveQuery` is stubbed to `undefined` so `db.archiveShows.get(showId)`
 * never resolves a fallback cache row and the bundled-archive branch is taken —
 * no Dexie, no fake-indexeddb, no async settling in this file.
 */
vi.mock("dexie-react-hooks", () => ({ useLiveQuery: () => undefined }));

const archive = {
  schemaVersion: 1 as const,
  latestShowDate: "2026-12-31",
  songs: { "101": "Rattlesnake", "102": "Robot Stop", "103": "The River" },
  shows: [
    {
      id: 4001,
      date: "2026-08-14",
      venue: "Brooklyn Steel",
      city: "Brooklyn",
      state: "NY",
      country: "USA",
      sets: [
        { n: "1" as const, songs: [101, 102] },
        { n: "e" as const, songs: [103] },
      ],
    },
  ],
} as unknown as ArchiveArtifact;

const rarity: RarityIndex = new Map();

const { SetlistView } = await import("../src/dex/SetlistView.tsx");

function renderSetlist() {
  return render(
    <SetlistView showId={4001} archive={archive} rarity={rarity} onClose={() => {}} />,
  );
}

afterEach(cleanup);

describe("SetlistView — full show date (FOUND-04, D-32, D-33)", () => {
  it("renders the header date as 'Mon D, YYYY', never raw ISO", () => {
    renderSetlist();
    expect(screen.getByText("Aug 14, 2026")).toBeInTheDocument();
    expect(screen.queryByText("2026-08-14")).toBeNull();
  });

  it("announces the same formatted date as the dialog's accessible name (D-33)", () => {
    renderSetlist();
    expect(screen.getByRole("dialog").getAttribute("aria-label")).toBe("Aug 14, 2026");
  });

  it("keeps tabular-nums on the header date span", () => {
    renderSetlist();
    expect(screen.getByText("Aug 14, 2026").className).toContain("tabular-nums");
  });

  it("still renders the venue and the set-grouped rows alongside the date", () => {
    renderSetlist();
    expect(screen.getByText("Brooklyn Steel, Brooklyn")).toBeInTheDocument();
    expect(screen.getAllByTestId("setlist-row").length).toBe(3);
  });
});

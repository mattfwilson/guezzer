import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ShowsList + SetlistView contract test (plan 06-09 Task 1, D-16/HIST-01). The
 * Dex Shows segment lists every attended show newest-first — tracked (finalized)
 * and retro-marked unified in ONE list, deduped by the deriveDex group-key rule.
 * Pinned here (rendered through DexView, which owns the openShow drill-in state):
 *
 *  1. Newest-first ordering across tracked + retro rows.
 *  2. A night that is BOTH tracked and retro-marked renders exactly one row (as
 *     tracked — the deriveDex dedupe rule).
 *  3. The tally chip renders only on tracked rows.
 *  4. Tapping a retro row opens the set-structured setlist (Set 1 → Encore
 *     headings in order, songs in position order — HIST-01).
 *  5. The "No shows yet" empty state is replaced by the list once rows exist.
 *
 * The real artifacts are tiny `vi.mock` fixtures; fake-indexeddb backs the reads.
 */
const stubArchive = {
  schemaVersion: 1 as const,
  latestShowDate: "2025-12-31",
  songs: { "101": "Rattlesnake", "102": "Robot Stop", "103": "The River" },
  shows: [
    {
      id: 3001,
      date: "2025-05-01",
      venue: "New Venue",
      city: "Newtown",
      state: null,
      country: "US",
      sets: [
        { n: "1" as const, songs: [101, 102] },
        { n: "e" as const, songs: [103] },
      ],
    },
    {
      id: 3002,
      date: "2024-05-01",
      venue: "Old Venue",
      city: "Oldtown",
      state: null,
      country: "US",
      sets: [{ n: "1" as const, songs: [101] }],
    },
  ],
};

vi.mock("@archive", () => ({ default: stubArchive }));
vi.mock("@dexAlbums", () => ({
  default: { schemaVersion: 1, albums: [], buckets: { covers: [], miscellaneous: [] } },
}));

const { config } = await import("../src/config.ts");
const { db } = await import("../src/db/db.ts");
const { DexView } = await import("../src/dex/DexView.tsx");

const copy = config.copy.dex;

async function clearTables() {
  await db.attendedShows.clear();
  await db.archiveShows.clear();
  await db.trackedShows.clear();
  await db.trackedEntries.clear();
}

async function markAttended(showId: number, date: string) {
  await db.attendedShows.put({ show_id: showId, showDate: date });
}

async function seedTracked(
  sessionId: string,
  date: string,
  showId: number | null,
  entries: Array<{ songId: number; songName: string; outcome: "hit" | "miss" }>,
) {
  await db.trackedShows.put({
    sessionId,
    date,
    status: "finalized",
    currentSetNumber: "1",
    startedAt: 1,
    showId,
    venueId: null,
    venueName: "Tracked Venue",
    city: "Tracktown",
  });
  await db.trackedEntries.bulkAdd(
    entries.map((e, i) => ({
      sessionId,
      position: i + 1,
      songId: e.songId,
      songName: e.songName,
      setNumber: "1" as const,
      outcome: e.outcome,
      shownFanSongIds: [] as number[],
      isPlaceholder: false,
      source: "manual" as const,
      loggedAt: 1,
    })),
  );
}

async function gotoShows() {
  render(<DexView />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: copy.segmentShows })).toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole("button", { name: copy.segmentShows }));
}

beforeEach(clearTables);
afterEach(cleanup);

describe("Dex Shows segment — ShowsList + SetlistView (D-16, HIST-01)", () => {
  it("lists attended shows newest-first", async () => {
    await markAttended(3001, "2025-05-01");
    await markAttended(3002, "2024-05-01");
    await gotoShows();

    const rows = await screen.findAllByTestId("show-row");
    expect(rows.length).toBe(2);
    // FOUND-04: rows render the shared "Mon D, YYYY" format, never raw ISO.
    expect(within(rows[0]).getByText("May 1, 2025")).toBeInTheDocument();
    expect(within(rows[1]).getByText("May 1, 2024")).toBeInTheDocument();
    expect(screen.queryByText("2025-05-01")).toBeNull();
    expect(screen.queryByText("2024-05-01")).toBeNull();
  });

  it("dedupes a night that is BOTH tracked and retro-marked into one tracked row", async () => {
    await seedTracked("t1", "2025-05-01", 3001, [
      { songId: 101, songName: "Rattlesnake", outcome: "hit" },
      { songId: 102, songName: "Robot Stop", outcome: "hit" },
    ]);
    await markAttended(3001, "2025-05-01");
    await gotoShows();

    const rows = await screen.findAllByTestId("show-row");
    expect(rows.length).toBe(1);
    expect(rows[0].getAttribute("data-kind")).toBe("tracked");
    expect(within(rows[0]).getByText(copy.showsTallyChip(2, 2))).toBeInTheDocument();
  });

  it("renders the tally chip only on tracked rows", async () => {
    await seedTracked("t1", "2025-05-01", 3001, [
      { songId: 101, songName: "Rattlesnake", outcome: "hit" },
      { songId: 102, songName: "Robot Stop", outcome: "hit" },
    ]);
    await markAttended(3002, "2024-05-01");
    await gotoShows();

    const rows = await screen.findAllByTestId("show-row");
    expect(rows.length).toBe(2);
    // Exactly one tally chip across both rows — the tracked one.
    expect(screen.getAllByTestId("show-tally-chip").length).toBe(1);
    const tracked = rows.find((r) => r.getAttribute("data-kind") === "tracked")!;
    expect(within(tracked).getByTestId("show-tally-chip")).toBeInTheDocument();
  });

  it("opens the set-structured setlist when a retro row is tapped (HIST-01)", async () => {
    await markAttended(3001, "2025-05-01");
    await gotoShows();

    const row = await screen.findByTestId("show-row");
    fireEvent.click(row);

    const headings = await screen.findAllByTestId("setlist-set-heading");
    expect(headings.map((h) => h.textContent)).toEqual([
      copy.setLabels["1"],
      copy.setLabels.e,
    ]);

    const songRows = screen.getAllByTestId("setlist-row");
    expect(songRows.length).toBe(3);
    expect(within(songRows[0]).getByText("Rattlesnake")).toBeInTheDocument();
    expect(within(songRows[1]).getByText("Robot Stop")).toBeInTheDocument();
    expect(within(songRows[2]).getByText("The River")).toBeInTheDocument();
  });

  it("replaces the 'No shows yet' empty state with the list once rows exist", async () => {
    // No attendance → empty state.
    await gotoShows();
    expect(await screen.findByText(copy.showsEmptyHeading)).toBeInTheDocument();
    expect(screen.queryAllByTestId("show-row").length).toBe(0);
    cleanup();

    // With a marked show → the list replaces the empty state.
    await markAttended(3001, "2025-05-01");
    await gotoShows();
    expect(await screen.findByTestId("show-row")).toBeInTheDocument();
    expect(screen.queryByText(copy.showsEmptyHeading)).toBeNull();
  });
});

/**
 * FOUND-04 — the ShowView header date (plan 21-05, D-32/D-35).
 *
 * ShowView's header is the seventh converted full-date site, and the only one
 * with no render harness in this repo: mounting it pulls the whole
 * Dexie/session/matrix/wake-lock stack, which is why `recapView.test.tsx` gives
 * its one full-ShowView integration case a 15s budget. Paying that cost again
 * for a single date string is not worth it, so this site is pinned by a source
 * scan instead (the `rebrand.test.ts` readFileSync idiom). The other six sites
 * are covered by real render assertions in this file, `setlistView.test.tsx`,
 * `archiveBrowser.test.tsx` and `recapView.test.tsx`.
 */
describe("FOUND-04 — ShowView header date (source guard)", () => {
  const showViewPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "../src/show/ShowView.tsx",
  );

  it("formats the header date through formatFullDate and never renders raw ISO", () => {
    const src = readFileSync(showViewPath, "utf8");
    expect(src).toContain("formatFullDate(session.active.date)");
    // The bare render is what a regression would look like.
    expect(src).not.toContain("{session.active.date}");
  });

  it("imports the shared helper rather than formatting inline", () => {
    const src = readFileSync(showViewPath, "utf8");
    expect(src).toContain('import { formatFullDate } from "../dex/formatDate.ts"');
    // No component-local Intl formatter — formatDate.ts is the single owner.
    expect(src).not.toContain("new Intl.DateTimeFormat");
  });
});

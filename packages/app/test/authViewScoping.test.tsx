import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * AUTH-05 read-half isolation (Plan 18-07 Task 1, D-09/D-11). Every
 * namespaced-table read in the four view consumers — ShowsList, ArchiveBrowser,
 * RecapView, GamesView — is scoped to the CURRENT identity's userId. Seeds two
 * identities' stamped rows on ONE Dexie DB, mocks `useAuthIdentity` to identity
 * A, and asserts each view shows only A's rows; re-mocking to identity B (which
 * has no rows) shows an EMPTY view in all four — B never sees A's shows/entries/
 * bingo on the same device (the borrowed-phone guarantee).
 *
 * The 141 KB real artifacts are tiny `vi.mock` stubs; fake-indexeddb backs the
 * live reads. `useAuthIdentity` is mocked via a mutable module variable so a
 * fresh render reads whichever identity the test set.
 */

const stubArchive = {
  schemaVersion: 1 as const,
  latestShowDate: "2025-12-31",
  songs: { "101": "Rattlesnake", "102": "Robot Stop", "103": "The River" },
  shows: [
    {
      id: 3001,
      date: "2025-05-01",
      venue: "Alpha Venue",
      city: "Alphatown",
      state: null,
      country: "US",
      sets: [
        { n: "1" as const, songs: [101, 102] },
        { n: "e" as const, songs: [103] },
      ],
    },
    {
      id: 3003,
      date: "2025-06-01",
      venue: "Gamma Venue",
      city: "Gammatown",
      state: null,
      country: "US",
      sets: [{ n: "1" as const, songs: [102] }],
    },
    {
      id: 3002,
      date: "2024-05-01",
      venue: "Beta Venue",
      city: "Betatown",
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

// The mutable identity the mocked hook returns — set before each render.
let mockIdentity: { userId: string; displayName: string } | null = null;
vi.mock("../src/auth/useAuthIdentity.ts", () => ({
  useAuthIdentity: () => mockIdentity,
}));

// GamesView builds the bingo context from the real artifacts on mount; stub it
// to the calm null branch so the replay-list scoping is what the test exercises.
vi.mock("../src/games/bingoContext.ts", () => ({
  getBingoContext: () => null,
  dexSnapshot: () => new Set<number>(),
}));

const { config } = await import("../src/config.ts");
const { db } = await import("../src/db/db.ts");
const { ShowsList } = await import("../src/dex/ShowsList.tsx");
const { ArchiveBrowser } = await import("../src/dex/ArchiveBrowser.tsx");
const { RecapView } = await import("../src/dex/RecapView.tsx");
const { GamesView } = await import("../src/games/GamesView.tsx");

const archive = stubArchive as unknown as import("@guezzer/core").ArchiveArtifact;
const USER_A = "user-A";
const USER_B = "user-B";

async function clearTables() {
  await db.attendedShows.clear();
  await db.archiveShows.clear();
  await db.trackedShows.clear();
  await db.trackedEntries.clear();
  await db.bingoCards.clear();
}

/** Seed a retro attendance stub stamped with an explicit userId. */
async function seedAttended(showId: number, date: string, userId: string) {
  await db.attendedShows.put({ show_id: showId, showDate: date, userId });
}

/** Seed a finalized tracked show + one hit entry, both stamped with userId. */
async function seedTracked(sessionId: string, date: string, userId: string) {
  await db.trackedShows.put({
    sessionId,
    date,
    status: "finalized",
    currentSetNumber: "1",
    startedAt: 1,
    showId: null,
    venueId: null,
    venueName: "Scoped Venue",
    city: "Scopetown",
    userId,
  });
  await db.trackedEntries.add({
    sessionId,
    position: 1,
    songId: 101,
    songName: "Rattlesnake",
    setNumber: "1",
    outcome: "hit",
    shownFanSongIds: [101],
    isPlaceholder: false,
    source: "manual",
    loggedAt: 1,
    userId,
  });
}

/** Seed a locked (replayable) bingo card stamped with userId. */
async function seedCard(sessionId: string, venueName: string, userId: string) {
  await db.bingoCards.put({
    cardId: sessionId,
    sessionId,
    card: {
      schemaVersion: 1,
      seed: "seed",
      vibe: "balanced",
      corpusVersion: "corpus",
      freeIndex: 12,
      squares: [],
    },
    caughtSnapshot: [],
    lockedAt: 1,
    showDate: "2026-07-14",
    venueName,
    city: "Scopetown",
    userId,
  });
}

beforeEach(async () => {
  await clearTables();
  mockIdentity = null;
});
afterEach(cleanup);

describe("AUTH-05 read-half: view consumers scope reads to the current identity (D-09)", () => {
  it("ShowsList shows only the current identity's attended shows", async () => {
    // A attends the 2025 show; B attends the 2024 show — one DB, two identities.
    await seedAttended(3001, "2025-05-01", USER_A);
    await seedAttended(3002, "2024-05-01", USER_B);

    // Identity A → A's row present, B's row NOT leaked.
    mockIdentity = { userId: USER_A, displayName: "A" };
    render(<ShowsList archive={archive} onOpenTracked={() => {}} onOpenRetro={() => {}} />);
    const rowA = await screen.findByTestId("show-row");
    expect(within(rowA).getByText("2025-05-01")).toBeInTheDocument();
    expect(screen.queryByText("2024-05-01")).not.toBeInTheDocument();
    expect(screen.queryAllByTestId("show-row")).toHaveLength(1);
    cleanup();

    // Identity B → B's row present, A's row NOT leaked.
    mockIdentity = { userId: USER_B, displayName: "B" };
    render(<ShowsList archive={archive} onOpenTracked={() => {}} onOpenRetro={() => {}} />);
    const rowB = await screen.findByTestId("show-row");
    expect(within(rowB).getByText("2024-05-01")).toBeInTheDocument();
    expect(screen.queryByText("2025-05-01")).not.toBeInTheDocument();
    expect(screen.queryAllByTestId("show-row")).toHaveLength(1);
  });

  it("ArchiveBrowser scopes already-attended detection to the current identity", async () => {
    // A marks show 3001; B marks show 3003 — both in the 2025 section, which is
    // expanded by default, so both rows render without a year-header tap.
    await seedAttended(3001, "2025-05-01", USER_A);
    await seedAttended(3003, "2025-06-01", USER_B);

    // Identity A → 3001 marked (A's), 3003 NOT marked (B's, not leaked).
    mockIdentity = { userId: USER_A, displayName: "A" };
    render(<ArchiveBrowser archive={archive} onClose={() => {}} />);
    await waitFor(() =>
      expect(
        screen.getByTestId("archive-row-3001").getAttribute("data-marked"),
      ).toBe("true"),
    );
    expect(screen.getByTestId("archive-row-3003").getAttribute("data-marked")).toBe(
      "false",
    );
    cleanup();

    // Identity B → 3003 marked (B's), 3001 NOT marked (A's, not leaked).
    mockIdentity = { userId: USER_B, displayName: "B" };
    render(<ArchiveBrowser archive={archive} onClose={() => {}} />);
    await waitFor(() =>
      expect(
        screen.getByTestId("archive-row-3003").getAttribute("data-marked"),
      ).toBe("true"),
    );
    expect(screen.getByTestId("archive-row-3001").getAttribute("data-marked")).toBe(
      "false",
    );
  });

  it("RecapView derives the setlist only for the current identity's tracked show", async () => {
    // A and B each tracked a DIFFERENT session that happens to share a sessionId
    // is impossible (UUID keys), so A owns "sA"; B owns "sB". RecapView("sA")
    // must render only under A.
    await seedTracked("sA", "2025-05-01", USER_A);
    await seedTracked("sB", "2024-05-01", USER_B);

    // Identity A → the session's setlist rows render.
    mockIdentity = { userId: USER_A, displayName: "A" };
    render(<RecapView sessionId="sA" onClose={() => {}} />);
    await waitFor(() =>
      expect(screen.getAllByTestId("recap-row").length).toBeGreaterThan(0),
    );
    cleanup();

    // Identity B → RecapView for A's session "sA" derives nothing (B's scope has
    // no "sA" show/entries) — A's tracked setlist is never leaked to B.
    mockIdentity = { userId: USER_B, displayName: "B" };
    render(<RecapView sessionId="sA" onClose={() => {}} />);
    await waitFor(() =>
      expect(screen.queryAllByTestId("recap-row")).toHaveLength(0),
    );
  });

  it("GamesView lists only the current identity's replayable bingo cards", async () => {
    await seedCard("sA", "Alpha Arena", USER_A);
    await seedCard("sB", "Beta Arena", USER_B);

    // Identity A → A's card appears; B's card is NOT leaked.
    mockIdentity = { userId: USER_A, displayName: "A" };
    render(<GamesView />);
    await screen.findByText("Alpha Arena");
    expect(screen.queryByText("Beta Arena")).not.toBeInTheDocument();
    cleanup();

    // Identity B → B's card appears; A's card is NOT leaked.
    mockIdentity = { userId: USER_B, displayName: "B" };
    render(<GamesView />);
    await screen.findByText("Beta Arena");
    expect(screen.queryByText("Alpha Arena")).not.toBeInTheDocument();
  });
});

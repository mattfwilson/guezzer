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
 * ArchiveBrowser contract test (plan 06-08, DEX-02/DEX-03, D-09..D-12, Pitfall 6).
 *
 * Pinned here:
 *  1. Year sections render newest-first; the most-recent year is expanded, the
 *     rest collapsed (offline year browse).
 *  2. The search field filters via the core fuzzy searcher.
 *  3. One-tap mark writes attendedShows + flashes "+{n} songs caught"; the row flips.
 *  4. Unmarking a retro-marked row is confirm-gated and deletes the attendance row.
 *  5. A live-tracked show renders marked with NO unmark control (Pitfall 6).
 *  6. Offline: the fallback row is hidden and replaced by the muted note.
 *  7. A fallback-fetched mark persists cachedSetlist to db.archiveShows with the
 *     song NAME sourced from the fetch result (a debut songId absent from the bundle).
 *
 * The 141 KB real artifact is a tiny `vi.mock` fixture; recent-shows is mocked
 * so no test performs real network I/O.
 */
const stubArchive = {
  schemaVersion: 1 as const,
  latestShowDate: "2025-12-13",
  songs: { "101": "Rattlesnake", "102": "Robot Stop", "103": "The River" },
  shows: [
    { id: 2025001, date: "2025-11-20", venue: "Red Rocks", city: "Morrison", state: "CO", country: "USA", sets: [{ n: "1" as const, songs: [101, 102] }] },
    { id: 2025002, date: "2025-06-10", venue: "The Gorge", city: "George", state: "WA", country: "USA", sets: [{ n: "1" as const, songs: [103] }] },
    { id: 2024001, date: "2024-08-15", venue: "Brooklyn Steel", city: "Brooklyn", state: "NY", country: "USA", sets: [{ n: "1" as const, songs: [101] }] },
    { id: 2023001, date: "2023-03-01", venue: "The Fillmore", city: "San Francisco", state: "CA", country: "USA", sets: [{ n: "1" as const, songs: [102] }] },
  ],
};

const fetchRecentShowsMock = vi.fn(async () => ({
  shows: [
    { id: 2026001, date: "2026-06-26", venue: "The Forum", city: "Los Angeles", state: "CA", country: "USA", sets: [{ n: "1" as const, songs: [999] }] },
  ],
  songs: { 999: "Summer Debut" } as Record<number, string>,
}));

vi.mock("@archive", () => ({ default: stubArchive }));
vi.mock("@dexAlbums", () => ({ default: { schemaVersion: 1, albums: [], buckets: { covers: [], miscellaneous: [] } } }));
vi.mock("@guezzer/core", async (importActual) => {
  const actual = await importActual<typeof import("@guezzer/core")>();
  return { ...actual, fetchRecentShows: fetchRecentShowsMock };
});

const { config } = await import("../src/config.ts");
const { db } = await import("../src/db/db.ts");
const { ArchiveBrowser } = await import("../src/dex/ArchiveBrowser.tsx");

const copy = config.copy.archive;
const archive = stubArchive as unknown as import("@guezzer/core").ArchiveArtifact;

async function clearTables() {
  await db.attendedShows.clear();
  await db.archiveShows.clear();
  await db.trackedShows.clear();
  await db.trackedEntries.clear();
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => value });
}

beforeEach(async () => {
  await clearTables();
  setOnline(true);
  fetchRecentShowsMock.mockClear();
});
afterEach(cleanup);

describe("ArchiveBrowser — mark attended shows (D-09..D-12)", () => {
  it("renders year sections newest-first, most-recent expanded, others collapsed", async () => {
    render(<ArchiveBrowser archive={archive} onClose={() => {}} />);

    // The 2025 (most recent) section is expanded — its shows are visible.
    await screen.findByText("Red Rocks");
    expect(screen.getByText("The Gorge")).toBeInTheDocument();

    // 2024 / 2023 are collapsed — their shows are not rendered yet.
    expect(screen.queryByText("Brooklyn Steel")).not.toBeInTheDocument();
    expect(screen.queryByText("The Fillmore")).not.toBeInTheDocument();

    // Year headers are ordered newest-first.
    const headers = screen.getAllByTestId("year-header").map((h) => h.textContent);
    expect(headers?.[0]).toContain("2025");
    expect(headers?.[1]).toContain("2024");
    expect(headers?.[2]).toContain("2023");
  });

  it("filters shows via the core fuzzy searcher", async () => {
    render(<ArchiveBrowser archive={archive} onClose={() => {}} />);
    await screen.findByText("Red Rocks");

    fireEvent.change(screen.getByPlaceholderText(copy.searchPlaceholder), {
      target: { value: "brooklyn" },
    });

    await screen.findByText("Brooklyn Steel");
    expect(screen.queryByText("Red Rocks")).not.toBeInTheDocument();
  });

  it("marks a show in one tap, flashes the caught count, and flips the row", async () => {
    render(<ArchiveBrowser archive={archive} onClose={() => {}} />);
    const row = await screen.findByTestId("archive-row-2025001");

    fireEvent.click(within(row).getByRole("button"));

    // attendedShows written, and the setlist size (2) flashes.
    await waitFor(() => expect(screen.getByText(copy.songsCaught(2))).toBeInTheDocument());
    expect(await db.attendedShows.get(2025001)).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByTestId("archive-row-2025001").getAttribute("data-marked")).toBe("true"),
    );
  });

  it("unmarks a retro-marked show behind a confirm dialog", async () => {
    await db.attendedShows.put({ show_id: 2025001, showDate: "2025-11-20" });
    render(<ArchiveBrowser archive={archive} onClose={() => {}} />);

    const row = await screen.findByTestId("archive-row-2025001");
    await waitFor(() => expect(row.getAttribute("data-marked")).toBe("true"));

    // Tap the marked row's state control → confirm dialog.
    fireEvent.click(within(row).getByRole("button"));
    await screen.findByText(copy.unmarkHeading);

    fireEvent.click(screen.getByRole("button", { name: copy.unmarkConfirm }));

    await waitFor(async () => expect(await db.attendedShows.get(2025001)).toBeUndefined());
  });

  it("renders a live-tracked show as marked with NO unmark control (Pitfall 6)", async () => {
    // A tracked show matching an archive show by DATE (unbound showId).
    await db.trackedShows.put({
      sessionId: "s-tracked",
      date: "2024-08-15",
      status: "finalized",
      currentSetNumber: "1",
      startedAt: 1,
      showId: null,
      venueId: null,
      venueName: null,
      city: null,
    });
    render(<ArchiveBrowser archive={archive} onClose={() => {}} />);

    // Expand the 2024 section.
    fireEvent.click(screen.getAllByTestId("year-header").find((h) => h.textContent?.includes("2024"))!);

    const row = await screen.findByTestId("archive-row-2024001");
    expect(row.getAttribute("data-marked")).toBe("true");
    // Tracked shows are history records — not unmarkable (no control).
    expect(within(row).queryByRole("button")).toBeNull();
  });

  it("hides the online fallback row and shows the offline note when offline", async () => {
    setOnline(false);
    render(<ArchiveBrowser archive={archive} onClose={() => {}} />);
    await screen.findByText("Red Rocks");

    expect(screen.queryByText(copy.fallbackSearch)).not.toBeInTheDocument();
    expect(screen.getByText(copy.offlineNote)).toBeInTheDocument();
  });

  it("persists a fallback-fetched mark to archiveShows with the debut song name", async () => {
    render(<ArchiveBrowser archive={archive} onClose={() => {}} />);
    await screen.findByText("Red Rocks");

    fireEvent.click(screen.getByRole("button", { name: copy.fallbackSearch }));

    // The fetched post-corpus show appears in the same row UI.
    const row = await screen.findByTestId("archive-row-2026001");
    expect(fetchRecentShowsMock).toHaveBeenCalled();

    fireEvent.click(within(row).getByRole("button"));

    await waitFor(async () => {
      const cached = await db.archiveShows.get(2026001);
      expect(cached).toBeTruthy();
      // The debut songId 999 (absent from the bundled archive) keeps its fetched name.
      expect(cached?.sets[0].songs[0]).toEqual({ songId: 999, songName: "Summer Debut" });
    });
    expect(await db.attendedShows.get(2026001)).toBeTruthy();
  });
});

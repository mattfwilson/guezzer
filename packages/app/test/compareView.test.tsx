import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CompareView render contract (SHAR-01, D-17, plan 06-10). CompareView is a
 * READ-ONLY trophy case: it runs the pure core deriveDex a SECOND time over the
 * friend's envelope and compareDexes-diffs it against your live dex, rendering
 * the persistent D-17 banner, You-vs-{name} columns, and the tier-sorted diff
 * lists — while writing NOTHING (the zero-writes proof re-snapshots every table
 * before/after render). The 141 KB real artifacts are tiny vi.mock fixtures;
 * fake-indexeddb backs the live reads (test/setup.ts).
 *
 * Archive: songs 101/102/103 over two shows —
 *   8001 (2019-01-01): 101,102   8002 (2019-02-01): 102,103
 * mine attends 8001 → {101,102}; friend envelope attends 8002 → {102,103}.
 * → onlyMine [101], onlyTheirs [103], shared [102].
 */
const stubArchive = {
  schemaVersion: 1 as const,
  latestShowDate: "2019-02-01",
  songs: { "101": "Rattlesnake", "102": "Robot Stop", "103": "The River" },
  shows: [
    { id: 8001, date: "2019-01-01", venue: "V1", city: "C1", state: null, country: "US", sets: [{ n: "1" as const, songs: [101, 102] }] },
    { id: 8002, date: "2019-02-01", venue: "V2", city: "C2", state: null, country: "US", sets: [{ n: "1" as const, songs: [102, 103] }] },
  ],
};

vi.mock("@archive", () => ({ default: stubArchive }));
vi.mock("@dexAlbums", () => ({
  default: { schemaVersion: 1, albums: [], buckets: { covers: [], miscellaneous: [] } },
}));

const { config } = await import("../src/config.ts");
const { db, snapshot } = await import("../src/db/db.ts");
const { CompareView } = await import("../src/dex/CompareView.tsx");

const copy = config.copy.compare;

/** A valid v2 friend envelope owned by Alice, attending show 8002. */
function friendEnvelope() {
  return {
    schemaVersion: 2,
    exportedAt: "2026-07-14T00:00:00.000Z",
    owner: "Alice",
    meta: [],
    attendedShows: [{ show_id: 8002, showDate: "2019-02-01" }],
    archiveShows: [],
    trackedShows: [],
    trackedEntries: [],
  } as unknown as import("@guezzer/core").ExportEnvelope;
}

async function clearTables() {
  await db.meta.clear();
  await db.attendedShows.clear();
  await db.archiveShows.clear();
  await db.trackedShows.clear();
  await db.trackedEntries.clear();
}

describe("CompareView — read-only friend diff (D-17)", () => {
  beforeEach(async () => {
    await clearTables();
    // My local attendance: show 8001 → I've caught {101,102}.
    await db.attendedShows.put({ show_id: 8001, showDate: "2019-01-01" });
  });
  afterEach(async () => {
    cleanup();
    await clearTables();
  });

  it("renders the persistent D-17 banner and You-vs-{name} columns", async () => {
    render(<CompareView envelope={friendEnvelope()} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(copy.banner("Alice"))).toBeTruthy();
    });
    expect(screen.getByText(copy.columnYou)).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
  });

  it("renders the tier-sorted diff sections with song names from the archive", async () => {
    render(<CompareView envelope={friendEnvelope()} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(copy.onlyYouHeading(1))).toBeTruthy();
    });
    expect(screen.getByText(copy.onlyThemHeading("Alice", 1))).toBeTruthy();
    // Default-open diff lists resolve names from archive.songs (React text only).
    expect(screen.getByText("Rattlesnake")).toBeTruthy(); // only mine (101)
    expect(screen.getByText("The River")).toBeTruthy(); // only theirs (103)
  });

  it("D-17: renders WITHOUT mutating any table (zero-writes proof)", async () => {
    const before = await snapshot();
    render(<CompareView envelope={friendEnvelope()} onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(copy.banner("Alice"))).toBeTruthy();
    });
    const after = await snapshot();
    expect(after).toEqual(before);
  });
});

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * RecapView contract test (plan 06-09, SHOW-14/STAT-02/D-13/D-14/D-15). RecapView
 * ONLY renders the pure core `RecapStats` from `deriveRecap` — the component
 * performs no stat arithmetic. Pinned here:
 *
 *  1. Hero tally text (`{hits}/{total} · {pct}%`) + "calls hit" caption.
 *  2. Source split line with the exact Phase-5 manual/editor decomposition.
 *  3. Show rarity score + rarest-catch-of-the-night rendering.
 *  4. The +N new-catches row is present when n > 0 and OMITTED entirely at n = 0.
 *  5. The final setlist is grouped by set, each row wearing its hit/miss ring.
 *  6. Done fires onClose.
 *
 * The 141 KB real artifacts are tiny `vi.mock` fixtures; fake-indexeddb backs the
 * live reads.
 */
const stubArchive = {
  schemaVersion: 1 as const,
  latestShowDate: "2025-12-31",
  songs: { "101": "Rattlesnake", "102": "Robot Stop", "103": "The River", "104": "Gaia" },
  shows: [
    { id: 8001, date: "2019-01-01", venue: "V1", city: "C1", state: null, country: "US", sets: [{ n: "1" as const, songs: [101, 102, 103, 104] }] },
    { id: 8002, date: "2019-02-01", venue: "V2", city: "C2", state: null, country: "US", sets: [{ n: "1" as const, songs: [101, 102] }] },
    { id: 8003, date: "2019-03-01", venue: "V3", city: "C3", state: null, country: "US", sets: [{ n: "1" as const, songs: [101] }] },
  ],
};

vi.mock("@archive", () => ({ default: stubArchive }));
vi.mock("@dexAlbums", () => ({
  default: { schemaVersion: 1, albums: [], buckets: { covers: [], miscellaneous: [] } },
}));
// Phase-15: RecapView now calls loadMatrix() to build the bingo-replay context.
// The real bundled @matrix artifact is used (the seam test already renders
// ShowView through getMatrixIndex), so no @matrix mock is needed here.

const { config } = await import("../src/config.ts");
const { db } = await import("../src/db/db.ts");
const { RecapView } = await import("../src/dex/RecapView.tsx");

const copy = config.copy.recap;

async function clearTables() {
  await db.attendedShows.clear();
  await db.archiveShows.clear();
  await db.trackedShows.clear();
  await db.trackedEntries.clear();
  await db.bingoCards.clear();
}

/** A minimal locked BingoCardRow for `sessionId` — 16 filler song squares + free. */
function makeCardRow(sessionId: string) {
  const squares = Array.from({ length: 16 }, (_unused, i) =>
    i === 5
      ? ({ kind: "free" } as const)
      : ({ kind: "song", songId: 900 + i, label: `Filler ${i}` } as const),
  );
  return {
    cardId: sessionId,
    sessionId,
    card: {
      schemaVersion: 1 as const,
      seed: "seed",
      vibe: "balanced" as const,
      corpusVersion: "corpus",
      freeIndex: 5,
      squares,
    },
    caughtSnapshot: [] as number[],
    lockedAt: 1,
    showDate: "2026-07-14",
    venueName: "Test Arena",
    city: "Testville",
  };
}

async function seedSession() {
  await db.trackedShows.put({
    sessionId: "s1",
    date: "2026-07-14",
    status: "finalized",
    currentSetNumber: "e",
    startedAt: 1,
    showId: null,
    venueId: null,
    venueName: "Test Arena",
    city: "Testville",
  });
  const base = { sessionId: "s1", shownFanSongIds: [] as number[], loggedAt: 1 };
  await db.trackedEntries.bulkAdd([
    { ...base, position: 1, songId: 101, songName: "Rattlesnake", setNumber: "1", outcome: "hit", isPlaceholder: false, source: "manual" },
    { ...base, position: 2, songId: 102, songName: "Robot Stop", setNumber: "1", outcome: "hit", isPlaceholder: false, source: "manual" },
    { ...base, position: 3, songId: 103, songName: "The River", setNumber: "1", outcome: "miss", isPlaceholder: false, source: "manual" },
    { ...base, position: 4, songId: 104, songName: "Gaia", setNumber: "e", outcome: "hit", isPlaceholder: false, source: "editor" },
  ]);
}

beforeEach(clearTables);
afterEach(cleanup);

describe("RecapView — the payoff screen (SHOW-14, D-14/D-15)", () => {
  it("renders the hero tally and 'calls hit' caption", async () => {
    await seedSession();
    render(<RecapView sessionId="s1" onClose={() => {}} />);
    await screen.findByText(copy.heading);
    // 3 hits (101, 102, 104) of 4 total → 75%.
    expect(screen.getByText(copy.heroTally(3, 4, 75))).toBeInTheDocument();
    expect(screen.getByText(copy.heroCaption)).toBeInTheDocument();
  });

  it("renders the source split with exact numbers (D-14)", async () => {
    await seedSession();
    render(<RecapView sessionId="s1" onClose={() => {}} />);
    await screen.findByText(copy.heading);
    // manual: 2 hits of 3 · editor assists: 1
    expect(screen.getByText(copy.sourceSplit(2, 3, 1))).toBeInTheDocument();
  });

  it("renders the show rarity score + rarest catch of the night", async () => {
    await seedSession();
    render(<RecapView sessionId="s1" onClose={() => {}} />);
    await screen.findByText(copy.heading);
    // The River (playCount 1) is the rarest song of the night.
    expect(screen.getByText(copy.rarestOfNight("The River"))).toBeInTheDocument();
    expect(screen.getByText(/Show rarity:/)).toBeInTheDocument();
  });

  it("shows the +N new-catches row when n > 0", async () => {
    await seedSession();
    render(<RecapView sessionId="s1" onClose={() => {}} />);
    await screen.findByText(copy.heading);
    // No prior attendance → all four real songs are first-ever catches.
    expect(screen.getByTestId("recap-new-catches")).toBeInTheDocument();
    expect(screen.getByText(copy.newCatches(4))).toBeInTheDocument();
  });

  it("OMITS the new-catches row entirely when n = 0", async () => {
    await seedSession();
    // A prior retro show covering all four songs → zero new catches this night.
    await db.attendedShows.put({ show_id: 8001, showDate: "2019-01-01" });
    render(<RecapView sessionId="s1" onClose={() => {}} />);
    await screen.findByText(copy.heading);
    expect(screen.queryByTestId("recap-new-catches")).toBeNull();
  });

  it("groups the setlist by set with a hit/miss ring per row", async () => {
    await seedSession();
    render(<RecapView sessionId="s1" onClose={() => {}} />);
    await screen.findByText(copy.heading);

    const rows = screen.getAllByTestId("recap-row");
    expect(rows.length).toBe(4);
    expect(rows.map((r) => r.getAttribute("data-outcome"))).toEqual([
      "hit",
      "hit",
      "miss",
      "hit",
    ]);
    // Song 103 (The River) is the miss row — confirm the name is under it.
    const missRow = rows[2];
    expect(within(missRow).getByText("The River")).toBeInTheDocument();

    const setHeadings = screen.getAllByTestId("recap-set-heading").map((h) => h.textContent);
    expect(setHeadings).toEqual([config.copy.dex.setLabels["1"], config.copy.dex.setLabels.e]);
  });

  it("fires onClose from the Done CTA", async () => {
    await seedSession();
    const onClose = vi.fn();
    render(<RecapView sessionId="s1" onClose={onClose} />);
    await screen.findByText(copy.heading);
    fireEvent.click(screen.getByRole("button", { name: copy.done }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("Bingo replay section (BINGO-07, D-05 present/absent contract)", () => {
  it("renders the Bingo section when the session has a locked card", async () => {
    await seedSession();
    await db.bingoCards.put(makeCardRow("s1"));
    render(<RecapView sessionId="s1" onClose={() => {}} />);
    await screen.findByText(copy.heading);
    // D-05: a card exists → the Bingo section (heading) renders.
    expect(await screen.findByText(copy.bingoHeading)).toBeInTheDocument();
  });

  it("renders NO Bingo section when the session has no card (D-05)", async () => {
    await seedSession();
    render(<RecapView sessionId="s1" onClose={() => {}} />);
    await screen.findByText(copy.heading);
    // D-05: no card row for this session → the Bingo section is absent entirely.
    expect(screen.queryByText(copy.bingoHeading)).toBeNull();
  });
});

describe("End Show → recap seam (D-13, RESEARCH Pattern 6)", () => {
  it("auto-shows the recap after confirming End Show, then returns to pre-show on Done", async () => {
    const showCopy = config.copy.show;

    // An active tracked show — the recap must render even AFTER endShow flips it
    // finalized (the recap check precedes the `!session.active` early return).
    await db.trackedShows.put({
      sessionId: "seam1",
      date: "2026-07-14",
      status: "active",
      currentSetNumber: "1",
      startedAt: 1,
      showId: null,
      venueId: null,
      venueName: "Seam Arena",
      city: null,
    });

    const { ShowView } = await import("../src/show/ShowView.tsx");
    render(<ShowView />);

    // Active show → End Show now lives in the FAB speed-dial (last item). Open the
    // FAB, tap End Show, then confirm.
    fireEvent.click(await screen.findByRole("button", { name: showCopy.fabLabel }));
    fireEvent.click(await screen.findByRole("button", { name: showCopy.endCta }));
    fireEvent.click(await screen.findByRole("button", { name: showCopy.endConfirm }));

    // The recap auto-appears with no navigation — the payoff moment.
    await screen.findByText(copy.heading);

    // Done → the recap clears and the pre-show launcher returns.
    fireEvent.click(screen.getByRole("button", { name: copy.done }));
    await screen.findByText(showCopy.startCta);
  });
});

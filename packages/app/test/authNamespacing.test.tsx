import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * AUTH-05 read-half for the dex-stats surface (Plan 18-06 Task 2, D-09/D-11).
 * `useDexStats` must scope its four namespaced-table live reads to the CURRENT
 * identity's userId (`where("userId").equals(currentUserId)`) — the SAME idiom
 * the four Plan-07 view consumers use. Seeds two identities' stamped attendance
 * on ONE Dexie DB, mounts the hook under identity A, and asserts A sees A's
 * caught songs; re-mounting under identity B (which has no rows) yields an EMPTY
 * dex — a borrowed phone never shows the previous friend's numbers.
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

const { db } = await import("../src/db/db.ts");
const { useDexStats } = await import("../src/dex/useDexStats.ts");

const USER_A = "user-A";
const USER_B = "user-B";

async function clearTables() {
  await db.attendedShows.clear();
  await db.archiveShows.clear();
  await db.trackedShows.clear();
  await db.trackedEntries.clear();
}

/** Seed a retro attendance stub stamped with an explicit userId. */
async function seedAttended(showId: number, date: string, userId: string) {
  await db.attendedShows.put({ show_id: showId, showDate: date, userId });
}

beforeEach(async () => {
  await clearTables();
  mockIdentity = null;
});
afterEach(cleanup);

describe("useDexStats — dex-stats reads scoped to the current identity (AUTH-05 / D-09)", () => {
  it("identity A sees A's caught songs; identity B sees an empty dex on the same DB", async () => {
    // A attended show 3001 (songs 101/102/103); B attended 3002 (song 101).
    await seedAttended(3001, "2025-05-01", USER_A);
    await seedAttended(3002, "2024-05-01", USER_B);

    // Identity A → all three of 3001's catalog songs are caught.
    mockIdentity = { userId: USER_A, displayName: "A" };
    const hookA = renderHook(() => useDexStats());
    await waitFor(() => expect(hookA.result.current.ready).toBe(true));
    expect(hookA.result.current.dex?.completion.caught).toBe(3);
    hookA.unmount();
    cleanup();

    // Identity B → B attended a DIFFERENT show; B never sees A's caught songs.
    // B's own show 3002 contributes song 101, so B's caught is exactly 1 — and
    // crucially NOT A's 3 (no cross-identity leak on the shared DB).
    mockIdentity = { userId: USER_B, displayName: "B" };
    const hookB = renderHook(() => useDexStats());
    await waitFor(() => expect(hookB.result.current.ready).toBe(true));
    expect(hookB.result.current.dex?.completion.caught).toBe(1);
  });

  it("an identity with no stamped rows sees a fully empty dex (borrowed-phone guarantee)", async () => {
    await seedAttended(3001, "2025-05-01", USER_A);

    // A fresh friend (no rows) on the same device sees zero caught — none of A's.
    mockIdentity = { userId: "user-fresh", displayName: "Fresh" };
    const { result } = renderHook(() => useDexStats());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.dex?.completion.caught).toBe(0);
  });
});

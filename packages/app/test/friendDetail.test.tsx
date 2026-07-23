import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  compareDexes,
  reconstructDexStats,
  type ArchiveArtifact,
  type DexAlbumsArtifact,
  type DexStats,
  type RarityIndex,
  type SharedProgress,
  type SongRarity,
} from "@guezzer/core";

/**
 * Phase-19 FriendDetail head-to-head regression pin (PROG-06 live wiring, WARNING 2).
 * This is a LIGHTWEIGHT render pin — NOT a UAT substitute; the full two-device live
 * round-trip stays in 19-04. It renders `<FriendDetail>` with a fixture friend
 * summary and asserts the `You vs {name}` head-to-head columns POPULATE with the
 * numbers `compareDexes(mine, reconstructDexStats(friend.summary, rarity))` produces
 * — a real render of the live path (reconstruct → UNCHANGED compareDexes), not a
 * typecheck. `useDexStats` is mocked so no Dexie derivation / network runs.
 */

// ── Fixtures (songId-only identity; tiers from the LOCAL rarity index, D-13) ──────
const rarity: RarityIndex = new Map<number, SongRarity>([
  [1, { songId: 1, playCount: 1, lastPlayedDate: "2020-01-01", corpusGap: 900, tier: "legendary" }],
  [2, { songId: 2, playCount: 5, lastPlayedDate: "2021-01-01", corpusGap: 300, tier: "rare" }],
  [3, { songId: 3, playCount: 50, lastPlayedDate: "2024-01-01", corpusGap: 2, tier: "common" }],
]);

const archive = {
  songs: { "1": "Am I in Heaven?", "2": "Robot Stop", "3": "Rattlesnake" },
} as unknown as ArchiveArtifact;

const albums = {
  albums: [{ albumUrl: "/albums/nonagon", title: "Nonagon Infinity", tracks: [] }],
  buckets: { covers: [], miscellaneous: [] },
} as unknown as DexAlbumsArtifact;

// Mine: caught {1, 2}; 3 distinct shows.
const mineDex: DexStats = {
  completion: { caught: 2, total: 4, pct: 50 },
  perSong: new Map([
    [1, { songId: 1, sightings: 1, lastSeenDate: null, personalGap: null, tier: "legendary" }],
    [2, { songId: 2, sightings: 1, lastSeenDate: null, personalGap: null, tier: "rare" }],
  ]),
  neverSeen: [],
  rarestCatch: { songId: 1, tier: "legendary" },
  showCount: 3,
  perAlbum: new Map([["/albums/nonagon", { caught: 2, total: 2 }]]),
};

// Friend: caught {2, 3}; 5 distinct shows (kept != caught so each column's figures
// are individually unambiguous for `getByText`). A SharedProgress payload as synced.
const friendSummary: SharedProgress = {
  v: 1,
  completion: { caught: 2, total: 4, pct: 50 },
  showCount: 5,
  rarest: { songId: 2, tier: "rare" },
  tierCounts: { common: 1, uncommon: 0, rare: 1, epic: 0, legendary: 0 },
  perAlbum: [{ key: "/albums/nonagon", caught: 1, total: 2 }],
  caughtSongIds: [2, 3],
};

const fixtureFriend = {
  userId: "friend-ada",
  displayName: "Ada",
  summary: friendSummary,
  updatedAt: null,
};

vi.mock("../src/dex/useDexStats.ts", () => ({
  useDexStats: () => ({
    ready: true,
    error: null,
    dex: mineDex,
    rarity,
    archive,
    albums,
  }),
}));

const { FriendDetail } = await import("../src/dex/FriendDetail.tsx");
const { config } = await import("../src/config.ts");

describe("FriendDetail: live head-to-head regression pin (PROG-06)", () => {
  afterEach(cleanup);

  it("renders the You vs {name} columns populated from the reconstructed compareDexes", () => {
    // The EXACT numbers the live path must produce (reconstruct → unchanged diff).
    const expected = compareDexes(mineDex, reconstructDexStats(friendSummary, rarity));

    render(<FriendDetail friend={fixtureFriend} onClose={() => {}} />);

    // Head-to-head heading leads the overlay (escaped friend name, D-08).
    expect(screen.getByText(config.copy.friends.versus("Ada"))).toBeInTheDocument();

    // Both stat-column headings render: `You` (columnYou) and the friend's name.
    const youHeading = screen.getByText(config.copy.compare.columnYou);
    const themHeading = screen.getByText("Ada", { selector: "p" });

    // Each column's numbers match compareDexes' output — a real render of the wiring.
    const youColumn = youHeading.closest("div")!;
    const themColumn = themHeading.closest("div")!;

    expect(within(youColumn).getByText(`${expected.columns.mine.completion}%`)).toBeInTheDocument();
    expect(within(youColumn).getByText(String(expected.columns.mine.caught))).toBeInTheDocument();
    expect(within(youColumn).getByText(String(expected.columns.mine.shows))).toBeInTheDocument();

    expect(within(themColumn).getByText(`${expected.columns.theirs.completion}%`)).toBeInTheDocument();
    expect(within(themColumn).getByText(String(expected.columns.theirs.caught))).toBeInTheDocument();
    expect(within(themColumn).getByText(String(expected.columns.theirs.shows))).toBeInTheDocument();

    // Sanity: the two sides differ where the fixtures differ (shows 3 vs 5) — proof
    // the columns are wired to the two distinct dexes, not one repeated.
    expect(expected.columns.mine.shows).toBe(3);
    expect(expected.columns.theirs.shows).toBe(5);
  });
});

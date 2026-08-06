import {
  cleanup,
  render,
  screen,
  waitForElementToBeRemoved,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The per-song truth contract (plan 06-06, D-05/D-08, STAT-01/03/04). Pins the
 * three informational SongRow states and their EXACT sublines, the tier-word
 * rendering (never color-only), the absence of any seen-toggle affordance (D-05),
 * and the WhyDetail STAT-01 corpus-stat line + debut-candidate branch.
 *
 * The real 141 KB archive is replaced with a tiny `vi.mock` fixture so the
 * WhyDetail rarity lookup resolves fast and deterministically.
 */
const { stubArchive } = vi.hoisted(() => ({
  stubArchive: {
    schemaVersion: 1,
    latestShowDate: "2025-01-15",
    songs: { "101": "Rattlesnake" },
    shows: [
      {
        id: 1000000001,
        date: "2025-01-15",
        venue: "V",
        city: "C",
        state: null,
        country: "US",
        sets: [{ n: "1", songs: [101] }],
      },
    ],
  },
}));

vi.mock("@archive", () => ({ default: stubArchive }));

const { SongRow } = await import("../src/dex/SongRow.tsx");
const { TierBadge } = await import("../src/dex/TierBadge.tsx");
const { WhyDetail } = await import("../src/show/WhyDetail.tsx");

import type { OrbitCandidate } from "../src/show/PredictionOrb.tsx";
import type { AlbumTrack, SongDexStats, SongRarity } from "@guezzer/core";

function track(over: Partial<AlbumTrack> = {}): AlbumTrack {
  return { songId: 101, slug: "rattlesnake", title: "Rattlesnake", position: 1, inMatrix: true, ...over };
}
function songStats(over: Partial<SongDexStats> = {}): SongDexStats {
  return { songId: 101, sightings: 3, lastSeenDate: "2025-01-15", personalGap: 2, tier: "rare", ...over };
}
function rarity(over: Partial<SongRarity> = {}): SongRarity {
  return { songId: 101, playCount: 50, lastPlayedDate: "2025-01-15", corpusGap: 4, tier: "rare", ...over };
}
function candidate(over: Partial<OrbitCandidate> = {}): OrbitCandidate {
  return {
    songId: 101,
    songName: "Rattlesnake",
    score: 0.42,
    factors: {} as OrbitCandidate["factors"],
    reason: "Because reasons.",
    tuningFamily: "standard",
    ...over,
  };
}

afterEach(cleanup);

describe("SongRow: derived per-song state (D-05, STAT-03/04)", () => {
  it("caught row shows the green check, sightings, last month, and personal gap", () => {
    render(<SongRow track={track()} songStats={songStats()} rarity={rarity()} />);
    expect(
      screen.getByText("Seen 3× · last Jan 2025 · 2 of your shows ago"),
    ).toBeInTheDocument();
    expect(screen.getByText("Rare")).toBeInTheDocument();
  });

  it("caught row at gap 0 collapses to 'last show'", () => {
    render(
      <SongRow track={track()} songStats={songStats({ personalGap: 0 })} rarity={rarity()} />,
    );
    expect(screen.getByText("Seen 3× · last show")).toBeInTheDocument();
  });

  it("unseen-with-history row shows the honest all-time play count + tier", () => {
    render(
      <SongRow track={track()} songStats={undefined} rarity={rarity({ playCount: 12, tier: "uncommon" })} />,
    );
    expect(screen.getByText("Played 12× all-time")).toBeInTheDocument();
    expect(screen.getByText("Uncommon")).toBeInTheDocument();
  });

  it("debut-candidate row has NO tier, NO percentage, and the honest copy", () => {
    const { container } = render(
      <SongRow track={track({ songId: null, inMatrix: false })} songStats={undefined} rarity={undefined} />,
    );
    expect(screen.getByText("Debut candidate")).toBeInTheDocument();
    expect(screen.getByText("Never played live — no odds to fake.")).toBeInTheDocument();
    expect(container.textContent).not.toContain("%");
    for (const tier of ["Common", "Uncommon", "Rare", "Legendary"]) {
      expect(screen.queryByText(tier)).toBeNull();
    }
  });

  it("has NO interactive toggle anywhere — rows are informational (D-05)", () => {
    const { container } = render(
      <SongRow track={track()} songStats={songStats()} rarity={rarity()} />,
    );
    expect(within(container).queryByRole("button")).toBeNull();
  });
});

describe("TierBadge: the word always renders (B3, color-blind safety)", () => {
  it.each(["common", "uncommon", "rare", "legendary"] as const)(
    "renders the %s tier word as text",
    (tier) => {
      render(<TierBadge tier={tier} />);
      const label = { common: "Common", uncommon: "Uncommon", rare: "Rare", legendary: "Legendary" }[tier];
      expect(screen.getByText(label)).toBeInTheDocument();
    },
  );
});

describe("WhyDetail: STAT-01 corpus line + D-08 debut branch", () => {
  it("shows the corpus-stat line for a song in the rarity index", () => {
    // songId 101 played once in the stub → playCount 1, corpusGap 0, last Jan 2025.
    render(<WhyDetail candidate={candidate({ songId: 101 })} onClose={() => {}} />);
    expect(screen.getByText("Played 1× · last Jan 2025 · gap 0")).toBeInTheDocument();
  });

  it("shows the debut branch (badge + honest copy, no corpus line) for an unknown song", () => {
    render(<WhyDetail candidate={candidate({ songId: 999 })} onClose={() => {}} />);
    expect(screen.getByText("Debut candidate")).toBeInTheDocument();
    expect(screen.getByText("Never played live — no odds to fake.")).toBeInTheDocument();
    expect(screen.queryByText(/Played .* gap/)).toBeNull();
  });
});

/**
 * Plan 22-10 — the bottom-sheet exit window, `WhyDetail` half.
 *
 * ⚠ THE `describe` NAME BELOW IS LOAD-BEARING. Plan 22-09's revert procedure 1
 * deletes this block BY NAME if the sanctioned enter-only fallback is taken. It
 * asserts an exit window that would no longer exist, and it lives OUTSIDE the
 * 22-02 exit commit, so `git revert` cannot remove it. Do not rename it.
 *
 * ⚠ NO `vi.mock("motion/react")` AND NO FAKE TIMERS in this file. A pass-through
 * double unmounts the exiting child instantly and makes every assertion here
 * vacuous; a hand-rolled "retaining" double would pass even against the
 * §Pitfall 14 defect. Fake timers desynchronise motion's rAF fallback loop.
 *
 * `WhyDetail` is deliberately covered HERE rather than in a new
 * `whyDetail.test.tsx` — the `candidate()` fixture factory and the `@archive`
 * stub above are its harness, and a second file would fork them.
 */
describe("bottom-sheet exit window (reverts with the 22-02 exit commit)", () => {
  const whyLabel = "Why Rattlesnake?";

  it("renders zero DOM nodes while closed", () => {
    render(<WhyDetail candidate={null} onClose={() => {}} />);

    // Always mounted (that is the conversion), `open` false — `AnimatePresence`
    // receives `false`, `onlyElements` filters it, nothing reaches document.body.
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it("retains the dialog node and carries the close-start contract on close", async () => {
    const { rerender } = render(
      <WhyDetail candidate={candidate({ songId: 101 })} onClose={() => {}} />,
    );
    const dialog = screen.getByRole("dialog", { name: whyLabel });
    expect(document.body.contains(dialog)).toBe(true);

    // Close the sheet the way ShowView does: the candidate prop goes null.
    rerender(<WhyDetail candidate={null} onClose={() => {}} />);

    // ── ANTI-VACUITY FIRST. Without this, a regression to the pre-conversion
    //    `if (!candidate) return null` would destroy the node synchronously and
    //    both assertions below would be reading a DETACHED element.
    expect(document.body.contains(dialog)).toBe(true);
    // D-19 #3 — VoiceOver must not read a sheet on its way out.
    expect(dialog.getAttribute("aria-hidden")).toBe("true");
    // D-19 #4 — the exiting card is its own interaction barrier (T-22-04).
    expect(dialog.style.pointerEvents).toBe("none");

    // Wait on the captured NODE, NEVER on `queryByRole("dialog")`: `*ByRole`
    // ignores `aria-hidden` subtrees, so once the assertion above passes a role
    // query returns null immediately and `waitForElementToBeRemoved` resolves
    // without ever observing removal — a SILENT false green (22-02 deviation 3).
    await waitForElementToBeRemoved(dialog, { timeout: 2000 });
  });

  it("shows no blank card during the exit, and the null-candidate render does not throw", async () => {
    const { rerender } = render(
      <WhyDetail candidate={candidate({ songId: 101 })} onClose={() => {}} />,
    );
    const dialog = screen.getByRole("dialog", { name: whyLabel });

    // ⚠ HONEST LABELLING — the two halves are guarded by DIFFERENT mechanisms,
    // and only the second is the `shown` derivation's doing:
    //
    //  (1) The name still being on screen is `AnimatePresence` retaining the
    //      element it FROZE at the last present render. It would read
    //      "Rattlesnake" even if the derivation were wrong, because that frozen
    //      element never re-renders. So this asserts a real user-visible outcome
    //      (no blank card slides away) — but NOT the derivation.
    //  (2) The rerender not throwing IS the derivation's job: without the
    //      last-non-null ref, the component's own `candidate === null` render
    //      would dereference null (in `ariaLabel`, in `getRarityIndex()?.get`,
    //      and throughout the body) while building children it is about to
    //      discard (T-22-37). This is the half that discriminates.
    expect(() =>
      rerender(<WhyDetail candidate={null} onClose={() => {}} />),
    ).not.toThrow();

    expect(document.body.contains(dialog)).toBe(true); // anti-vacuity
    expect(within(dialog).getByText("Rattlesnake")).toBeTruthy();

    await waitForElementToBeRemoved(dialog, { timeout: 2000 });
  });
});

/**
 * SwapSheet surface contract (plan 16-03, Task 3, BINGO-02, D-02/D-04/D-06).
 * jsdom assertions of the three load-bearing swap behaviors — the pure card
 * geometry (16 squares, single free) is already proven in core; pinned here:
 *
 *  1. Dedup (D-04): a candidate whose identity is already on the card renders
 *     disabled/greyed — no dead duplicate square can be created (consume-once).
 *  2. Custom flip (D-04): applying an individual swap yields a card that
 *     `isCardCustom` reports as deviating from its dealt vibe (→ the GamesView
 *     vibe label reads "Custom").
 *  3. Reshuffle confirm (D-06): with custom swaps present, tapping Reshuffle
 *     CONFIRMS before re-dealing — the only destructive control this phase.
 *
 * The Sheet portals to document.body, so `screen` finds the rendered content.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  deal,
  type BingoCard,
  type BingoContext,
  type BingoSquareDef,
} from "@guezzer/core";
import { SwapSheet } from "../../src/games/SwapSheet.tsx";
import { isCardCustom, type BingoNameMaps } from "../../src/games/bingoLabels.ts";
import { config } from "../../src/config.ts";

const copy = config.copy.games.bingo;

// A minimal marking context: a pool album present (so the Albums section renders
// it) plus a handful of recent-era songs.
const ctx: BingoContext = {
  microtonalSongIds: new Set<number>(),
  corpusGap: new Map<number, number>(),
  albumSongIds: new Map<string, ReadonlySet<number>>([
    ["/albums/nonagon-infinity", new Set([1, 2, 3])],
  ]),
  jamVehicleSongIds: new Set<number>(),
  // 20 recent-era songs — comfortably more than a single card can hold, so at
  // least one song candidate is always off-card (an enabled swap target).
  eraPlayRate: new Map<number, number>(
    Array.from({ length: 20 }, (_, k): [number, number] => [k + 1, 60 - k * 2]),
  ),
};

const nameMaps: BingoNameMaps = {
  songName: new Map<number, string>(
    Array.from({ length: 20 }, (_, k): [number, string] => [k + 1, `Song Name ${k + 1}`]),
  ),
  albumTitle: new Map<string, string>([["/albums/nonagon-infinity", "Nonagon Infinity"]]),
};

/** A valid 16-square card (free at index 5) from the given 15 fill squares. */
function buildCard(fill: BingoSquareDef[]): BingoCard {
  const squares: BingoSquareDef[] = [];
  let fi = 0;
  for (let i = 0; i < 16; i++) {
    squares.push(i === 5 ? { kind: "free" } : fill[fi++]);
  }
  return {
    schemaVersion: 1,
    seed: "manual-seed",
    vibe: "balanced",
    corpusVersion: "corpus-x",
    freeIndex: 5,
    squares,
  };
}

afterEach(cleanup);

describe("SwapSheet — swap / reshuffle surface (BINGO-02)", () => {
  it("greys + disables a candidate whose identity is already on the card (dedup, D-04)", () => {
    const fill: BingoSquareDef[] = [
      { kind: "album", albumUrl: "/albums/nonagon-infinity", label: "Nonagon Infinity" },
      ...Array.from(
        { length: 14 },
        (_, k): BingoSquareDef => ({ kind: "song", songId: 100 + k, label: `Song ${100 + k}` }),
      ),
    ];
    const card = buildCard(fill);

    render(
      <SwapSheet
        open
        onClose={() => {}}
        card={card}
        squareIndex={0}
        ctx={ctx}
        nameMaps={nameMaps}
        isCustom={false}
        onApplySwap={() => {}}
        onReshuffle={() => {}}
      />,
    );

    // The on-card album's chip is present but disabled — no duplicate square.
    const albumChip = screen.getByText("Nonagon Infinity").closest("button");
    expect(albumChip).not.toBeNull();
    expect(albumChip).toBeDisabled();
  });

  it("applying a swap produces a card that reads as Custom (custom-flip, D-04)", () => {
    const card = deal("seed-b", "balanced", ctx, new Set<number>(), "corpus-b");
    // Sanity: a freshly dealt card is not yet custom.
    expect(isCardCustom(card, ctx, new Set<number>())).toBe(false);

    let captured: BingoCard | null = null;
    const targetIndex = card.squares.findIndex((d, i) => i !== 5 && d.kind !== "free");

    render(
      <SwapSheet
        open
        onClose={() => {}}
        card={card}
        squareIndex={targetIndex}
        ctx={ctx}
        nameMaps={nameMaps}
        isCustom={false}
        onApplySwap={(c) => {
          captured = c;
        }}
        onReshuffle={() => {}}
      />,
    );

    // Pick a song NOT already on the card (an enabled candidate) and swap it in.
    const onCardSongs = new Set(
      card.squares.flatMap((d) => (d.kind === "song" ? [d.songId] : [])),
    );
    const freeSong = [...ctx.eraPlayRate.keys()].find((id) => !onCardSongs.has(id));
    expect(freeSong).toBeDefined();

    fireEvent.click(screen.getByText(nameMaps.songName.get(freeSong as number) as string));

    expect(captured).not.toBeNull();
    // The swapped card now deviates from a re-deal of its own seed/vibe → Custom.
    expect(isCardCustom(captured as unknown as BingoCard, ctx, new Set<number>())).toBe(true);
  });

  it("confirms before re-dealing when the card carries custom swaps (D-06)", () => {
    const card = deal("seed-c", "balanced", ctx, new Set<number>(), "corpus-c");
    let reshuffled = 0;

    render(
      <SwapSheet
        open
        onClose={() => {}}
        card={card}
        squareIndex={0}
        ctx={ctx}
        nameMaps={nameMaps}
        isCustom
        onApplySwap={() => {}}
        onReshuffle={() => {
          reshuffled += 1;
        }}
      />,
    );

    // Tapping the reshuffle control opens the destructive confirm (no re-deal yet).
    fireEvent.click(screen.getByRole("button", { name: copy.reshuffleConfirmCta }));
    expect(screen.getByText(copy.reshuffleConfirmHeading)).toBeInTheDocument();
    expect(screen.getByText(copy.reshuffleConfirmBody)).toBeInTheDocument();
    expect(reshuffled).toBe(0);

    // Confirming re-deals exactly once.
    fireEvent.click(screen.getByRole("button", { name: copy.reshuffleConfirmCta }));
    expect(reshuffled).toBe(1);
  });

  it("re-deals silently (no confirm) when there are no custom swaps (D-06)", () => {
    const card = deal("seed-d", "balanced", ctx, new Set<number>(), "corpus-d");
    let reshuffled = 0;

    render(
      <SwapSheet
        open
        onClose={() => {}}
        card={card}
        squareIndex={0}
        ctx={ctx}
        nameMaps={nameMaps}
        isCustom={false}
        onApplySwap={() => {}}
        onReshuffle={() => {
          reshuffled += 1;
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: copy.reshuffleConfirmCta }));
    // No confirm heading — the re-deal fired immediately.
    expect(screen.queryByText(copy.reshuffleConfirmHeading)).toBeNull();
    expect(reshuffled).toBe(1);
  });
});

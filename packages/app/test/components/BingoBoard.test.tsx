import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The ONE shared <BingoBoard> contract (Phase 16, BINGO-04). BingoBoard is a pure
 * render over `(marked, wins, songNameByPosition)` props — no artifact mocks
 * needed. Pinned here:
 *
 *  1. Shared: free square renders its label; an unmarked square is
 *     `aria-pressed="false"`; a marked square is `aria-pressed="true"`;
 *     `oneAwayIndex` puts the accent glow on exactly that square.
 *  2. `captionMode="persistent"`: a marked non-free square renders its
 *     "Lit by {song}" caption WITHOUT any interaction (Phase-15 D-06).
 *  3. `captionMode="tapReveal"`: the same square renders NO caption initially
 *     (clean stamp); clicking it surfaces the caption (D-16).
 *  4. `onSquareTap`: fires with the square index on click (orthogonal to tapReveal).
 *  5. `wins`: a winning square carries the non-visual `data-win` marker.
 *
 * jsdom-only — no timers/animation assertions (the glow pulse is CSS-gated).
 */
const { config } = await import("../../src/config.ts");
const { BingoBoard } = await import("../../src/components/BingoBoard.tsx");

import type { MarkedCard, Win } from "@guezzer/core";

const copy = config.copy.recap;

/**
 * A 3-square fixture exercising every state:
 *  - index 0: a SONG square marked by trail position 3 (litName distinct from its label).
 *  - index 1: an unmarked SONG square.
 *  - index 5: the pre-marked FREE center (markedByPosition = FREE_SENTINEL -1).
 */
function fixtureCard(): MarkedCard {
  return {
    squares: [
      { def: { kind: "song", songId: 101, label: "Anvil" }, index: 0, markedByPosition: 3 },
      { def: { kind: "song", songId: 102, label: "Boat" }, index: 1, markedByPosition: null },
      { def: { kind: "free" }, index: 5, markedByPosition: -1 },
    ],
    markedCount: 2,
  };
}

/** position 3 (the reindexed trail slot that lit square 0) → the song name for the caption. */
const songNameByPosition = new Map<number, string>([[3, "Rattlesnake"]]);

afterEach(cleanup);

describe("BingoBoard shared render", () => {
  it("renders the free label and marked/unmarked aria-pressed state", () => {
    render(
      <BingoBoard
        captionMode="persistent"
        marked={fixtureCard()}
        wins={[]}
        songNameByPosition={songNameByPosition}
      />,
    );

    // Free square label.
    expect(screen.getByText(copy.bingoFreeLabel)).toBeInTheDocument();

    // Unmarked square is a toggle button in the off state.
    const unmarked = screen.getByRole("button", { name: "Boat, unmarked" });
    expect(unmarked).toHaveAttribute("aria-pressed", "false");

    // Marked square is pressed and its accessible name carries the lit-by song.
    const marked = screen.getByRole("button", { name: "Anvil, marked, lit by Rattlesnake" });
    expect(marked).toHaveAttribute("aria-pressed", "true");

    // Free square is pre-marked (pressed).
    const free = screen.getByRole("button", { name: `${copy.bingoFreeLabel}, marked` });
    expect(free).toHaveAttribute("aria-pressed", "true");
  });

  it("puts the one-away glow on exactly the oneAwayIndex square", () => {
    render(
      <BingoBoard
        captionMode="persistent"
        marked={fixtureCard()}
        wins={[]}
        songNameByPosition={songNameByPosition}
        oneAwayIndex={1}
      />,
    );

    const glowing = screen.getByRole("button", { name: "Boat, unmarked" });
    expect(glowing).toHaveClass("bingo-oneaway-glow");
    expect(glowing).toHaveAttribute("data-oneaway", "true");

    // A different square does NOT carry the glow.
    const other = screen.getByRole("button", { name: "Anvil, marked, lit by Rattlesnake" });
    expect(other).not.toHaveClass("bingo-oneaway-glow");
    expect(other).not.toHaveAttribute("data-oneaway");
  });

  it("marks winning squares with the non-visual data-win attribute", () => {
    const wins: Win[] = [{ kind: "line", indices: [0] }];
    render(
      <BingoBoard
        captionMode="persistent"
        marked={fixtureCard()}
        wins={wins}
        songNameByPosition={songNameByPosition}
      />,
    );

    const winner = screen.getByRole("button", { name: "Anvil, marked, lit by Rattlesnake" });
    expect(winner).toHaveAttribute("data-win", "true");
    const loser = screen.getByRole("button", { name: "Boat, unmarked" });
    expect(loser).not.toHaveAttribute("data-win");
  });
});

describe("BingoBoard captionMode", () => {
  it("persistent: renders the lit-by caption with no interaction (D-06)", () => {
    render(
      <BingoBoard
        captionMode="persistent"
        marked={fixtureCard()}
        wins={[]}
        songNameByPosition={songNameByPosition}
      />,
    );

    expect(screen.getByText(copy.bingoLitBy("Rattlesnake"))).toBeInTheDocument();
  });

  it("tapReveal: clean stamp initially, then reveals the lit-by song on tap (D-16)", () => {
    render(
      <BingoBoard
        captionMode="tapReveal"
        marked={fixtureCard()}
        wins={[]}
        songNameByPosition={songNameByPosition}
      />,
    );

    // Clean stamp: no caption before interaction.
    expect(screen.queryByText(copy.bingoLitBy("Rattlesnake"))).not.toBeInTheDocument();

    // Tap the marked square → the caption appears.
    fireEvent.click(screen.getByRole("button", { name: "Anvil, marked, lit by Rattlesnake" }));
    expect(screen.getByText(copy.bingoLitBy("Rattlesnake"))).toBeInTheDocument();

    // Tapping again toggles it back off (transient disclosure).
    fireEvent.click(screen.getByRole("button", { name: "Anvil, marked, lit by Rattlesnake" }));
    expect(screen.queryByText(copy.bingoLitBy("Rattlesnake"))).not.toBeInTheDocument();
  });
});

describe("BingoBoard onSquareTap", () => {
  it("fires onSquareTap with the square index on click (orthogonal to tapReveal)", () => {
    const onSquareTap = vi.fn();
    render(
      <BingoBoard
        captionMode="persistent"
        marked={fixtureCard()}
        wins={[]}
        songNameByPosition={songNameByPosition}
        onSquareTap={onSquareTap}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Boat, unmarked" }));
    expect(onSquareTap).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole("button", { name: "Anvil, marked, lit by Rattlesnake" }));
    expect(onSquareTap).toHaveBeenCalledWith(0);
  });
});

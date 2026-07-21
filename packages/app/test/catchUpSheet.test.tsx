import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CatchUpSheet } from "../src/games/CatchUpSheet.tsx";
import { config } from "../src/config.ts";

/**
 * CatchUpSheet render contract (plan 15-04, Task 2, 15-UI-SPEC BINGO-06). A
 * lightweight jsdom assertion of the confirm-list SURFACE — the trail-grow /
 * re-light fold is already proven by bingoCatchup.test.ts (Task 1). Pinned here:
 *
 *  1. The pre-checked confirm-list renders one row per candidate, EACH checkbox
 *     ticked by default (D-03 glance-and-correct — never a silent bulk auto-adopt).
 *  2. The "Add {n}" submit reflects the checked count.
 *  3. An empty candidate list shows the "all caught up" copy (nothing-to-add).
 *  4. The manual "Search to add a song" affordance is ALWAYS offered (never a dead
 *     end), including when the candidate list is empty.
 *
 * The Sheet portals to document.body, so `screen` (which queries the whole
 * document) finds the rendered content.
 */
const copy = config.copy.catchUp;

afterEach(cleanup);

describe("CatchUpSheet — pre-checked confirm-list surface (BINGO-06)", () => {
  it("renders every candidate pre-checked with the Add {n} submit and the manual search", () => {
    const candidates = [
      { songId: 101, songName: "Rattlesnake" },
      { songId: 102, songName: "Robot Stop" },
    ];
    render(
      <CatchUpSheet
        open
        onClose={() => {}}
        sessionId="s1"
        candidates={candidates}
      />,
    );

    // Both kglw-derived song names render as escaped React text.
    expect(screen.getByText("Rattlesnake")).toBeInTheDocument();
    expect(screen.getByText("Robot Stop")).toBeInTheDocument();

    // Two checkbox rows, BOTH checked by default (D-03 pre-checked).
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(2);
    for (const box of boxes) {
      expect(box).toBeChecked();
    }

    // Add {n} reflects the two pre-checked rows.
    expect(
      screen.getByRole("button", { name: copy.addN(2) }),
    ).toBeInTheDocument();

    // The manual path is offered.
    expect(
      screen.getByRole("button", { name: copy.searchAffordance }),
    ).toBeInTheDocument();

    // Confirm-list heading + body copy present.
    expect(screen.getByText(copy.heading)).toBeInTheDocument();
    expect(screen.getByText(copy.body)).toBeInTheDocument();
  });

  it("shows the all-caught-up copy and STILL offers manual search when there is nothing to add", () => {
    render(
      <CatchUpSheet open onClose={() => {}} sessionId="s1" candidates={[]} />,
    );

    expect(screen.getByText(copy.allCaughtUp)).toBeInTheDocument();
    // No confirm-list rows / Add button when there is nothing to add.
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    // Manual search is never a dead end — always offered.
    expect(
      screen.getByRole("button", { name: copy.searchAffordance }),
    ).toBeInTheDocument();
  });

  it("shows the feed-error copy but still offers manual search when the feed is unavailable", () => {
    render(
      <CatchUpSheet
        open
        onClose={() => {}}
        sessionId="s1"
        candidates={[]}
        feedError
      />,
    );

    expect(screen.getByText(copy.feedError)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: copy.searchAffordance }),
    ).toBeInTheDocument();
  });

  it("renders nothing when closed (V7 — a closed sheet never throws)", () => {
    render(
      <CatchUpSheet
        open={false}
        onClose={() => {}}
        sessionId="s1"
        candidates={[{ songId: 101, songName: "Rattlesnake" }]}
      />,
    );
    expect(screen.queryByText("Rattlesnake")).toBeNull();
  });
});

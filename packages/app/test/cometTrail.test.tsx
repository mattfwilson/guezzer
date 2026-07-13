import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CometTrail } from "../src/show/CometTrail.tsx";
import { config } from "../src/config.ts";
import type { EntryOutcome, TrackedEntry } from "../src/db/db.ts";

/**
 * CometTrail render contract (SHOW-08): the last TRAIL_VISIBLE_RECENT songs as
 * diminishing nodes with hit/miss rings, +N compression at TRAIL_COMPRESS_AT,
 * and no strip pre-opener. All thresholds read from config.show (no inline
 * 4/30), so these assertions track the config defaults.
 */
function entry(
  position: number,
  outcome: EntryOutcome,
  songName = `Song ${position}`,
): TrackedEntry {
  return {
    id: position,
    sessionId: "s",
    position,
    songId: 100 + position,
    songName,
    setNumber: "1",
    outcome,
    shownFanSongIds: [],
    isPlaceholder: false,
    source: "manual",
    loggedAt: 0,
  };
}

/** Normalize a border color to a compact lowercase form (jsdom may emit rgb()). */
function borderColor(el: HTMLElement): string {
  return el.style.borderColor.replace(/\s+/g, "").toLowerCase();
}

const HIT_FORMS = ["#22c55e", "rgb(34,197,94)"];
const MISS_FORMS = ["#ef4444", "rgb(239,68,68)"];

describe("CometTrail recent strip + rings + compression (SHOW-08)", () => {
  afterEach(cleanup);

  it("renders nothing pre-opener (empty entries)", () => {
    const { container } = render(
      <CometTrail entries={[]} onNodeTap={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows only the last TRAIL_VISIBLE_RECENT songs as nodes", () => {
    const entries = Array.from({ length: 6 }, (_, i) =>
      entry(i + 1, "hit"),
    );
    render(<CometTrail entries={entries} onNodeTap={vi.fn()} />);

    // 6 < TRAIL_COMPRESS_AT → no +N chip; every button is a node.
    const nodes = screen.getAllByRole("button");
    expect(nodes).toHaveLength(config.show.TRAIL_VISIBLE_RECENT);

    // The visible window is the MOST RECENT N (positions 3..6), newest last.
    expect(screen.queryByText("Song 2")).toBeNull();
    expect(screen.getByText("Song 6")).toBeTruthy();
    expect(screen.getByText("Song 3")).toBeTruthy();
  });

  it("ring color derives from entry.outcome — hit green / miss red (D-06/D-08)", () => {
    const { container } = render(
      <CometTrail
        entries={[entry(1, "hit", "HitSong"), entry(2, "miss", "MissSong")]}
        onNodeTap={vi.fn()}
      />,
    );

    const circles = Array.from(
      container.querySelectorAll<HTMLElement>("span.border-2"),
    );
    expect(circles).toHaveLength(2);

    // Nodes render oldest→newest: [hit, miss].
    expect(HIT_FORMS).toContain(borderColor(circles[0]));
    expect(MISS_FORMS).toContain(borderColor(circles[1]));
    expect(borderColor(circles[0])).not.toBe(borderColor(circles[1]));
  });

  it("compresses older history into a tappable +N chip at TRAIL_COMPRESS_AT", () => {
    const { TRAIL_COMPRESS_AT, TRAIL_VISIBLE_RECENT } = config.show;

    // One below the threshold → no compression yet.
    const { rerender } = render(
      <CometTrail
        entries={Array.from({ length: TRAIL_COMPRESS_AT - 1 }, (_, i) =>
          entry(i + 1, "hit"),
        )}
        onNodeTap={vi.fn()}
      />,
    );
    expect(screen.queryByText(/^\+\d+$/)).toBeNull();

    // At the threshold → a +N chip summarizing the older overflow.
    rerender(
      <CometTrail
        entries={Array.from({ length: TRAIL_COMPRESS_AT }, (_, i) =>
          entry(i + 1, "hit"),
        )}
        onNodeTap={vi.fn()}
      />,
    );
    const expectedOlder = TRAIL_COMPRESS_AT - TRAIL_VISIBLE_RECENT;
    expect(screen.getByText(`+${expectedOlder}`)).toBeTruthy();
  });
});

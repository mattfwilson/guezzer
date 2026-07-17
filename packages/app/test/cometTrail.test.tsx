import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CometTrail, trailCapacity } from "../src/show/CometTrail.tsx";
import { config } from "../src/config.ts";
import type { EntryOutcome, TrackedEntry } from "../src/db/db.ts";
import { getMatrixIndex, loadMatrix } from "../src/show/matrix.ts";
import { tuningColor } from "../src/show/tuningColor.ts";

/**
 * CometTrail render contract (SHOW-08): the last TRAIL_VISIBLE_RECENT songs as
 * diminishing nodes with TUNING-FAMILY colored dots, +N compression at
 * TRAIL_COMPRESS_AT, and no strip pre-opener. All thresholds read from
 * config.show (no inline 4/30), so these assertions track the config defaults.
 */
function entry(
  position: number,
  outcome: EntryOutcome,
  songName = `Song ${position}`,
  songId: number | null = 100 + position,
): TrackedEntry {
  return {
    id: position,
    sessionId: "s",
    position,
    songId,
    songName,
    setNumber: "1",
    outcome,
    shownFanSongIds: [],
    isPlaceholder: false,
    source: "manual",
    loggedAt: 0,
  };
}

/** Normalize a background color to a compact lowercase form (jsdom may emit rgb()). */
function bgColor(el: HTMLElement): string {
  return el.style.backgroundColor.replace(/\s+/g, "").toLowerCase();
}

/**
 * Normalize an expected hex through jsdom the SAME way the rendered dot's inline
 * style is read back (jsdom serializes `backgroundColor` to `rgb(...)`), so the
 * comparison is form-agnostic (hex vs rgb).
 */
function normalizeColor(color: string): string {
  const el = document.createElement("div");
  el.style.backgroundColor = color;
  return bgColor(el);
}

const MUTED_FALLBACK = "#A1A1AA"; // tuningColor(null) — ??? / off-matrix

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

  it("dot fill derives from the song's tuning family; ??? / off-matrix → muted fallback (SHOW-08, B1)", () => {
    // jsdom loads the REAL bundled matrix. Pick a real songId whose family maps
    // to a NON-fallback color so the tuning-color path is visibly distinct from
    // the muted fallback (the off-matrix / ??? case).
    expect(loadMatrix().ok).toBe(true);
    const realPair = [...getMatrixIndex().nodeById.entries()].find(
      ([, node]) => tuningColor(node.tuningFamily) !== MUTED_FALLBACK,
    );
    expect(realPair).toBeTruthy();
    const [realId, realNode] = realPair!;
    // Expected color derived from the SAME expression the component uses — robust
    // to palette changes (no hardcoded hex), normalized through jsdom.
    const expectedReal = normalizeColor(tuningColor(realNode.tuningFamily));

    const { container } = render(
      <CometTrail
        entries={[
          entry(1, "hit", "RealSong", realId),
          entry(2, "miss", "PlaceholderSong", null), // ??? placeholder → fallback
        ]}
        onNodeTap={vi.fn()}
      />,
    );

    const dots = Array.from(
      container.querySelectorAll<HTMLElement>('[data-testid="trail-dot"]'),
    );
    expect(dots).toHaveLength(2);

    // Nodes render oldest→newest: [real-family song, ??? placeholder].
    expect(bgColor(dots[0])).toBe(expectedReal);
    expect(bgColor(dots[1])).toBe(normalizeColor(MUTED_FALLBACK));
    // The tuning color is distinct from the muted fallback.
    expect(bgColor(dots[0])).not.toBe(bgColor(dots[1]));
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

describe("CometTrail fit-to-width capacity (SHOW-08)", () => {
  afterEach(cleanup);

  const { TRAIL_NODE_SLOT_WIDTH: slot, TRAIL_NODE_GAP_PX: gap } = config.show;
  /** Exact px width that fits `n` fixed-width nodes: n*slot + (n-1)*gap. */
  const widthFor = (n: number) => n * slot + (n - 1) * gap;

  it("falls back to TRAIL_VISIBLE_RECENT when width is unknown / non-positive", () => {
    expect(trailCapacity(0)).toBe(config.show.TRAIL_VISIBLE_RECENT);
    expect(trailCapacity(-100)).toBe(config.show.TRAIL_VISIBLE_RECENT);
    // A narrow phone that only fits ~3 still never drops below the floor.
    expect(trailCapacity(widthFor(3))).toBe(config.show.TRAIL_VISIBLE_RECENT);
  });

  it("accumulates more nodes as the strip widens (desktop » mobile)", () => {
    expect(trailCapacity(widthFor(5))).toBe(5);
    expect(trailCapacity(widthFor(10))).toBe(10);
    expect(trailCapacity(widthFor(18))).toBe(18);
    // Monotonic: a wider strip never shows fewer nodes.
    expect(trailCapacity(1200)).toBeGreaterThan(trailCapacity(360));
  });

  it("renders more than the fallback window when the measured strip is wide", () => {
    // Force a wide measured clientWidth so the ResizeObserver-less jsdom path
    // still exercises the fit-to-width branch (capacity 10 for a 632px node area
    // = widthFor(10) inside 32px of px-4 padding). Define an own getter on the
    // prototype, then remove it to restore jsdom's inherited 0.
    const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
    Object.defineProperty(proto, "clientWidth", {
      configurable: true,
      get: () => widthFor(10) + 32,
    });
    try {
      const entries = Array.from({ length: 14 }, (_, i) => entry(i + 1, "hit"));
      const { container } = render(
        <CometTrail entries={entries} onNodeTap={vi.fn()} />,
      );
      const dots = container.querySelectorAll('[data-testid="trail-dot"]');
      expect(dots).toHaveLength(10);
    } finally {
      delete proto.clientWidth;
    }
  });

  it("measures width even when it first mounts EMPTY, then populates (regression)", () => {
    // The trail mounts pre-opener (entries=[]) → renders null → the strip div is
    // not in the DOM. A []-mount-effect would measure a null ref once and never
    // re-fire, freezing the count at the fallback (the on-device bug). The
    // callback ref must instead measure when the strip attaches on the first song.
    const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
    Object.defineProperty(proto, "clientWidth", {
      configurable: true,
      get: () => widthFor(10) + 32,
    });
    try {
      const { container, rerender } = render(
        <CometTrail entries={[]} onNodeTap={vi.fn()} />,
      );
      expect(
        container.querySelectorAll('[data-testid="trail-dot"]'),
      ).toHaveLength(0); // pre-opener: nothing

      const entries = Array.from({ length: 14 }, (_, i) => entry(i + 1, "hit"));
      rerender(<CometTrail entries={entries} onNodeTap={vi.fn()} />);
      // Fills the width (10), NOT the fallback window (4).
      expect(
        container.querySelectorAll('[data-testid="trail-dot"]'),
      ).toHaveLength(10);
    } finally {
      delete proto.clientWidth;
    }
  });
});

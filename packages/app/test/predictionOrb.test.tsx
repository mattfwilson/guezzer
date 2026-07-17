import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PredictionOrb, type OrbitCandidate } from "../src/show/PredictionOrb.tsx";
import type { OrbLayout } from "../src/show/orbitLayout.ts";
import { config } from "../src/config.ts";

/**
 * PredictionOrb gesture contract (Phase-8 POLISH): a quick face TAP logs
 * (`onTap`, SHOW-03); a LONG-PRESS (config `ORB_LONG_PRESS_MS`) opens the why
 * sheet (`onWhy`, D-11) and suppresses the trailing click so a hold never also
 * logs. The old (i) dot is now an sr-only, keyboard/AT-reachable "why" button.
 */
const candidate: OrbitCandidate = {
  songId: 1,
  songName: "Rattlesnake",
  score: 0.42,
  reason: "because",
  factors: {
    transitionProb: 0.4,
    decay: 1,
    rotation: 1,
    alreadyPlayed: 1,
    eraPrior: 1,
    backoffTier: "transition",
    hardSegueFlag: false,
  },
  tuningFamily: null,
};

const layout: OrbLayout = { songId: 1, x: 100, y: 100, diameterPx: 72 };

function renderOrb() {
  const onTap = vi.fn();
  const onWhy = vi.fn();
  render(
    <PredictionOrb
      candidate={candidate}
      layout={layout}
      isWeak={false}
      onTap={onTap}
      onWhy={onWhy}
    />,
  );
  const face = screen.getByRole("button", { name: /^Log Rattlesnake/ });
  return { onTap, onWhy, face };
}

describe("PredictionOrb tap-vs-long-press (D-11)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    cleanup();
  });

  it("a quick tap logs (onTap) and never opens why", () => {
    const { onTap, onWhy, face } = renderOrb();
    fireEvent.pointerDown(face, { clientX: 0, clientY: 0 });
    fireEvent.pointerUp(face, { clientX: 0, clientY: 0 });
    fireEvent.click(face);
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onWhy).not.toHaveBeenCalled();
  });

  it("a long-press opens why (onWhy) and suppresses the trailing tap — no log", () => {
    const { onTap, onWhy, face } = renderOrb();
    fireEvent.pointerDown(face, { clientX: 0, clientY: 0 });
    vi.advanceTimersByTime(config.show.ORB_LONG_PRESS_MS);
    expect(onWhy).toHaveBeenCalledTimes(1);
    // The click that trails the release must NOT also log.
    fireEvent.pointerUp(face, { clientX: 0, clientY: 0 });
    fireEvent.click(face);
    expect(onTap).not.toHaveBeenCalled();
  });

  it("drifting past the move threshold cancels the long-press (scroll, not hold)", () => {
    const { onWhy, face } = renderOrb();
    fireEvent.pointerDown(face, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(face, {
      clientX: config.show.ORB_LONG_PRESS_MOVE_PX + 5,
      clientY: 0,
    });
    vi.advanceTimersByTime(config.show.ORB_LONG_PRESS_MS);
    expect(onWhy).not.toHaveBeenCalled();
  });

  it("the sr-only why button opens why without logging (keyboard/AT path)", () => {
    const { onTap, onWhy } = renderOrb();
    fireEvent.click(screen.getByRole("button", { name: "Why Rattlesnake?" }));
    expect(onWhy).toHaveBeenCalledTimes(1);
    expect(onTap).not.toHaveBeenCalled();
  });
});

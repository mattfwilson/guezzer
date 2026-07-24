import { createElement, forwardRef, type ReactNode } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * WaveToast host (Phase 20, PRES-02/06). The host is a clone of
 * `BingoCelebration`'s module-emitter + App-level host, departing ONLY at a
 * bounded FIFO brief-drain queue (D-10). This spec covers the full <behavior>
 * table: no-op with no host, broadcast vs targeted copy, trusted-store sender
 * resolution (never the payload), one-at-a-time FIFO drain cadence, over-cap
 * drop, reduced-motion opacity-only, and the escaped-text (no-injection) guard.
 */

/** Controllable reduced-motion value + a plain-DOM motion mock (fake-timer safe). */
let reduced = false;
vi.mock("motion/react", () => ({
  useReducedMotion: () => reduced,
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        forwardRef(
          (
            { initial, animate, exit, transition, ...rest }: Record<string, unknown>,
            ref: unknown,
          ) =>
            createElement(tag, {
              ...rest,
              ref,
              "data-initial": JSON.stringify(initial),
            }),
        ),
    },
  ),
}));

/** The trusted friends store — the ONLY source of the sender display name (V5). */
let mockFriends: Array<{ userId: string; displayName: string }> = [];
vi.mock("../../src/sync/progressSync.ts", () => ({
  getSyncState: () => ({
    friends: mockFriends,
    offline: false,
    asOf: null,
    error: null,
  }),
}));

const { showWaveToast, subscribeWaveToast, WaveToast } = await import(
  "../../src/components/WaveToast.tsx"
);
const { config } = await import("../../src/config.ts");

const presence = config.copy.presence;
const { TOAST_MS, DRAIN_GAP_MS, QUEUE_CAP } = config.presence;

beforeEach(() => {
  reduced = false;
  mockFriends = [
    { userId: "u-matt", displayName: "Matt" },
    { userId: "u-sam", displayName: "Sam" },
    { userId: "u-al", displayName: "Al" },
    { userId: "u-jo", displayName: "Jo" },
    { userId: "u-eve", displayName: "Eve" },
  ];
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  cleanup();
});

describe("WaveToast emitter", () => {
  it("showWaveToast is a no-op when no host is mounted", () => {
    expect(() =>
      showWaveToast({ from: "u-matt", emoji: "👋", targeted: false }),
    ).not.toThrow();
  });

  it("subscribeWaveToast returns an unsubscribe that clears the listener", () => {
    const fn = vi.fn();
    const unsub = subscribeWaveToast(fn);
    showWaveToast({ from: "u-matt", emoji: "👋", targeted: false });
    expect(fn).toHaveBeenCalledTimes(1);
    unsub();
    showWaveToast({ from: "u-matt", emoji: "👋", targeted: false });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("WaveToast host rendering", () => {
  it("renders a broadcast wave as `{name} {emoji}` with no `to you` mark", () => {
    render(<WaveToast />);
    act(() => {
      showWaveToast({ from: "u-matt", emoji: "🔥", targeted: false });
    });
    const toast = screen.getByRole("status");
    expect(toast.textContent).toContain(presence.broadcast("Matt", "🔥"));
    expect(screen.queryByText(presence.toYou)).toBeNull();
    expect(toast.textContent).not.toContain("waved at you");
  });

  it("renders a targeted wave as `{name} waved at you {emoji}` plus a `to you` mark", () => {
    render(<WaveToast />);
    act(() => {
      showWaveToast({ from: "u-sam", emoji: "👋", targeted: true });
    });
    const toast = screen.getByRole("status");
    expect(toast.textContent).toContain(presence.targeted("Sam", "👋"));
    expect(screen.getByText(presence.toYou)).toBeInTheDocument();
  });

  it("resolves the sender name from the trusted store, never from the payload", () => {
    render(<WaveToast />);
    act(() => {
      // No name field exists on the payload — resolution is store-only.
      showWaveToast({ from: "u-al", emoji: "🦎", targeted: false });
    });
    expect(screen.getByRole("status").textContent).toContain("Al");
  });

  it("renders safely for an unknown `from` (escaped fallback, no crash)", () => {
    render(<WaveToast />);
    act(() => {
      showWaveToast({ from: "u-ghost", emoji: "👋", targeted: false });
    });
    const toast = screen.getByRole("status");
    expect(toast).toBeInTheDocument();
    expect(toast.textContent).toContain("👋");
  });

  it("does not inject markup from a hostile sender name (escaped React text)", () => {
    mockFriends = [
      { userId: "u-x", displayName: "<img src=x onerror=alert(1)>" },
    ];
    const { container } = render(<WaveToast />);
    act(() => {
      showWaveToast({ from: "u-x", emoji: "🔥", targeted: false });
    });
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("<img");
  });
});

describe("WaveToast FIFO brief-drain queue (D-10)", () => {
  it("drains a burst of 3 one-at-a-time as distinct FIFO pops", () => {
    render(<WaveToast />);
    act(() => {
      showWaveToast({ from: "u-matt", emoji: "🔥", targeted: false });
      showWaveToast({ from: "u-sam", emoji: "🦎", targeted: false });
      showWaveToast({ from: "u-al", emoji: "👋", targeted: false });
    });

    // First pop shows immediately.
    expect(screen.getByRole("status").textContent).toContain("Matt");

    // After TOAST_MS the first pop clears (nothing shown during the gap).
    act(() => vi.advanceTimersByTime(TOAST_MS));
    expect(screen.queryByRole("status")).toBeNull();

    // After DRAIN_GAP_MS the second pop appears.
    act(() => vi.advanceTimersByTime(DRAIN_GAP_MS));
    expect(screen.getByRole("status").textContent).toContain("Sam");

    act(() => vi.advanceTimersByTime(TOAST_MS));
    act(() => vi.advanceTimersByTime(DRAIN_GAP_MS));
    expect(screen.getByRole("status").textContent).toContain("Al");

    // Queue drains to empty.
    act(() => vi.advanceTimersByTime(TOAST_MS));
    act(() => vi.advanceTimersByTime(DRAIN_GAP_MS));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("drops over-cap waves once the buffer holds QUEUE_CAP items", () => {
    render(<WaveToast />);
    // QUEUE_CAP + 1 emits in one burst; the last one is over-cap and dropped.
    act(() => {
      showWaveToast({ from: "u-matt", emoji: "👋", targeted: false }); // shown + buffered
      showWaveToast({ from: "u-sam", emoji: "👋", targeted: false });
      showWaveToast({ from: "u-al", emoji: "👋", targeted: false });
      showWaveToast({ from: "u-jo", emoji: "👋", targeted: false }); // fills to QUEUE_CAP
      showWaveToast({ from: "u-eve", emoji: "👋", targeted: false }); // DROPPED
    });
    expect(QUEUE_CAP).toBe(4);

    const shown: string[] = [];
    shown.push(screen.getByRole("status").textContent ?? "");
    for (let i = 0; i < QUEUE_CAP - 1; i++) {
      act(() => vi.advanceTimersByTime(TOAST_MS));
      act(() => vi.advanceTimersByTime(DRAIN_GAP_MS));
      const el = screen.queryByRole("status");
      if (el) shown.push(el.textContent ?? "");
    }
    // Exactly QUEUE_CAP pops drained; the over-cap "Eve" never appeared.
    expect(shown).toHaveLength(QUEUE_CAP);
    expect(shown.some((t) => t.includes("Eve"))).toBe(false);
    expect(shown.some((t) => t.includes("Matt"))).toBe(true);
    expect(shown.some((t) => t.includes("Jo"))).toBe(true);

    act(() => vi.advanceTimersByTime(TOAST_MS));
    act(() => vi.advanceTimersByTime(DRAIN_GAP_MS));
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("WaveToast reduced-motion", () => {
  it("uses an opacity-only initial (no translate) under reduced motion", () => {
    reduced = true;
    render(<WaveToast />);
    act(() => {
      showWaveToast({ from: "u-matt", emoji: "👋", targeted: false });
    });
    const initial = screen.getByRole("status").getAttribute("data-initial");
    expect(initial).toBe(JSON.stringify({ opacity: 0 }));
  });

  it("uses a rise-in initial (opacity + y) under full motion", () => {
    reduced = false;
    render(<WaveToast />);
    act(() => {
      showWaveToast({ from: "u-matt", emoji: "👋", targeted: false });
    });
    const initial = screen.getByRole("status").getAttribute("data-initial");
    expect(JSON.parse(initial ?? "{}")).toHaveProperty("y");
  });
});

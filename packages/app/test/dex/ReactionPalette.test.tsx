import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Phase-20 WR-01 regression (from 20-REVIEW.md). `ReactionPalette` is kept
 * PERMANENTLY MOUNTED by FriendsList and only has its `open` prop toggled, so its
 * mount-time `useState` initialisers never re-run after a send/close. Without an
 * open-keyed reset, a reopened palette carries a stale `emoji`/`target`/`targetChosen`,
 * and the FIRST tap of the reopened sheet fires an unintended `sendWave`. These tests
 * pin the two-step selection reset: (a) the stale-first-tap send is gone, and (b)
 * reopening with a different `initialTarget` re-seeds the recipient.
 *
 * `presenceSync` is mocked to a single `sendWave` spy — it is the palette's only send
 * dependency. Friend names render as escaped React text (never dangerouslySetInnerHTML).
 */

const mockSendWave = vi.hoisted(() => vi.fn());
vi.mock("../../src/sync/presenceSync.ts", () => ({
  sendWave: mockSendWave,
}));

const { ReactionPalette } = await import("../../src/dex/ReactionPalette.tsx");
const { config } = await import("../../src/config.ts");
type FriendRowData = import("../../src/sync/friendCache.ts").FriendRowData;

const chip = config.copy.presence.chipLabels;

/** Minimal FriendRowData rows — the render only reads userId + displayName. */
function friend(userId: string, displayName: string): FriendRowData {
  return { userId, displayName, updatedAt: null } as unknown as FriendRowData;
}

const friends: FriendRowData[] = [friend("u-a", "Alice"), friend("u-b", "Bob")];

afterEach(() => {
  cleanup();
  mockSendWave.mockClear();
});

describe("ReactionPalette open-keyed selection reset (WR-01)", () => {
  it("(a) does NOT fire a stale wave on the first tap after reopening", () => {
    const { rerender } = render(
      <ReactionPalette open onClose={() => {}} friends={friends} />,
    );

    // Complete a clean two-step send: pick an emoji, then a target.
    fireEvent.click(screen.getByLabelText(chip.fire));
    fireEvent.click(screen.getByText("Alice"));
    expect(mockSendWave).toHaveBeenCalledTimes(1);

    // Close then reopen (FriendsList keeps the palette mounted, only toggles `open`).
    rerender(<ReactionPalette open={false} onClose={() => {}} friends={friends} />);
    rerender(<ReactionPalette open onClose={() => {}} friends={friends} />);

    // First tap of the reopened sheet only SELECTS a target — the stale emoji is gone.
    fireEvent.click(screen.getByText("Bob"));
    expect(mockSendWave).toHaveBeenCalledTimes(1);
  });

  it("(b) re-seeds the recipient from a changed initialTarget on reopen", () => {
    const { rerender } = render(
      <ReactionPalette
        open
        onClose={() => {}}
        initialTarget="u-a"
        friends={friends}
      />,
    );

    rerender(
      <ReactionPalette
        open={false}
        onClose={() => {}}
        initialTarget="u-a"
        friends={friends}
      />,
    );
    rerender(
      <ReactionPalette
        open
        onClose={() => {}}
        initialTarget="u-b"
        friends={friends}
      />,
    );

    // A single emoji tap after reopen sends to the NEW pre-selected target, not the stale one.
    fireEvent.click(screen.getByLabelText(chip.wave));
    expect(mockSendWave).toHaveBeenCalledTimes(1);
    expect(mockSendWave.mock.calls.at(-1)?.[1]).toBe("u-b");
  });
});

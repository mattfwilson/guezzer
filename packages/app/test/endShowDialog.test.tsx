import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * EndShowDialog wiring (D-04, T-04-18). `endShow` is mocked so this is a focused
 * unit test of the confirm gate: the dialog must call `endShow(sessionId)` ONLY
 * after an explicit confirm — never on cancel or the backdrop — proving an
 * accidental tap can't finalize the setlist read-only mid-show.
 */
const endShowMock = vi.fn();

vi.mock("../src/db/db.ts", () => ({
  endShow: (...args: unknown[]) => endShowMock(...args),
}));

const { EndShowDialog } = await import("../src/show/EndShowDialog.tsx");
const { config } = await import("../src/config.ts");
const copy = config.copy.show;

describe("EndShowDialog finalize confirm (D-04)", () => {
  afterEach(() => {
    cleanup();
    endShowMock.mockClear();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <EndShowDialog open={false} sessionId="s1" onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("finalizes only on an explicit confirm — calls endShow(sessionId)", () => {
    const onClose = vi.fn();
    render(<EndShowDialog open sessionId="s1" onClose={onClose} />);

    // The heading + destructive confirm are present; nothing finalized yet.
    expect(screen.getByText(copy.endHeading)).toBeTruthy();
    expect(endShowMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: copy.endConfirm }));

    expect(endShowMock).toHaveBeenCalledWith("s1");
    expect(onClose).toHaveBeenCalled();
  });

  it("does NOT finalize on cancel (Keep tracking)", () => {
    const onClose = vi.fn();
    render(<EndShowDialog open sessionId="s1" onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: copy.endCancel }));

    expect(endShowMock).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

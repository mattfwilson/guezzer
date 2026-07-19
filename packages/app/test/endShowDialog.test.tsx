import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * EndShowDialog wiring (D-04, T-04-18, SAFE-01, SAFE-03).
 *
 * The confirm gate is a focused unit test: the dialog must finalize ONLY on an
 * explicit confirm. The Phase-12 hardening adds two invariants:
 *  - SAFE-01: `endShow` must RESOLVE before `exportBackup` reads the snapshot, so
 *    a restored backup never resurrects an "active" show (call-order assertion).
 *  - SAFE-03: the "Backup saved" toast fires only AFTER a real `{ ok: true }`
 *    export — never on failure, and never as static markup while the dialog is
 *    open (the confirmation is an app-level toast, not dialog content).
 *
 * Pitfall 4 (12-RESEARCH): `exportBackup` is mocked so the real `snapshot()` read
 * never runs — an unmocked snapshot would throw into exportBackup's never-throw
 * catch and mask the ordering under test.
 */

/** Shared invocation log proving finalize-before-snapshot ordering (SAFE-01). */
const calls: string[] = [];

const endShowMock = vi.fn(async (..._args: unknown[]) => {
  // Resolve on a microtask (mirrors db.endShow's post-commit resolution), then
  // record — so the log proves endShow SETTLED before exportBackup is invoked.
  await Promise.resolve();
  calls.push("endShow");
});

let exportResult: { ok: boolean } = { ok: true };
const exportBackupMock = vi.fn(async () => {
  calls.push("exportBackup");
  return exportResult;
});

const showBackupToastMock = vi.fn();

vi.mock("../src/db/db.ts", () => ({
  endShow: (...args: unknown[]) => endShowMock(...args),
}));

vi.mock("../src/settings/exportDownload.ts", () => ({
  exportBackup: () => exportBackupMock(),
}));

vi.mock("../src/components/BackupToast.tsx", () => ({
  showBackupToast: () => showBackupToastMock(),
  BackupToast: () => null,
}));

const { EndShowDialog } = await import("../src/show/EndShowDialog.tsx");
const { config } = await import("../src/config.ts");
const copy = config.copy.show;
const settingsCopy = config.copy.settings;

describe("EndShowDialog finalize confirm (D-04)", () => {
  beforeEach(() => {
    exportResult = { ok: true };
    calls.length = 0;
  });

  afterEach(() => {
    cleanup();
    endShowMock.mockClear();
    exportBackupMock.mockClear();
    showBackupToastMock.mockClear();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <EndShowDialog open={false} sessionId="s1" onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("finalizes only on an explicit confirm — calls endShow(sessionId)", async () => {
    const onClose = vi.fn();
    render(<EndShowDialog open sessionId="s1" onClose={onClose} />);

    // The heading + destructive confirm are present; nothing finalized yet.
    expect(screen.getByText(copy.endHeading)).toBeTruthy();
    expect(endShowMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: copy.endConfirm }));

    expect(endShowMock).toHaveBeenCalledWith("s1");
    // handleConfirm is async now — onClose fires after `await endShow`.
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("does NOT finalize on cancel (Keep tracking)", () => {
    const onClose = vi.fn();
    render(<EndShowDialog open sessionId="s1" onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: copy.endCancel }));

    expect(endShowMock).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  // A11Y-01 (D-01): migrated onto the shared <Sheet modal>, so Escape dismisses
  // via the LIFO dialogStack — and dismissing must NOT finalize the show.
  it("dismisses on Escape without finalizing (A11Y-01)", () => {
    const onClose = vi.fn();
    render(<EndShowDialog open sessionId="s1" onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
    expect(endShowMock).not.toHaveBeenCalled();
  });

  // SAFE-01 (D-04): the snapshot must never capture an active show — endShow must
  // RESOLVE before exportBackup is invoked.
  it("finalizes the show BEFORE reading the backup snapshot (SAFE-01)", async () => {
    render(<EndShowDialog open sessionId="s1" onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: copy.endConfirm }));

    await waitFor(() => expect(exportBackupMock).toHaveBeenCalled());
    expect(calls).toEqual(["endShow", "exportBackup"]);
  });

  // SAFE-03 (D-05): the "Backup saved" toast fires exactly once on a real success.
  it("shows the backup toast once after a successful export (SAFE-03)", async () => {
    exportResult = { ok: true };
    render(<EndShowDialog open sessionId="s1" onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: copy.endConfirm }));

    await waitFor(() => expect(showBackupToastMock).toHaveBeenCalledTimes(1));
  });

  // SAFE-03 (D-05): a failed backup must NOT lie — no success toast.
  it("shows NO toast when the export fails (SAFE-03)", async () => {
    exportResult = { ok: false };
    render(<EndShowDialog open sessionId="s1" onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: copy.endConfirm }));

    await waitFor(() => expect(exportBackupMock).toHaveBeenCalled());
    // Flush any trailing microtasks so a stray toast call would have landed.
    await Promise.resolve();
    expect(showBackupToastMock).not.toHaveBeenCalled();
  });

  // SAFE-03 (D-05): no static "Backup saved" confirmation renders while the
  // dialog is open — the signal is a post-success toast, not premature markup.
  it("does NOT render a static 'Backup saved' confirmation while open (SAFE-03)", () => {
    render(<EndShowDialog open sessionId="s1" onClose={vi.fn()} />);

    expect(
      screen.queryByText(settingsCopy.endShowBackupConfirmation),
    ).toBeNull();
  });
});

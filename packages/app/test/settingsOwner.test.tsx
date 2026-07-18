import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "../src/config.ts";
import { db, getMeta, setMeta } from "../src/db/db.ts";
import { SettingsView } from "../src/settings/SettingsView.tsx";

// Drive the D-17 import fork deterministically: the file picker fires immediately
// with a stub file and the classifier returns an UNOWNED envelope, so the
// "Whose dex is this?" <Sheet> prompt opens without a real native picker.
const { pickAndImportMock, unownedEnvelope } = vi.hoisted(() => ({
  pickAndImportMock: vi.fn(),
  unownedEnvelope: {
    schemaVersion: 2,
    exportedAt: "2026-07-14T00:00:00.000Z",
    owner: null,
    meta: [],
    attendedShows: [],
    archiveShows: [],
    trackedShows: [],
    trackedEntries: [],
  },
}));

vi.mock("../src/settings/importPicker.ts", () => ({
  openBackupFilePicker: (onFile: (file: File) => void) =>
    onFile(new File(["{}"], "backup.json", { type: "application/json" })),
  classifyImport: () => ({ kind: "unowned", envelope: unownedEnvelope }),
  pickAndImport: (...args: unknown[]) => pickAndImportMock(...args),
}));

// CompareView (opened by the name-submit path) bundle-imports the archive/album
// artifacts — stub tiny schemaVersion-1 fixtures so it renders.
vi.mock("@archive", () => ({
  default: {
    schemaVersion: 1,
    latestShowDate: "2019-01-01",
    songs: { "101": "Rattlesnake" },
    shows: [
      {
        id: 8001,
        date: "2019-01-01",
        venue: "V1",
        city: "C1",
        state: null,
        country: "US",
        sets: [{ n: "1", songs: [101] }],
      },
    ],
  },
}));
vi.mock("@dexAlbums", () => ({
  default: { schemaVersion: 1, albums: [], buckets: { covers: [], miscellaneous: [] } },
}));

/**
 * Owner-identity Settings field (D-17, plan 06-07). The field persists the meta
 * `ownerName` row (the export fork key consumed by 06-10) and enforces the
 * length clamp as a `maxLength` attribute mirroring the core schema. Runs under
 * jsdom + fake-indexeddb (test/setup.ts).
 */

async function wipeMeta(): Promise<void> {
  await db.meta.clear();
}

describe("SettingsView — owner identity field (D-17)", () => {
  beforeEach(wipeMeta);
  afterEach(async () => {
    cleanup();
    await wipeMeta();
  });

  it("writes the typed name to the meta ownerName row", async () => {
    render(<SettingsView />);

    const input = screen.getByLabelText(
      config.copy.settings.ownerNameHeading,
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Matt" } });

    await waitFor(async () => {
      expect(await getMeta<string>("ownerName")).toBe("Matt");
    });
  });

  it("reflects an existing meta ownerName as the field value", async () => {
    await setMeta("ownerName", "Existing");
    render(<SettingsView />);

    await waitFor(() => {
      const input = screen.getByLabelText(
        config.copy.settings.ownerNameHeading,
      ) as HTMLInputElement;
      expect(input.value).toBe("Existing");
    });
  });

  it("clamps input length via maxLength = OWNER_NAME_MAX_LENGTH", () => {
    render(<SettingsView />);

    const input = screen.getByLabelText(
      config.copy.settings.ownerNameHeading,
    ) as HTMLInputElement;
    expect(input.maxLength).toBe(config.dex.OWNER_NAME_MAX_LENGTH);
  });

  it("trims whitespace before persisting", async () => {
    render(<SettingsView />);

    const input = screen.getByLabelText(config.copy.settings.ownerNameHeading);
    fireEvent.change(input, { target: { value: "  Matt  " } });

    await waitFor(async () => {
      expect(await getMeta<string>("ownerName")).toBe("Matt");
    });
  });
});

/**
 * "Whose dex is this?" prompt — migrated onto the shared <Sheet modal> with
 * initialFocusRef (A11Y-01, plan 08-03). Escape dismisses it, the text field is
 * focused on open, its maxLength clamp is preserved, and both resolution paths
 * ("It's mine — merge it" restore + name-submit → read-only compare) still work.
 */
describe("SettingsView — 'Whose dex is this?' prompt (A11Y-01, 08-03)", () => {
  const compareCopy = config.copy.compare;

  async function clearTables(): Promise<void> {
    await db.meta.clear();
    await db.attendedShows.clear();
    await db.archiveShows.clear();
    await db.trackedShows.clear();
    await db.trackedEntries.clear();
  }

  beforeEach(async () => {
    pickAndImportMock.mockReset();
    pickAndImportMock.mockResolvedValue({
      ok: true,
      added: { shows: 2, songs: 5 },
    });
    await clearTables();
  });
  afterEach(async () => {
    cleanup();
    await clearTables();
  });

  /** Click Import → the mocked picker + classifier open the unowned prompt. */
  async function openPrompt(): Promise<HTMLInputElement> {
    render(<SettingsView />);
    fireEvent.click(screen.getByText(config.copy.settings.importCta));
    return (await screen.findByPlaceholderText(
      compareCopy.namePromptPlaceholder,
    )) as HTMLInputElement;
  }

  it("focuses the text field on open (initialFocusRef) and preserves maxLength", async () => {
    const input = await openPrompt();

    expect(input.id).toBe("whose-dex");
    expect(input.maxLength).toBe(config.dex.OWNER_NAME_MAX_LENGTH);
    await waitFor(() => expect(document.activeElement).toBe(input));
  });

  it("Escape dismisses the prompt", async () => {
    await openPrompt();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText(compareCopy.namePromptPlaceholder),
      ).toBeNull(),
    );
  });

  it("'It's mine — merge it' routes to the restore/merge path", async () => {
    await openPrompt();

    fireEvent.click(screen.getByText(compareCopy.namePromptMine));

    expect(pickAndImportMock).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(
        screen.getByText(config.copy.settings.importSuccessHeading),
      ).toBeTruthy(),
    );
  });

  it("name-submit opens the read-only compare view with the typed name", async () => {
    const input = await openPrompt();

    fireEvent.change(input, { target: { value: "Alice" } });
    fireEvent.click(screen.getByText(compareCopy.namePromptConfirm));

    // Routed to CompareView (zero DB writes) — the persistent banner names Alice.
    await waitFor(() =>
      expect(screen.getByText(compareCopy.banner("Alice"))).toBeTruthy(),
    );
    expect(pickAndImportMock).not.toHaveBeenCalled();
  });
});

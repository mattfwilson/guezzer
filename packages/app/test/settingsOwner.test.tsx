import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { config } from "../src/config.ts";
import { db, getMeta, setMeta } from "../src/db/db.ts";
import { SettingsView } from "../src/settings/SettingsView.tsx";

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

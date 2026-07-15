import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  InstallBanner,
  INSTALL_BANNER_SEEN_VERSION,
} from "../src/components/InstallBanner.tsx";
import { config } from "../src/config.ts";
import { db, getMeta, setMeta } from "../src/db/db.ts";

/**
 * InstallBanner once-per-version gate (D-22, supersedes the Phase-3 D-05
 * session-only dismissal). The banner is gated on a persisted `meta` flag keyed
 * on the build stamp (`__APP_VERSION__+__GIT_SHA__`): show once per never-seen
 * stamp (writing the flag), suppress on the same stamp, re-show on a changed
 * stamp. Uses fake-indexeddb meta + stubbed build globals (version.test.tsx
 * idiom).
 */
const buildStamp = "1.0.0+a1b2c3d";
const headline = config.copy.installBanner.headline;

/** jsdom has no matchMedia — stub not-standalone so the banner can render. */
function stubMatchMedia(): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe("InstallBanner once-per-version gate (D-22)", () => {
  beforeEach(async () => {
    await db.meta.clear();
    stubMatchMedia();
    vi.stubGlobal("__APP_VERSION__", "1.0.0");
    vi.stubGlobal("__GIT_SHA__", "a1b2c3d");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows once on a never-seen stamp and persists the flag", async () => {
    render(<InstallBanner />);

    const region = await screen.findByRole("region", { name: headline });
    expect(region).toBeInTheDocument();

    await waitFor(async () => {
      expect(await getMeta<string>(INSTALL_BANNER_SEEN_VERSION)).toBe(
        buildStamp,
      );
    });
  });

  it("stays hidden when the current stamp is already recorded", async () => {
    await setMeta(INSTALL_BANNER_SEEN_VERSION, buildStamp);

    render(<InstallBanner />);

    await waitFor(async () => {
      expect(await getMeta<string>(INSTALL_BANNER_SEEN_VERSION)).toBe(
        buildStamp,
      );
    });
    expect(screen.queryByRole("region", { name: headline })).toBeNull();
  });

  it("re-shows once when the recorded stamp is from an older build", async () => {
    await setMeta(INSTALL_BANNER_SEEN_VERSION, "0.0.0+oldsha0");

    render(<InstallBanner />);

    const region = await screen.findByRole("region", { name: headline });
    expect(region).toBeInTheDocument();

    // The gate rewrites the flag to the current stamp so it won't re-show again.
    await waitFor(async () => {
      expect(await getMeta<string>(INSTALL_BANNER_SEEN_VERSION)).toBe(
        buildStamp,
      );
    });
  });
});

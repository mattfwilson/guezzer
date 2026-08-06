import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppMenu } from "../src/components/AppMenu.tsx";
import { config } from "../src/config.ts";
import { __resetInstallStoreForTests } from "../src/pwa/install/installStore.ts";
import {
  __resetInstallSectionFocusForTests,
  requestInstallSectionFocus,
} from "../src/settings/installSectionFocus.ts";
import { SettingsView } from "../src/settings/SettingsView.tsx";

/**
 * NAV-05 / D-32 / D-34 / D-35 — the relocated add-to-home-screen path.
 *
 * These are POSITIVE rendered-DOM assertions, deliberately: 22-VALIDATION.md
 * §"Carried Limitation from Phase 21" names the Settings install section as one
 * of three surfaces where a structural/source-grep guard would have passed
 * against a surface that renders nothing. Every case below mounts the real
 * component tree and queries the real DOM.
 *
 * The install-store platform reads are frozen at module load (D-36), so
 * `vi.stubGlobal("matchMedia", …)` cannot move `isIos` / `isInstalled` here —
 * `__resetInstallStoreForTests({ … })` is the only way into those branches.
 */

// SettingsView statically imports CompareView, which bundle-imports the
// archive/album artifacts (settingsOwner.test.tsx idiom). Tiny fixtures keep
// the module graph resolvable; nothing here opens the compare fork.
vi.mock("@archive", () => ({
  default: {
    schemaVersion: 1,
    latestShowDate: "2019-01-01",
    songs: { "101": "Rattlesnake" },
    shows: [],
  },
}));
vi.mock("@dexAlbums", () => ({
  default: {
    schemaVersion: 1,
    albums: [],
    buckets: { covers: [], miscellaneous: [] },
  },
}));

// SettingsView reads persistStatus/ownerName through useLiveQuery; stub to
// `undefined` so these DOM assertions never wait on async Dexie settling
// (sheet.a11y.test.tsx idiom). Nothing under test has a data dependency.
vi.mock("dexie-react-hooks", () => ({ useLiveQuery: () => undefined }));

/**
 * A synthetic `beforeinstallprompt` — the real event is Chromium-only and not
 * constructible in jsdom (installStore.test.tsx idiom). Dispatching it BEFORE
 * `render()` is deliberate: it is exactly the late-mount case the module-level
 * store (plan 22-03) exists to make work.
 */
function dispatchBeforeInstallPrompt(): void {
  const event = new Event("beforeinstallprompt");
  Object.assign(event, {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
  });
  window.dispatchEvent(event);
}

/** How many of the three mutually-exclusive platform bodies are rendered. */
function renderedBranches(): string[] {
  const present: string[] = [];
  if (
    screen.queryByRole("button", { name: config.copy.install.androidCta }) !=
    null
  ) {
    present.push("android");
  }
  if (document.querySelector("#install ol") != null) present.push("ios");
  if (screen.queryByText(config.copy.install.unavailable) != null) {
    present.push("unavailable");
  }
  return present;
}

describe("relocated install affordance (NAV-05)", () => {
  beforeEach(() => {
    // Deterministic starting route for the navigation assertion.
    location.hash = "#/show";
    // VersionStamp (rendered inside AppMenu) reads build-time define constants.
    vi.stubGlobal("__APP_VERSION__", "1.0.0");
    vi.stubGlobal("__GIT_SHA__", "a1b2c3d");
    vi.stubGlobal("__BUILD_DATE__", "2026-08-06");
  });

  afterEach(() => {
    cleanup();
    __resetInstallStoreForTests();
    __resetInstallSectionFocusForTests();
    vi.unstubAllGlobals();
  });

  it("is the LAST section on Settings, below the rotation reset (D-32)", () => {
    const { container } = render(<SettingsView />);

    const column = container.firstElementChild;
    expect(column).not.toBeNull();

    const children = Array.from(column!.children);
    const last = children[children.length - 1];
    expect(last.id).toBe("install");

    const heading = screen.getByRole("heading", {
      name: config.copy.install.sectionHeading,
    });
    expect(last.contains(heading)).toBe(true);

    // Explicit document-order check against the section it must follow, so a
    // future reordering of the column cannot quietly move it up the page.
    const rotationHeading = screen.getByRole("heading", {
      name: config.copy.settings.rotationResetHeading,
    });
    expect(
      rotationHeading.compareDocumentPosition(heading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("hides the section AND the menu row together, through one gate (D-34)", () => {
    // Both halves asserted in one body on purpose: a one-sided regression (the
    // row still offered while the section it links to is gone, or vice versa)
    // is the exact failure two separate tests would let through.
    __resetInstallStoreForTests({ isInstalled: true });
    const installed = render(<SettingsView />);
    render(<AppMenu open onClose={() => {}} />);

    expect(installed.container.querySelector("#install")).toBeNull();
    expect(
      screen.queryByRole("button", { name: config.copy.install.menuRow }),
    ).toBeNull();

    cleanup();

    __resetInstallStoreForTests({ isInstalled: false });
    const notInstalled = render(<SettingsView />);
    render(<AppMenu open onClose={() => {}} />);

    expect(notInstalled.container.querySelector("#install")).not.toBeNull();
    expect(
      screen.getByRole("button", { name: config.copy.install.menuRow }),
    ).toBeInTheDocument();
  });

  it("the menu row is neutral and NAVIGATES rather than installing (D-34)", () => {
    const onClose = vi.fn();
    render(<AppMenu open onClose={onClose} />);

    const row = screen.getByRole("button", {
      name: config.copy.install.menuRow,
    });
    expect(row.className).toContain("border border-hairline");
    expect(row.className).not.toContain("bg-accent");

    fireEvent.click(row);

    // T-22-16: the hash is still a bare allow-listed route — no fragment, no
    // parsed target. The section is reached through the in-app counter store.
    expect(location.hash).toBe("#/settings");
    expect(onClose).toHaveBeenCalled();
  });

  it("renders exactly one of the three platform bodies — iOS", () => {
    __resetInstallStoreForTests({ isIos: true });
    render(<SettingsView />);

    expect(renderedBranches()).toEqual(["ios"]);
    expect(document.querySelectorAll("#install ol li")).toHaveLength(
      config.copy.iosInstall.steps.length,
    );
  });

  it("renders exactly one of the three platform bodies — Android", () => {
    // Fires BEFORE render: the singleton store is what makes a late-mounted
    // consumer still see the one-shot event (NAV-06).
    dispatchBeforeInstallPrompt();
    render(<SettingsView />);

    expect(renderedBranches()).toEqual(["android"]);
  });

  it("renders exactly one of the three platform bodies — neither", () => {
    render(<SettingsView />);

    expect(renderedBranches()).toEqual(["unavailable"]);
  });

  it("the deep link moves focus, and re-fires when already on #/settings (Pitfall 10)", () => {
    render(<SettingsView />);

    const heading = screen.getByRole("heading", {
      name: config.copy.install.sectionHeading,
    });
    expect(heading).toHaveAttribute("tabindex", "-1");

    act(() => {
      requestInstallSectionFocus();
    });
    expect(document.activeElement).toBe(heading);

    // Blur, then request AGAIN without any route change or remount. A one-shot
    // consumable boolean plus a mount-time effect would do nothing here — which
    // is precisely the bug a user already sitting on #/settings would hit.
    (document.activeElement as HTMLElement).blur();
    expect(document.activeElement).not.toBe(heading);

    act(() => {
      requestInstallSectionFocus();
    });
    expect(document.activeElement).toBe(heading);

    // NOTE: this file deliberately does NOT stub Element.prototype.scrollIntoView.
    // jsdom has none, so if these cases stop passing, the product code's optional
    // call (`scrollIntoView?.(`) has regressed into a hard call — do not "fix"
    // the failure by adding a shim here.
  });

  it("the iOS branch contributes no second heading inside #install (D-32)", () => {
    __resetInstallStoreForTests({ isIos: true });
    const { container } = render(<SettingsView />);

    const section = container.querySelector("#install");
    expect(section).not.toBeNull();
    expect(section!.querySelectorAll("h2")).toHaveLength(1);
  });
});

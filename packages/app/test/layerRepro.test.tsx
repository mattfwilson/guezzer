import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { isLayerReproEnabled } from "../src/dev/layerRepro.tsx";
import { isLayoutProbeEnabled, LayoutProbe, readSafeAreaInsets } from "../src/dev/LayoutProbe.tsx";

/**
 * Phase 21 — the two dev harnesses (`?layerRepro=1`, D-29/FOUND-03 and
 * `?layoutProbe=1`, D-14/FOUND-01) must be INERT-UNLESS-EXPLICIT: a normal load
 * renders nothing new and shipped behavior is byte-identical. Both gates use
 * exact-value equality against the literal `"1"` (never truthiness, never a
 * regex over `location.search`), so `?layerRepro=true` must NOT enable one —
 * that is the T-21-01 mitigation and this file is what locks it.
 *
 * It also locks the probe's never-throw contract: under jsdom `env()` never
 * resolves and the app tree is absent, so every reading must degrade to `0` or
 * `n/a` rather than crashing the harness on a device mid-diagnosis.
 */

const ORIGINAL_URL = "/";

// Vitest runs without `globals: true`, so RTL's auto-cleanup never registers —
// unmount explicitly or a second render finds duplicate readout lines
// (archiveBrowser.test.tsx:77 precedent).
afterEach(() => {
  cleanup();
  history.replaceState(null, "", ORIGINAL_URL);
});

describe("isLayerReproEnabled", () => {
  it("is false on a normal load (no query string)", () => {
    history.replaceState(null, "", "/");
    expect(isLayerReproEnabled()).toBe(false);
  });

  it("is false for ?layerRepro=0", () => {
    history.replaceState(null, "", "/?layerRepro=0");
    expect(isLayerReproEnabled()).toBe(false);
  });

  it("is false for ?layerRepro=true (exact-value equality, not truthiness)", () => {
    history.replaceState(null, "", "/?layerRepro=true");
    expect(isLayerReproEnabled()).toBe(false);
  });

  it("is false for a bare ?layerRepro with no value", () => {
    history.replaceState(null, "", "/?layerRepro");
    expect(isLayerReproEnabled()).toBe(false);
  });

  it("is true only for the explicit ?layerRepro=1", () => {
    history.replaceState(null, "", "/?layerRepro=1");
    expect(isLayerReproEnabled()).toBe(true);
  });

  it("is true when ?layerRepro=1 travels alongside other params", () => {
    history.replaceState(null, "", "/?mockLatest=1&layerRepro=1");
    expect(isLayerReproEnabled()).toBe(true);
  });
});

describe("isLayoutProbeEnabled", () => {
  it("is false on a normal load (no query string)", () => {
    history.replaceState(null, "", "/");
    expect(isLayoutProbeEnabled()).toBe(false);
  });

  it("is false for ?layoutProbe=0", () => {
    history.replaceState(null, "", "/?layoutProbe=0");
    expect(isLayoutProbeEnabled()).toBe(false);
  });

  it("is false for ?layoutProbe=true (exact-value equality, not truthiness)", () => {
    history.replaceState(null, "", "/?layoutProbe=true");
    expect(isLayoutProbeEnabled()).toBe(false);
  });

  it("is false for a bare ?layoutProbe with no value", () => {
    history.replaceState(null, "", "/?layoutProbe");
    expect(isLayoutProbeEnabled()).toBe(false);
  });

  it("is true only for the explicit ?layoutProbe=1", () => {
    history.replaceState(null, "", "/?layoutProbe=1");
    expect(isLayoutProbeEnabled()).toBe(true);
  });

  it("does not cross-enable the other flag", () => {
    history.replaceState(null, "", "/?layoutProbe=1");
    expect(isLayerReproEnabled()).toBe(false);
    history.replaceState(null, "", "/?layerRepro=1");
    expect(isLayoutProbeEnabled()).toBe(false);
  });
});

describe("readSafeAreaInsets", () => {
  it("returns four finite numbers and never throws (all 0 under jsdom)", () => {
    const insets = readSafeAreaInsets();
    expect(Object.keys(insets).sort()).toEqual(["bottom", "left", "right", "top"]);
    for (const value of Object.values(insets)) {
      expect(typeof value).toBe("number");
      expect(Number.isFinite(value)).toBe(true);
    }
    // jsdom does not resolve `env()`, so the honest answer there is zero —
    // which is also exactly what a desktop Safari TAB reports (the reason
    // FOUND-01 is invisible outside an installed instance).
    expect(insets).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it("leaves no probe element behind in the document", () => {
    const before = document.body.childElementCount;
    readSafeAreaInsets();
    expect(document.body.childElementCount).toBe(before);
  });
});

describe("LayoutProbe", () => {
  it("renders without throwing when <main>, <nav> and #root are all absent", () => {
    expect(() => render(<LayoutProbe />)).not.toThrow();
    expect(screen.getByText(/layoutProbe/)).toBeInTheDocument();
  });

  it("shows n/a for the measurements whose elements are missing", () => {
    render(<LayoutProbe />);
    // No app tree in this bare jsdom document → every element-derived reading
    // degrades to `n/a` instead of crashing or printing NaN.
    expect(screen.getByText("rootH: n/a")).toBeInTheDocument();
    expect(screen.getByText("mainH: n/a")).toBeInTheDocument();
    expect(screen.getByText("mainBottom: n/a")).toBeInTheDocument();
    expect(screen.getByText("tabTop: n/a")).toBeInTheDocument();
    expect(screen.getByText("bodyH-rootH: n/a")).toBeInTheDocument();
    expect(screen.getByText(">>> GAP: n/a")).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).toBeNull();
  });

  it("renders the load-bearing FOUND-01 fields (sab, bodyH-rootH, GAP)", () => {
    render(<LayoutProbe />);
    expect(screen.getByText("sab: 0")).toBeInTheDocument();
    expect(screen.getByText(/^bodyH-rootH:/)).toBeInTheDocument();
    expect(screen.getByText(/^>>> GAP:/)).toBeInTheDocument();
  });

  it("computes bodyH-rootH and GAP when the app tree is present", () => {
    const root = document.createElement("div");
    root.id = "root";
    const main = document.createElement("main");
    const nav = document.createElement("nav");
    nav.appendChild(document.createElement("button"));
    root.append(main, nav);
    document.body.appendChild(root);

    try {
      render(<LayoutProbe />);
      // jsdom reports 0 for every layout box, so the arithmetic resolves to a
      // real number (0), NOT `n/a` — the elements were found and measured.
      expect(screen.getByText("bodyH-rootH: 0")).toBeInTheDocument();
      expect(screen.getByText(">>> GAP: 0")).toBeInTheDocument();
    } finally {
      root.remove();
    }
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { isLayerReproEnabled } from "../src/dev/layerRepro.tsx";

/**
 * Phase 21 (D-29 / FOUND-03) — the `?layerRepro=1` dev harness must be
 * INERT-UNLESS-EXPLICIT: a normal load renders nothing new and shipped
 * behavior is byte-identical. The gate uses exact-value equality against the
 * literal `"1"` (never truthiness, never a regex over `location.search`), so
 * `?layerRepro=true` must NOT enable it — that is the T-21-01 mitigation and
 * this test is what locks it.
 *
 * (Plan 21-01 Task 2 extends this file with the `?layoutProbe=1` half.)
 */

const ORIGINAL_URL = "/";

describe("isLayerReproEnabled", () => {
  afterEach(() => {
    history.replaceState(null, "", ORIGINAL_URL);
  });

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

/**
 * SAFE-02 / D-06 contract: the anchor-download helper must defer the
 * object-URL revoke via setTimeout(..., OBJECT_URL_REVOKE_DELAY_MS) and NEVER
 * revoke on the click tick — a same-tick free silently aborts the download on
 * iOS Safari. Fake timers prove the revoke fires only after the configured
 * delay, exactly once, with the URL that was created.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "../src/config.ts";
import { triggerDownload } from "../src/settings/triggerDownload.ts";

describe("triggerDownload — deferred object-URL revoke (SAFE-02, D-06)", () => {
  const MOCK_URL = "blob:mock-url";
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    createObjectURL = vi.fn(() => MOCK_URL);
    revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does NOT revoke on the click tick, then revokes exactly once after the delay", () => {
    triggerDownload(new Blob(["x"]), "f.json");

    // Object URL was created and handed to an anchor click...
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    // ...but the revoke MUST NOT fire synchronously (the iOS-abort bug).
    expect(revokeObjectURL).not.toHaveBeenCalled();

    // Advancing just under the delay still must not revoke.
    vi.advanceTimersByTime(config.dataSafety.OBJECT_URL_REVOKE_DELAY_MS - 1);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    // Crossing the delay boundary revokes exactly once, with the created URL.
    vi.advanceTimersByTime(1);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith(MOCK_URL);
  });

  it("appends a rel=noopener anchor with the given filename and clicks it", () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    triggerDownload(new Blob(["x"]), "guezzer-backup-2026-07-19.json");

    expect(clickSpy).toHaveBeenCalledTimes(1);
    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe("guezzer-backup-2026-07-19.json");
    expect(anchor.rel).toBe("noopener");
    // Anchor is removed from the DOM after the click (no leak).
    expect(document.querySelector("a[download]")).toBeNull();
  });
});

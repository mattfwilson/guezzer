import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * wakeLock helper (SHOW-12). Focused unit test of the acquire contract: it must
 * feature-detect, VERIFY the sentinel actually held (Pitfall 1 false-positive on
 * installed iOS PWAs < 18.4), never throw, and reacquire on visibilitychange
 * while a show is active. `navigator.wakeLock` is stubbed since jsdom has none.
 *
 * The module holds process-level singleton state, so each test reimports a fresh
 * copy via `vi.resetModules()` for isolation.
 */
async function freshModule() {
  vi.resetModules();
  return import("../src/wakeLock.ts");
}

function setWakeLock(request: unknown): void {
  Object.defineProperty(navigator, "wakeLock", {
    value: { request },
    configurable: true,
  });
}

function liveSentinel(onRelease?: (cb: () => void) => void) {
  return {
    released: false,
    addEventListener: (event: string, cb: () => void) => {
      if (event === "release") onRelease?.(cb);
    },
    release: vi.fn().mockResolvedValue(undefined),
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("wakeLock: acquireWakeLock (SHOW-12, Pitfall 1)", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "wakeLock");
    vi.restoreAllMocks();
  });

  it("calls onUnsupported when the Wake Lock API is absent (feature-detect)", async () => {
    Reflect.deleteProperty(navigator, "wakeLock");
    const { acquireWakeLock } = await freshModule();
    const onUnsupported = vi.fn();

    await expect(acquireWakeLock(onUnsupported)).resolves.toBeUndefined();
    expect(onUnsupported).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onUnsupported when a live sentinel is returned", async () => {
    const request = vi.fn().mockResolvedValue(liveSentinel());
    setWakeLock(request);
    const { acquireWakeLock } = await freshModule();
    const onUnsupported = vi.fn();

    await acquireWakeLock(onUnsupported);

    expect(request).toHaveBeenCalledWith("screen");
    expect(onUnsupported).not.toHaveBeenCalled();
  });

  it("treats an already-released sentinel as unsupported (installed-PWA false-positive)", async () => {
    // Pitfall 1: request() resolves but the lock never held (released === true).
    const dead = { ...liveSentinel(), released: true };
    setWakeLock(vi.fn().mockResolvedValue(dead));
    const { acquireWakeLock } = await freshModule();
    const onUnsupported = vi.fn();

    await acquireWakeLock(onUnsupported);

    expect(onUnsupported).toHaveBeenCalledTimes(1);
  });

  it("never throws and calls onUnsupported when request() rejects", async () => {
    setWakeLock(vi.fn().mockRejectedValue(new Error("NotAllowedError")));
    const { acquireWakeLock } = await freshModule();
    const onUnsupported = vi.fn();

    await expect(acquireWakeLock(onUnsupported)).resolves.toBeUndefined();
    expect(onUnsupported).toHaveBeenCalledTimes(1);
  });

  it("releases a late-resolving sentinel when release races an in-flight acquire (UX-02, D-02)", async () => {
    // The race: acquireWakeLock's request("screen") is still in flight when End
    // Show calls releaseWakeLock() (showActive → false). When the request finally
    // resolves with a live sentinel, the post-await re-check must release it and
    // store NOTHING — otherwise the lock leaks (nothing else can release it).
    let resolveRequest: (sentinel: unknown) => void = () => {};
    const deferred = new Promise((resolve) => {
      resolveRequest = resolve;
    });
    setWakeLock(vi.fn().mockReturnValue(deferred));
    const { acquireWakeLock, releaseWakeLock } = await freshModule();
    const onUnsupported = vi.fn();

    // Start the acquire; the request promise does NOT resolve yet.
    const acquiring = acquireWakeLock(onUnsupported);
    await flush();

    // End Show fires while the request is still in flight → showActive = false.
    await releaseWakeLock();

    // Now the deferred request resolves with a live sentinel.
    const late = liveSentinel();
    resolveRequest(late);
    await acquiring;
    await flush();

    // The re-check released the late sentinel exactly once...
    expect(late.release).toHaveBeenCalledTimes(1);
    // ...and stored nothing: a subsequent release is a no-op (no second release).
    await releaseWakeLock();
    expect(late.release).toHaveBeenCalledTimes(1);
    // ...and never surfaced the fallback notice (End Show is normal teardown).
    expect(onUnsupported).not.toHaveBeenCalled();
  });

  it("reacquires on visibilitychange when a show is active and the lock was dropped", async () => {
    let releaseCb: () => void = () => {};
    const request = vi
      .fn()
      .mockResolvedValue(liveSentinel((cb) => (releaseCb = cb)));
    setWakeLock(request);
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    const { acquireWakeLock } = await freshModule();

    await acquireWakeLock(vi.fn());
    expect(request).toHaveBeenCalledTimes(1);

    // OS backgrounds the app → the lock releases; the sentinel goes null.
    releaseCb();
    // Returning to visible reacquires silently. (jsdom shares one document
    // across the resetModules reimports, so listeners accumulate — assert the
    // reacquire fired at least once more, not an exact count.)
    document.dispatchEvent(new Event("visibilitychange"));
    await flush();

    expect(request.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

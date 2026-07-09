import { afterEach, describe, expect, it, vi } from "vitest";
import { isIosSafari, isStandalone } from "../src/pwa/install/platform.ts";

const IPHONE_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";

const ANDROID_CHROME_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

const IOS_CHROME_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1";

/** jsdom does not implement `window.matchMedia` — stub a not-standalone media query. */
function stubMatchMedia(matches = false): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
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

function stubNavigator(
  userAgent: string,
  maxTouchPoints = 0,
  standalone: boolean | undefined = undefined,
): void {
  vi.stubGlobal("navigator", {
    ...navigator,
    userAgent,
    maxTouchPoints,
    standalone,
  });
}

describe("platform detection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("isIosSafari() is true for an iPhone Safari UA", () => {
    stubMatchMedia(false);
    stubNavigator(IPHONE_SAFARI_UA, 5);
    expect(isIosSafari()).toBe(true);
  });

  it("isIosSafari() is false for an Android Chrome UA", () => {
    stubMatchMedia(false);
    stubNavigator(ANDROID_CHROME_UA, 5);
    expect(isIosSafari()).toBe(false);
  });

  it("isIosSafari() is false for an iOS Chrome (CriOS) UA", () => {
    stubMatchMedia(false);
    stubNavigator(IOS_CHROME_UA, 5);
    expect(isIosSafari()).toBe(false);
  });

  it("isIosSafari() is false when already standalone (navigator.standalone)", () => {
    stubMatchMedia(false);
    stubNavigator(IPHONE_SAFARI_UA, 5, true);
    expect(isIosSafari()).toBe(false);
  });

  it("isStandalone() is true when display-mode: standalone matches", () => {
    stubMatchMedia(true);
    stubNavigator(ANDROID_CHROME_UA, 0);
    expect(isStandalone()).toBe(true);
  });

  it("isStandalone() is false for a normal browser-tab visit", () => {
    stubMatchMedia(false);
    stubNavigator(ANDROID_CHROME_UA, 0);
    expect(isStandalone()).toBe(false);
  });
});

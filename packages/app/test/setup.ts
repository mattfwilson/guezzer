// Vitest-specific entry: extends Vitest's own `expect` rather than relying on
// a Jest global (plain "@testing-library/jest-dom" throws "expect is not
// defined" under Vitest 4 — Rule 1 auto-fix).
import "@testing-library/jest-dom/vitest";
// jsdom has no native IndexedDB; authored upfront so Plan 04's Dexie
// round-trip test has IndexedDB under jsdom without re-touching this file.
import "fake-indexeddb/auto";

// jsdom ships NO `window.matchMedia` (Phase-8 RESEARCH §Wave 0 Gaps). The
// reduced-motion reads in NodeSheet / ExploreFilterFab and the focus-camera
// effect (ConstellationCanvas — `matchMedia("(prefers-reduced-motion:
// reduce)").matches`) throw "matchMedia is not a function" without a stub, and
// several test files were hand-shimming it per-file. Centralize ONE stub here so
// every downstream reduced-motion / camera test runs. `matches: false` means the
// default test environment reports NO reduced-motion preference (motion allowed).
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList,
});

// Vitest-specific entry: extends Vitest's own `expect` rather than relying on
// a Jest global (plain "@testing-library/jest-dom" throws "expect is not
// defined" under Vitest 4 — Rule 1 auto-fix).
import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// db/supabase.ts fails fast (WR-04) at IMPORT time if the public VITE_ vars are
// missing — which they are under vitest (no .env.local). Any test that renders a
// component transitively importing that singleton (AppShell → IdentityAvatar from
// Plan 18-05, and the Plan 04 sign-in surface / Plan 06 boot gate) would crash on
// import. Provide harmless, syntactically-valid public values ONCE here so
// `createClient` constructs a client that performs NO network I/O at construction;
// tests that exercise auth flows still mock `supabase` per-file to assert calls.
vi.stubEnv("VITE_SUPABASE_URL", "http://localhost:54321");
vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
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

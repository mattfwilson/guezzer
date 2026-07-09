// Vitest-specific entry: extends Vitest's own `expect` rather than relying on
// a Jest global (plain "@testing-library/jest-dom" throws "expect is not
// defined" under Vitest 4 — Rule 1 auto-fix).
import "@testing-library/jest-dom/vitest";
// jsdom has no native IndexedDB; authored upfront so Plan 04's Dexie
// round-trip test has IndexedDB under jsdom without re-touching this file.
import "fake-indexeddb/auto";

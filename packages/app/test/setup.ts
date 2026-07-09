import "@testing-library/jest-dom";
// jsdom has no native IndexedDB; authored upfront so Plan 04's Dexie
// round-trip test has IndexedDB under jsdom without re-touching this file.
import "fake-indexeddb/auto";

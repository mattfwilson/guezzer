import { describe, expect, it } from "vitest";
import {
  exportEnvelope,
  type ExportEnvelope,
} from "../src/data-safety/export-schema.ts";
import {
  serializeExport,
  type ExportSnapshot,
} from "../src/data-safety/serialize.ts";

/** A minimal but fully-typed snapshot exercising every table. */
function sampleSnapshot(): ExportSnapshot {
  return {
    meta: [{ key: "wakeLockEnabled", value: true }],
    attendedShows: [{ show_id: 1782000000, showDate: "2026-07-13" }],
    trackedShows: [
      {
        sessionId: "sess-a",
        date: "2026-07-13",
        status: "finalized",
        currentSetNumber: "e",
        startedAt: 1_700_000_000_000,
        showId: 1782000000,
        venueId: 447,
        venueName: "Red Rocks Amphitheatre",
        city: "Morrison",
      },
    ],
    trackedEntries: [
      {
        id: 1,
        sessionId: "sess-a",
        position: 1,
        songId: 42,
        songName: "Rattlesnake",
        setNumber: "1",
        outcome: "hit",
        shownFanSongIds: [42, 7, 9],
        isPlaceholder: false,
        source: "manual",
        loggedAt: 1_700_000_000_001,
      },
    ],
  };
}

const D09_KEYS = [
  "attendedShows",
  "exportedAt",
  "meta",
  "schemaVersion",
  "trackedEntries",
  "trackedShows",
];

describe("serializeExport — D-09 envelope shape", () => {
  it("produces exactly the six D-09 top-level keys, no extras", () => {
    const out = serializeExport(sampleSnapshot(), 1);
    expect(Object.keys(out).sort()).toEqual(D09_KEYS);
  });

  it("carries schemaVersion through verbatim", () => {
    expect(serializeExport(sampleSnapshot(), 1).schemaVersion).toBe(1);
    expect(serializeExport(sampleSnapshot(), 7).schemaVersion).toBe(7);
  });

  it("stamps a valid ISO-8601 exportedAt", () => {
    const { exportedAt } = serializeExport(sampleSnapshot(), 1);
    expect(exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(Number.isNaN(Date.parse(exportedAt))).toBe(false);
  });

  it("carries the four data arrays through verbatim (identity, no mutation)", () => {
    const snap = sampleSnapshot();
    const out = serializeExport(snap, 1);
    expect(out.meta).toBe(snap.meta);
    expect(out.attendedShows).toBe(snap.attendedShows);
    expect(out.trackedShows).toBe(snap.trackedShows);
    expect(out.trackedEntries).toBe(snap.trackedEntries);
  });

  it("round-trips through exportEnvelope.parse without throwing", () => {
    expect(() =>
      exportEnvelope.parse(serializeExport(sampleSnapshot(), 1)),
    ).not.toThrow();
  });
});

describe("exportEnvelope — strictObject prototype-pollution defense (T-05-06)", () => {
  it("rejects an object with an unexpected top-level key", () => {
    const valid = serializeExport(sampleSnapshot(), 1) as Record<
      string,
      unknown
    >;
    const tampered = { ...valid, injected: "surprise" };
    expect(() => exportEnvelope.parse(tampered)).toThrow();
  });
});

describe("exportEnvelope — enum-pinning guards Table<> assignability (Plan 05-03/05-05)", () => {
  it("rejects an out-of-vocabulary trackedShows.status", () => {
    const bad = serializeExport(sampleSnapshot(), 1) as ExportEnvelope;
    bad.trackedShows[0].status = "paused" as never;
    expect(() => exportEnvelope.parse(bad)).toThrow();
  });

  it("rejects an out-of-vocabulary trackedShows.currentSetNumber", () => {
    const bad = serializeExport(sampleSnapshot(), 1) as ExportEnvelope;
    bad.trackedShows[0].currentSetNumber = "3" as never;
    expect(() => exportEnvelope.parse(bad)).toThrow();
  });

  it("rejects an out-of-vocabulary trackedEntries.setNumber", () => {
    const bad = serializeExport(sampleSnapshot(), 1) as ExportEnvelope;
    bad.trackedEntries[0].setNumber = "3" as never;
    expect(() => exportEnvelope.parse(bad)).toThrow();
  });

  it("rejects an out-of-vocabulary trackedEntries.outcome", () => {
    const bad = serializeExport(sampleSnapshot(), 1) as ExportEnvelope;
    bad.trackedEntries[0].outcome = "maybe" as never;
    expect(() => exportEnvelope.parse(bad)).toThrow();
  });

  it("rejects an out-of-vocabulary trackedEntries.source", () => {
    const bad = serializeExport(sampleSnapshot(), 1) as ExportEnvelope;
    bad.trackedEntries[0].source = "robot" as never;
    expect(() => exportEnvelope.parse(bad)).toThrow();
  });
});

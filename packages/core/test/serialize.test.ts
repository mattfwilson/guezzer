import { describe, expect, it } from "vitest";
import { config } from "../src/config.ts";
import {
  archiveShowRow,
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
    owner: "Matt",
    archiveShows: [
      {
        show_id: 1782000000,
        date: "2026-07-13",
        venueName: "Red Rocks Amphitheatre",
        city: "Morrison",
        sets: [
          { n: "1", songs: [{ songId: 42, songName: "Rattlesnake" }] },
          { n: "e", songs: [{ songId: 7, songName: "The River" }] },
        ],
      },
    ],
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

// Envelope v2 (plan 06-07): the six D-09 keys plus `owner` (D-17 fork key) and
// `archiveShows` (the online-fallback setlist cache — Pitfall 5).
const V2_KEYS = [
  "archiveShows",
  "attendedShows",
  "exportedAt",
  "meta",
  "owner",
  "schemaVersion",
  "trackedEntries",
  "trackedShows",
];

describe("serializeExport — envelope v2 shape", () => {
  it("produces exactly the eight v2 top-level keys, no extras", () => {
    const out = serializeExport(sampleSnapshot(), 2);
    expect(Object.keys(out).sort()).toEqual(V2_KEYS);
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

  it("carries meta/attendedShows/trackedShows through verbatim (identity, no mutation)", () => {
    const snap = sampleSnapshot();
    const out = serializeExport(snap, 1);
    expect(out.meta).toBe(snap.meta);
    expect(out.attendedShows).toBe(snap.attendedShows);
    expect(out.trackedShows).toBe(snap.trackedShows);
  });

  it("carries trackedEntries values through, minus the volatile id (CR-01 / T-05-07)", () => {
    const snap = sampleSnapshot();
    const out = serializeExport(snap, 1);
    // Not the same array reference — id is stripped via a map — but every
    // other field passes through unchanged.
    expect(out.trackedEntries).not.toBe(snap.trackedEntries);
    const { id: _id, ...expected } = snap.trackedEntries[0];
    expect(out.trackedEntries[0]).toEqual(expected);
  });

  it("omits the volatile device-local id from every exported trackedEntry (CR-01 / T-05-07)", () => {
    const out = serializeExport(sampleSnapshot(), 1);
    expect(out.trackedEntries.every((e) => !("id" in e))).toBe(true);
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

describe("serializeExport — v2 owner + archiveShows (plan 06-07)", () => {
  it("carries owner and archiveShows through verbatim (identity, no mutation)", () => {
    const snap = sampleSnapshot();
    const out = serializeExport(snap, 2);
    expect(out.owner).toBe(snap.owner);
    expect(out.archiveShows).toBe(snap.archiveShows);
  });

  it("carries a null owner through (unset identity)", () => {
    const snap = { ...sampleSnapshot(), owner: null };
    expect(serializeExport(snap, 2).owner).toBeNull();
  });

  it("round-trips a v2 envelope through exportEnvelope.parse without throwing", () => {
    expect(() =>
      exportEnvelope.parse(serializeExport(sampleSnapshot(), 2)),
    ).not.toThrow();
  });

  it("rejects an owner longer than OWNER_NAME_MAX_LENGTH at parse", () => {
    const overlong = "x".repeat(config.dex.OWNER_NAME_MAX_LENGTH + 1);
    const bad = serializeExport({ ...sampleSnapshot(), owner: overlong }, 2);
    expect(() => exportEnvelope.parse(bad)).toThrow();
  });

  it("accepts an owner of exactly OWNER_NAME_MAX_LENGTH", () => {
    const maxOwner = "x".repeat(config.dex.OWNER_NAME_MAX_LENGTH);
    const ok = serializeExport({ ...sampleSnapshot(), owner: maxOwner }, 2);
    expect(() => exportEnvelope.parse(ok)).not.toThrow();
  });
});

describe("archiveShowRow — enum-pinned set vocabulary + strict shape (T-06-14)", () => {
  const validRow = {
    show_id: 1782000000,
    date: "2026-07-13",
    venueName: "Red Rocks Amphitheatre",
    city: "Morrison",
    sets: [{ n: "1", songs: [{ songId: 42, songName: "Rattlesnake" }] }],
  };

  it("accepts a well-formed archive cache row", () => {
    expect(() => archiveShowRow.parse(validRow)).not.toThrow();
  });

  it("rejects a set label outside the closed 1|2|e vocabulary", () => {
    const bad = {
      ...validRow,
      sets: [{ n: "3", songs: [{ songId: 42, songName: "Rattlesnake" }] }],
    };
    expect(() => archiveShowRow.parse(bad)).toThrow();
  });

  it("rejects an archive row carrying an unexpected key (strictObject)", () => {
    expect(() =>
      archiveShowRow.parse({ ...validRow, injected: "surprise" }),
    ).toThrow();
  });
});

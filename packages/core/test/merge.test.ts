import { describe, expect, it } from "vitest";
import { serializeExport } from "../src/data-safety/serialize.ts";
import type { ExportSnapshot } from "../src/data-safety/serialize.ts";
import { parseAndMergeImport } from "../src/data-safety/merge.ts";

const SCHEMA_VERSION = 1;

function emptySnapshot(): ExportSnapshot {
  return { meta: [], attendedShows: [], trackedShows: [], trackedEntries: [] };
}

function show(
  over: Partial<ExportSnapshot["trackedShows"][number]> = {},
): ExportSnapshot["trackedShows"][number] {
  return {
    sessionId: "sess",
    date: "2026-07-13",
    status: "finalized",
    currentSetNumber: "e",
    startedAt: 1_700_000_000_000,
    showId: null,
    venueId: null,
    venueName: null,
    city: null,
    ...over,
  };
}

function entry(
  over: Partial<ExportSnapshot["trackedEntries"][number]> = {},
): ExportSnapshot["trackedEntries"][number] {
  return {
    sessionId: "sess",
    position: 1,
    songId: 1,
    songName: "Song",
    setNumber: "1",
    outcome: "hit",
    shownFanSongIds: [1],
    isPlaceholder: false,
    source: "manual",
    loggedAt: 1_700_000_000_001,
    ...over,
  };
}

/** Build a valid raw JSON export string from a snapshot. */
function rawExport(snap: ExportSnapshot, version = SCHEMA_VERSION): string {
  return JSON.stringify(serializeExport(snap, version));
}

describe("parseAndMergeImport — validation gate (D-12 / T-05-05 / T-05-06)", () => {
  it("rejects malformed JSON without referencing local data", () => {
    const result = parseAndMergeImport("{not json", emptySnapshot(), SCHEMA_VERSION);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/valid JSON/i);
    // A failure result carries no merged data.
    expect("merged" in result).toBe(false);
  });

  it("rejects a shape-mismatched file (wrong type) — no partial merge", () => {
    const bad = JSON.stringify({
      schemaVersion: 1,
      exportedAt: "2026-07-13T00:00:00.000Z",
      meta: "not-an-array",
      attendedShows: [],
      trackedShows: [],
      trackedEntries: [],
    });
    const result = parseAndMergeImport(bad, emptySnapshot(), SCHEMA_VERSION);
    expect(result.ok).toBe(false);
    expect("merged" in result).toBe(false);
  });

  it("rejects a file with an unexpected top-level key (strictObject)", () => {
    const valid = JSON.parse(rawExport(emptySnapshot()));
    valid.injected = "surprise";
    const result = parseAndMergeImport(
      JSON.stringify(valid),
      emptySnapshot(),
      SCHEMA_VERSION,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a backup from a newer schema version", () => {
    const raw = rawExport(emptySnapshot(), 2);
    const result = parseAndMergeImport(raw, emptySnapshot(), SCHEMA_VERSION);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/newer version/i);
  });
});

describe("parseAndMergeImport — union merge never drops local (D-10)", () => {
  it("keeps a local-only trackedShow absent from the import", () => {
    const local: ExportSnapshot = {
      ...emptySnapshot(),
      trackedShows: [show({ sessionId: "local-only", date: "2026-07-01" })],
    };
    const incoming: ExportSnapshot = {
      ...emptySnapshot(),
      trackedShows: [show({ sessionId: "import-only", date: "2026-07-02" })],
    };
    const result = parseAndMergeImport(rawExport(incoming), local, SCHEMA_VERSION);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const ids = result.merged.trackedShows.map((s) => s.sessionId).sort();
      expect(ids).toEqual(["import-only", "local-only"]);
    }
  });

  it("keeps a local-only meta row and local wins on key collision", () => {
    const local: ExportSnapshot = {
      ...emptySnapshot(),
      meta: [
        { key: "theme", value: "dark" },
        { key: "localOnly", value: 1 },
      ],
    };
    const incoming: ExportSnapshot = {
      ...emptySnapshot(),
      meta: [{ key: "theme", value: "light" }],
    };
    const result = parseAndMergeImport(rawExport(incoming), local, SCHEMA_VERSION);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const theme = result.merged.meta.find((m) => m.key === "theme");
      expect(theme?.value).toBe("dark"); // local wins (device-local settings)
      expect(result.merged.meta.some((m) => m.key === "localOnly")).toBe(true);
    }
  });

  it("keeps a local-only trackedEntry not present in the import", () => {
    const local: ExportSnapshot = {
      ...emptySnapshot(),
      trackedShows: [show({ sessionId: "s1" })],
      trackedEntries: [entry({ sessionId: "s1", position: 1, songName: "Local" })],
    };
    const result = parseAndMergeImport(
      rawExport(emptySnapshot()),
      local,
      SCHEMA_VERSION,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.merged.trackedEntries).toHaveLength(1);
      expect(result.merged.trackedEntries[0].songName).toBe("Local");
    }
  });
});

describe("parseAndMergeImport — id-less merge output (CR-01 / T-05-07)", () => {
  it("preserves both a local and an incoming entry that share a numeric id but differ in (sessionId, position), and strips id from the result", () => {
    const local: ExportSnapshot = {
      ...emptySnapshot(),
      trackedShows: [show({ sessionId: "A", date: "2026-08-01" })],
      trackedEntries: [
        entry({ sessionId: "A", position: 1, id: 1, songName: "Local" }),
      ],
    };
    const incoming: ExportSnapshot = {
      ...emptySnapshot(),
      trackedShows: [show({ sessionId: "B", date: "2026-08-02" })],
      trackedEntries: [
        entry({ sessionId: "B", position: 1, id: 1, songName: "Incoming" }),
      ],
    };
    const result = parseAndMergeImport(rawExport(incoming), local, SCHEMA_VERSION);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.merged.trackedEntries).toHaveLength(2);
      expect(result.merged.trackedEntries.every((e) => e.id === undefined)).toBe(
        true,
      );
      const names = result.merged.trackedEntries.map((e) => e.songName).sort();
      expect(names).toEqual(["Incoming", "Local"]);
    }
  });
});

describe("parseAndMergeImport — same-show dedupe (D-11)", () => {
  it("collapses a night tracked on two devices (same show_id) to ONE attendance, keeping the richer setlist", () => {
    // Local device: bound show 999, only 1 song logged.
    const local: ExportSnapshot = {
      ...emptySnapshot(),
      trackedShows: [show({ sessionId: "dev-a", showId: 999 })],
      trackedEntries: [entry({ sessionId: "dev-a", position: 1, songName: "A1" })],
    };
    // Friend's device: SAME show 999, richer (2 songs), different sessionId.
    const incoming: ExportSnapshot = {
      ...emptySnapshot(),
      trackedShows: [show({ sessionId: "dev-b", showId: 999 })],
      trackedEntries: [
        entry({ sessionId: "dev-b", position: 1, songName: "B1" }),
        entry({ sessionId: "dev-b", position: 2, songName: "B2" }),
      ],
    };
    const result = parseAndMergeImport(rawExport(incoming), local, SCHEMA_VERSION);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // ONE attendance for the night.
      expect(result.merged.trackedShows).toHaveLength(1);
      expect(result.merged.trackedShows[0].sessionId).toBe("dev-b"); // richer wins
      // Only the richer setlist's entries survive — no double count.
      expect(result.merged.trackedEntries).toHaveLength(2);
      expect(
        result.merged.trackedEntries.every((e) => e.sessionId === "dev-b"),
      ).toBe(true);
    }
  });

  it("collapses two unbound shows sharing a date to ONE attendance", () => {
    const local: ExportSnapshot = {
      ...emptySnapshot(),
      trackedShows: [show({ sessionId: "dev-a", showId: null, date: "2026-08-01" })],
      trackedEntries: [entry({ sessionId: "dev-a", position: 1 })],
    };
    const incoming: ExportSnapshot = {
      ...emptySnapshot(),
      trackedShows: [show({ sessionId: "dev-b", showId: null, date: "2026-08-01" })],
      trackedEntries: [
        entry({ sessionId: "dev-b", position: 1 }),
        entry({ sessionId: "dev-b", position: 2 }),
      ],
    };
    const result = parseAndMergeImport(rawExport(incoming), local, SCHEMA_VERSION);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.merged.trackedShows).toHaveLength(1);
      expect(result.merged.trackedEntries).toHaveLength(2);
    }
  });

  it("does NOT collapse distinct nights (different dates, both unbound)", () => {
    const local: ExportSnapshot = {
      ...emptySnapshot(),
      trackedShows: [show({ sessionId: "dev-a", showId: null, date: "2026-08-01" })],
    };
    const incoming: ExportSnapshot = {
      ...emptySnapshot(),
      trackedShows: [show({ sessionId: "dev-b", showId: null, date: "2026-08-02" })],
    };
    const result = parseAndMergeImport(rawExport(incoming), local, SCHEMA_VERSION);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.merged.trackedShows).toHaveLength(2);
  });

  it("WR-01: on an entry-count TIE within the same attendance group, the LOCAL show wins (local survives)", () => {
    // Both devices tracked the same bound show (999) with an EQUAL entry
    // count — a genuine tie must never drop the local-unique night in
    // favour of the incoming copy (D-10 "local survives").
    const local: ExportSnapshot = {
      ...emptySnapshot(),
      trackedShows: [show({ sessionId: "dev-local", showId: 999 })],
      trackedEntries: [
        entry({ sessionId: "dev-local", position: 1, songName: "LocalOnly" }),
      ],
    };
    const incoming: ExportSnapshot = {
      ...emptySnapshot(),
      trackedShows: [show({ sessionId: "dev-incoming", showId: 999 })],
      trackedEntries: [
        entry({ sessionId: "dev-incoming", position: 1, songName: "IncomingOnly" }),
      ],
    };
    const result = parseAndMergeImport(rawExport(incoming), local, SCHEMA_VERSION);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.merged.trackedShows).toHaveLength(1);
      expect(result.merged.trackedShows[0].sessionId).toBe("dev-local");
      expect(result.merged.trackedEntries).toHaveLength(1);
      expect(result.merged.trackedEntries[0].sessionId).toBe("dev-local");
      expect(result.merged.trackedEntries[0].songName).toBe("LocalOnly");
    }
  });
});

describe("parseAndMergeImport — migration chain + metrics", () => {
  it("merges a v1 file unchanged through the identity (v1→v1) chain", () => {
    const incoming: ExportSnapshot = {
      ...emptySnapshot(),
      trackedShows: [show({ sessionId: "x", showId: 5 })],
      trackedEntries: [entry({ sessionId: "x", position: 1 })],
    };
    const result = parseAndMergeImport(
      rawExport(incoming, 1),
      emptySnapshot(),
      SCHEMA_VERSION,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.merged.trackedShows).toHaveLength(1);
      expect(result.merged.trackedEntries).toHaveLength(1);
    }
  });

  it("reports added shows and songs gained from the import", () => {
    const incoming: ExportSnapshot = {
      ...emptySnapshot(),
      attendedShows: [],
      trackedShows: [
        show({ sessionId: "n1", showId: 1 }),
        show({ sessionId: "n2", showId: 2 }),
      ],
      trackedEntries: [
        entry({ sessionId: "n1", position: 1 }),
        entry({ sessionId: "n2", position: 1 }),
        entry({ sessionId: "n2", position: 2 }),
      ],
    };
    const result = parseAndMergeImport(
      rawExport(incoming),
      emptySnapshot(),
      SCHEMA_VERSION,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.added.shows).toBe(2);
      expect(result.added.songs).toBe(3);
    }
  });
});

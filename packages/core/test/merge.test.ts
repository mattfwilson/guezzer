import { describe, expect, it } from "vitest";
import { serializeExport } from "../src/data-safety/serialize.ts";
import type { ExportSnapshot } from "../src/data-safety/serialize.ts";
import { parseAndMergeImport } from "../src/data-safety/merge.ts";
import { exportEnvelope, bingoCardRow } from "../src/data-safety/export-schema.ts";
import type { BingoCard } from "../src/bingo/types.ts";

const SCHEMA_VERSION = 1;
/** Current schema version once envelope v2 (plan 06-07) ships. */
const SCHEMA_VERSION_V2 = 2;
/** Current schema version once envelope v3 (plan 15-01, bingoCards) ships. */
const SCHEMA_VERSION_V3 = 3;

function emptySnapshot(): ExportSnapshot {
  return {
    owner: null,
    archiveShows: [],
    meta: [],
    attendedShows: [],
    trackedShows: [],
    trackedEntries: [],
    bingoCards: [],
  };
}

/** A valid pure `BingoCard` (16 squares, one free at freeIndex 5). */
function bingoCard(over: Partial<BingoCard> = {}): BingoCard {
  const squares: BingoCard["squares"] = Array.from({ length: 16 }, (_, i) =>
    i === 5
      ? ({ kind: "free" } as const)
      : ({ kind: "song", songId: i + 1, label: `Song ${i + 1}` } as const),
  );
  return {
    schemaVersion: 1,
    seed: "seed-abc",
    vibe: "balanced",
    corpusVersion: "corpus-1",
    freeIndex: 5,
    squares,
    ...over,
  };
}

/** A v3 `bingoCards` envelope row wrapping the pure card (D-11/D-12). */
function bingoRow(
  over: Partial<ExportSnapshot["bingoCards"][number]> = {},
): ExportSnapshot["bingoCards"][number] {
  return {
    cardId: "sess-1",
    sessionId: "sess-1",
    card: bingoCard(),
    caughtSnapshot: [1, 2, 3],
    lockedAt: 1_700_000_000_000,
    showDate: "2026-08-14",
    venueName: "Red Rocks Amphitheatre",
    city: "Morrison",
    ...over,
  };
}

/** An archiveShows cache row (the v2 online-fallback setlist cache). */
function archiveRow(
  over: Partial<ExportSnapshot["archiveShows"][number]> = {},
): ExportSnapshot["archiveShows"][number] {
  return {
    show_id: 100,
    date: "2026-07-13",
    venueName: "Red Rocks Amphitheatre",
    city: "Morrison",
    sets: [{ n: "1", songs: [{ songId: 42, songName: "Rattlesnake" }] }],
    ...over,
  };
}

/**
 * Serialize a snapshot as a GENUINE v1 raw file: strip the v2-only `owner` and
 * `archiveShows` keys so the fixture matches a backup written before plan 06-07.
 */
function rawV1Export(snap: ExportSnapshot): string {
  const env = serializeExport(snap, 1) as Record<string, unknown>;
  delete env.owner;
  delete env.archiveShows;
  return JSON.stringify(env);
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

/**
 * Serialize a snapshot as a GENUINE v2 raw file: strip the v3-only `bingoCards`
 * key so the fixture matches a backup written before plan 15-01 (exercises the
 * v2→v3 MIGRATIONS[2] step, not just the parse-time `.default([])`).
 */
function rawV2Export(snap: ExportSnapshot): string {
  const env = serializeExport(snap, 2) as Record<string, unknown>;
  delete env.bingoCards;
  return JSON.stringify(env);
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

  // SAFE-04 / D-01 INTENTIONAL INVERSION (was "collapses two unbound shows
  // sharing a date to ONE attendance"). A genuine doubleheader — two DISTINCT
  // unbound sessions on the same date — must survive as TWO attendances; the
  // export/dex must never silently lose a caught show. A plan-checker MUST NOT
  // restore the old ONE-attendance collapse assertion.
  it("keeps two unbound same-date shows as TWO attendances (D-01 doubleheader survives)", () => {
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
      // Distinct unbound sessions on one date → TWO attendances, no adoption.
      expect(result.merged.trackedShows).toHaveLength(2);
      expect(
        result.merged.trackedShows.map((s) => s.sessionId).sort(),
      ).toEqual(["dev-a", "dev-b"]);
      // No song-union collapse: each night keeps its own entries (1 + 2 = 3).
      expect(result.merged.trackedEntries).toHaveLength(3);
    }
  });

  it("keeps a bound + unbound pair on the same date as TWO groups (D-02 unchanged)", () => {
    // One night bound to show 999, a genuinely different unbound night on the
    // same date — the bound `id:` key and the unbound `date:#session` key never
    // collide, so both survive.
    const local: ExportSnapshot = {
      ...emptySnapshot(),
      trackedShows: [show({ sessionId: "dev-bound", showId: 999, date: "2026-08-01" })],
      trackedEntries: [entry({ sessionId: "dev-bound", position: 1 })],
    };
    const incoming: ExportSnapshot = {
      ...emptySnapshot(),
      trackedShows: [show({ sessionId: "dev-unbound", showId: null, date: "2026-08-01" })],
      trackedEntries: [entry({ sessionId: "dev-unbound", position: 1 })],
    };
    const result = parseAndMergeImport(rawExport(incoming), local, SCHEMA_VERSION);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.merged.trackedShows).toHaveLength(2);
      expect(
        result.merged.trackedShows.map((s) => s.sessionId).sort(),
      ).toEqual(["dev-bound", "dev-unbound"]);
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

describe("parseAndMergeImport — same-night self-merge unions entries (CR-01 / D-10)", () => {
  it("adopts local-unique songs onto the canonical session when the LOCAL session is the smaller one (multi-device self-merge)", () => {
    // Device A (local) tracked night 999 with songs {1,2,3}; Device B
    // (incoming, same owner) tracked the SAME night with songs {4,5,6,7}.
    // D-11 collapses the night to ONE attendance (canonical = dev-b, richer),
    // but D-10 demands every local sighting survive: the merged night must be
    // the UNION {1..7}, exactly what deriveDex would produce were both
    // sessions present.
    const local: ExportSnapshot = {
      ...emptySnapshot(),
      trackedShows: [show({ sessionId: "dev-a", showId: 999 })],
      trackedEntries: [
        entry({ sessionId: "dev-a", position: 1, songId: 1, songName: "L1" }),
        entry({ sessionId: "dev-a", position: 2, songId: 2, songName: "L2" }),
        entry({ sessionId: "dev-a", position: 3, songId: 3, songName: "L3" }),
      ],
    };
    const incoming: ExportSnapshot = {
      ...emptySnapshot(),
      trackedShows: [show({ sessionId: "dev-b", showId: 999 })],
      trackedEntries: [
        entry({ sessionId: "dev-b", position: 1, songId: 4, songName: "B4" }),
        entry({ sessionId: "dev-b", position: 2, songId: 5, songName: "B5" }),
        entry({ sessionId: "dev-b", position: 3, songId: 6, songName: "B6" }),
        entry({ sessionId: "dev-b", position: 4, songId: 7, songName: "B7" }),
      ],
    };
    const result = parseAndMergeImport(rawExport(incoming), local, SCHEMA_VERSION);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Still ONE attendance for the night (D-11), richer session canonical.
      expect(result.merged.trackedShows).toHaveLength(1);
      expect(result.merged.trackedShows[0].sessionId).toBe("dev-b");
      // EVERY local sighting survives (D-10): union of both devices' songs.
      const songIds = result.merged.trackedEntries
        .map((e) => e.songId)
        .sort((a, b) => (a ?? 0) - (b ?? 0));
      expect(songIds).toEqual([1, 2, 3, 4, 5, 6, 7]);
      // Adopted entries are re-stamped onto the canonical session…
      expect(
        result.merged.trackedEntries.every((e) => e.sessionId === "dev-b"),
      ).toBe(true);
      // …with UNIQUE positions (Dexie [sessionId+position] compound index).
      const posKeys = new Set(
        result.merged.trackedEntries.map((e) => `${e.sessionId} ${e.position}`),
      );
      expect(posKeys.size).toBe(7);
      // Metrics: only the four incoming songs are "added" — re-stamped local
      // entries are not new.
      expect(result.added.songs).toBe(4);
      expect(result.added.shows).toBe(0);
    }
  });

  it("does NOT double-count a song both devices logged for the same night, keeping the canonical session's copy", () => {
    const local: ExportSnapshot = {
      ...emptySnapshot(),
      trackedShows: [show({ sessionId: "dev-a", showId: 999 })],
      trackedEntries: [
        entry({ sessionId: "dev-a", position: 1, songId: 1, songName: "OnlyLocal" }),
        entry({ sessionId: "dev-a", position: 2, songId: 2, songName: "Shared (local copy)" }),
      ],
    };
    const incoming: ExportSnapshot = {
      ...emptySnapshot(),
      trackedShows: [show({ sessionId: "dev-b", showId: 999 })],
      trackedEntries: [
        entry({ sessionId: "dev-b", position: 1, songId: 2, songName: "Shared (canonical copy)" }),
        entry({ sessionId: "dev-b", position: 2, songId: 3, songName: "B3" }),
        entry({ sessionId: "dev-b", position: 3, songId: 4, songName: "B4" }),
      ],
    };
    const result = parseAndMergeImport(rawExport(incoming), local, SCHEMA_VERSION);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const songIds = result.merged.trackedEntries
        .map((e) => e.songId)
        .sort((a, b) => (a ?? 0) - (b ?? 0));
      // Union without double-counting the shared song 2.
      expect(songIds).toEqual([1, 2, 3, 4]);
      // The canonical (richer) session's copy of the duplicate stands.
      const shared = result.merged.trackedEntries.find((e) => e.songId === 2);
      expect(shared?.songName).toBe("Shared (canonical copy)");
    }
  });

  it("preserves a local placeholder (songId null) from the dropped session — never provably a duplicate", () => {
    const local: ExportSnapshot = {
      ...emptySnapshot(),
      trackedShows: [show({ sessionId: "dev-a", showId: 999 })],
      trackedEntries: [
        entry({
          sessionId: "dev-a",
          position: 1,
          songId: null,
          songName: "???",
          isPlaceholder: true,
        }),
      ],
    };
    const incoming: ExportSnapshot = {
      ...emptySnapshot(),
      trackedShows: [show({ sessionId: "dev-b", showId: 999 })],
      trackedEntries: [
        entry({ sessionId: "dev-b", position: 1, songId: 5, songName: "B5" }),
        entry({ sessionId: "dev-b", position: 2, songId: 6, songName: "B6" }),
      ],
    };
    const result = parseAndMergeImport(rawExport(incoming), local, SCHEMA_VERSION);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.merged.trackedEntries).toHaveLength(3);
      const placeholder = result.merged.trackedEntries.find((e) => e.isPlaceholder);
      expect(placeholder).toBeDefined();
      expect(placeholder?.sessionId).toBe("dev-b"); // re-stamped onto canonical
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

  it("migrates a GENUINE v1 file (no owner/archiveShows keys) to v2 defaults and merges", () => {
    const incoming: ExportSnapshot = {
      ...emptySnapshot(),
      trackedShows: [show({ sessionId: "x", showId: 5 })],
      trackedEntries: [entry({ sessionId: "x", position: 1 })],
    };
    const result = parseAndMergeImport(
      rawV1Export(incoming),
      emptySnapshot(),
      SCHEMA_VERSION_V2,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      // v1→v2 migration filled the new fields with their defaults.
      expect(result.merged.owner).toBeNull();
      expect(result.merged.archiveShows).toEqual([]);
      // The v1 payload still merged cleanly.
      expect(result.merged.trackedShows).toHaveLength(1);
      expect(result.merged.trackedEntries).toHaveLength(1);
    }
  });

  it("still rejects a backup from a newer schema version (v3 under current v2)", () => {
    const raw = rawExport(emptySnapshot(), 3);
    const result = parseAndMergeImport(raw, emptySnapshot(), SCHEMA_VERSION_V2);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/newer version/i);
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

describe("parseAndMergeImport — v2 archiveShows union-merge (plan 06-07)", () => {
  it("unions archiveShows by show_id, keeps every local row, local wins on collision", () => {
    const local: ExportSnapshot = {
      ...emptySnapshot(),
      archiveShows: [
        archiveRow({ show_id: 1, city: "LocalCity" }),
        archiveRow({ show_id: 2 }),
      ],
    };
    const incoming: ExportSnapshot = {
      ...emptySnapshot(),
      archiveShows: [
        archiveRow({ show_id: 1, city: "IncomingCity" }),
        archiveRow({ show_id: 3 }),
      ],
    };
    const result = parseAndMergeImport(
      rawExport(incoming, SCHEMA_VERSION_V2),
      local,
      SCHEMA_VERSION_V2,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const ids = result.merged.archiveShows.map((r) => r.show_id).sort();
      expect(ids).toEqual([1, 2, 3]); // every local row survives, incoming-3 added
      const one = result.merged.archiveShows.find((r) => r.show_id === 1);
      expect(one?.city).toBe("LocalCity"); // local wins on collision
    }
  });

  it("keeps the LOCAL owner on merge (owner is a device-local fork key, never merged)", () => {
    const local: ExportSnapshot = { ...emptySnapshot(), owner: "Matt" };
    const incoming: ExportSnapshot = { ...emptySnapshot(), owner: "Friend" };
    const result = parseAndMergeImport(
      rawExport(incoming, SCHEMA_VERSION_V2),
      local,
      SCHEMA_VERSION_V2,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.merged.owner).toBe("Matt");
  });

  it("rejects the WHOLE file when an archiveShows row carries an extra key (T-06-14)", () => {
    const env = serializeExport(
      { ...emptySnapshot(), archiveShows: [archiveRow({ show_id: 1 })] },
      SCHEMA_VERSION_V2,
    );
    const tampered = JSON.parse(JSON.stringify(env));
    tampered.archiveShows[0].injected = "surprise";
    const result = parseAndMergeImport(
      JSON.stringify(tampered),
      emptySnapshot(),
      SCHEMA_VERSION_V2,
    );
    expect(result.ok).toBe(false);
    expect("merged" in result).toBe(false);
  });

  it("rejects the WHOLE file when an archiveShows set label is out of vocabulary", () => {
    const env = serializeExport(
      {
        ...emptySnapshot(),
        archiveShows: [
          archiveRow({
            show_id: 1,
            sets: [{ n: "3" as never, songs: [{ songId: 1, songName: "X" }] }],
          }),
        ],
      },
      SCHEMA_VERSION_V2,
    );
    const result = parseAndMergeImport(
      JSON.stringify(env),
      emptySnapshot(),
      SCHEMA_VERSION_V2,
    );
    expect(result.ok).toBe(false);
  });
});

describe("envelope v3 — bingoCardRow schema + serialize passthrough (Task 1, D-11/D-13/D-14)", () => {
  it("parses a well-formed v3 envelope carrying bingoCards", () => {
    const env = serializeExport(
      { ...emptySnapshot(), bingoCards: [bingoRow()] },
      SCHEMA_VERSION_V3,
    );
    const parsed = exportEnvelope.safeParse(env);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.bingoCards).toHaveLength(1);
  });

  it("defaults bingoCards to [] on a pre-v3 envelope with no bingoCards key (.default([]))", () => {
    // A genuine v2 backup lacks the bingoCards key entirely — the strict
    // schema's `.default([])` must fill it so the file still parses (D-14).
    const env = serializeExport(emptySnapshot(), 2) as Record<string, unknown>;
    delete env.bingoCards;
    const parsed = exportEnvelope.safeParse(env);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.bingoCards).toEqual([]);
  });

  it("hard-fails a bingoCards row with an extra top-level key (strictObject)", () => {
    const row = { ...bingoRow(), injected: "surprise" };
    expect(bingoCardRow.safeParse(row).success).toBe(false);
  });

  it("hard-fails a bingoCards row whose card.squares carries an unknown kind (reused discriminated union)", () => {
    const base = bingoRow();
    const badCard = {
      ...base.card,
      squares: base.card.squares.map((s, i) =>
        i === 0 ? ({ kind: "mystery", label: "x" } as never) : s,
      ),
    };
    expect(bingoCardRow.safeParse({ ...base, card: badCard }).success).toBe(false);
  });

  it("serializeExport passes bingoCards through verbatim (no mutation, cardId stable — unlike trackedEntries' ++id strip)", () => {
    const rows = [bingoRow({ cardId: "s1", sessionId: "s1" })];
    const env = serializeExport(
      { ...emptySnapshot(), bingoCards: rows },
      SCHEMA_VERSION_V3,
    );
    expect(env.bingoCards).toEqual(rows);
  });
});

describe("parseAndMergeImport — v3 bingoCards migration + union merge (Task 2, D-13 / Open-Q1)", () => {
  // MIGRATIONS[2] is MANDATORY even though `.default([])` fills the field at
  // parse — the migration loop errors "too old" if MIGRATIONS[v] is missing for
  // any step it must take (v2→v3 here).
  it("migrates a GENUINE v2 file (no bingoCards key) to v3, defaulting bingoCards to []", () => {
    const incoming: ExportSnapshot = {
      ...emptySnapshot(),
      trackedShows: [show({ sessionId: "x", showId: 5 })],
    };
    const result = parseAndMergeImport(
      rawV2Export(incoming),
      emptySnapshot(),
      SCHEMA_VERSION_V3,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.merged.bingoCards).toEqual([]);
      expect(result.merged.trackedShows).toHaveLength(1); // v2 payload still merged
    }
  });

  it("unions non-colliding cards from local and incoming (both survive)", () => {
    const local: ExportSnapshot = {
      ...emptySnapshot(),
      bingoCards: [bingoRow({ cardId: "local-1", sessionId: "local-1" })],
    };
    const incoming: ExportSnapshot = {
      ...emptySnapshot(),
      bingoCards: [bingoRow({ cardId: "inc-1", sessionId: "inc-1" })],
    };
    const result = parseAndMergeImport(
      rawExport(incoming, SCHEMA_VERSION_V3),
      local,
      SCHEMA_VERSION_V3,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const ids = result.merged.bingoCards.map((c) => c.cardId).sort();
      expect(ids).toEqual(["inc-1", "local-1"]);
    }
  });

  // D-13 contradiction resolution (RESEARCH Open Q1): D-13 says "imported wins"
  // yet cites the local-wins `archiveShows` precedent — a genuine contradiction.
  // LOCKED wins so a locked historical card is never reverted to a draft.
  it("locked-vs-draft collision: the LOCAL locked card survives (never reverts to a draft)", () => {
    const local: ExportSnapshot = {
      ...emptySnapshot(),
      bingoCards: [
        bingoRow({ cardId: "c1", sessionId: "c1", lockedAt: 1_700_000_000_000 }),
      ],
    };
    const incoming: ExportSnapshot = {
      ...emptySnapshot(),
      bingoCards: [bingoRow({ cardId: "c1", sessionId: "c1", lockedAt: null })],
    };
    const result = parseAndMergeImport(
      rawExport(incoming, SCHEMA_VERSION_V3),
      local,
      SCHEMA_VERSION_V3,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.merged.bingoCards).toHaveLength(1);
      // Locked wins: the surviving row keeps its lock stamp (Open-Q1 resolution).
      expect(result.merged.bingoCards[0].lockedAt).not.toBeNull();
    }
  });

  // Symmetric to the above (locked-wins is direction-independent): an INCOMING
  // locked card must beat a LOCAL draft on the same cardId.
  it("draft-vs-locked collision: the INCOMING locked card wins over a local draft", () => {
    const local: ExportSnapshot = {
      ...emptySnapshot(),
      bingoCards: [bingoRow({ cardId: "c1", sessionId: "c1", lockedAt: null })],
    };
    const incoming: ExportSnapshot = {
      ...emptySnapshot(),
      bingoCards: [
        bingoRow({ cardId: "c1", sessionId: "c1", lockedAt: 1_700_000_000_000 }),
      ],
    };
    const result = parseAndMergeImport(
      rawExport(incoming, SCHEMA_VERSION_V3),
      local,
      SCHEMA_VERSION_V3,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.merged.bingoCards).toHaveLength(1);
      expect(result.merged.bingoCards[0].lockedAt).not.toBeNull();
    }
  });

  // When both rows share lock-state (both draft OR both locked), D-13's literal
  // first clause governs: the INCOMING (imported) row wins.
  it("same-lock-state collision (both draft): the INCOMING row wins (D-13 literal)", () => {
    const local: ExportSnapshot = {
      ...emptySnapshot(),
      bingoCards: [
        bingoRow({ cardId: "c1", sessionId: "c1", lockedAt: null, venueName: "LOCAL" }),
      ],
    };
    const incoming: ExportSnapshot = {
      ...emptySnapshot(),
      bingoCards: [
        bingoRow({ cardId: "c1", sessionId: "c1", lockedAt: null, venueName: "INCOMING" }),
      ],
    };
    const result = parseAndMergeImport(
      rawExport(incoming, SCHEMA_VERSION_V3),
      local,
      SCHEMA_VERSION_V3,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.merged.bingoCards).toHaveLength(1);
      expect(result.merged.bingoCards[0].venueName).toBe("INCOMING"); // D-13 literal
    }
  });
});

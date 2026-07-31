import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  attendeesByEvent,
  formatEventTime,
  minToClock,
  parseScheduleArtifact,
  sanitizeEventIds,
} from "../../src/schedule/schedule.ts";

/**
 * Schedule domain: the COMMITTED artifact must parse (a malformed transcribe
 * fails here, not on someone's phone at the festival), pick validation must
 * hold the validateFriendRow discipline, and the who's-going grouping must be
 * stable.
 */

const ARTIFACT_PATH = fileURLToPath(
  new URL("../../../../data/schedule/fov-2026.json", import.meta.url),
);
const artifact = parseScheduleArtifact(JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")));

describe("fov-2026 schedule artifact", () => {
  it("parses, with unique ids, known venues, and sane time ranges", () => {
    expect(artifact).not.toBeNull();
    if (!artifact) return;
    const dayDates = new Set(artifact.days.map((d) => d.date));
    const venues = new Set(artifact.venues);
    for (const event of artifact.events) {
      expect(dayDates.has(event.date)).toBe(true);
      expect(venues.has(event.venue)).toBe(true);
      if (event.endMin !== null) expect(event.endMin).toBeGreaterThan(event.startMin);
    }
    // All three headliner sets present — the one transcription error that
    // would matter most at a Gizz festival.
    const gizz = artifact.events.filter((e) =>
      e.title.includes("King Gizzard"),
    );
    expect(gizz.map((e) => e.date)).toEqual(["2026-08-14", "2026-08-15", "2026-08-16"]);
  });

  it("rejects a duplicate event id (would silently merge attendee lists)", () => {
    if (!artifact) throw new Error("artifact failed to parse");
    const raw = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")) as {
      events: { id: string }[];
    };
    raw.events[1].id = raw.events[0].id;
    expect(parseScheduleArtifact(raw)).toBeNull();
  });
});

describe("sanitizeEventIds (untrusted read boundary)", () => {
  const valid = new Set(["a", "b", "c"]);

  it("keeps known ids, DROPS unknown ids (newer-artifact friend), dedupes", () => {
    expect(sanitizeEventIds(["a", "zzz", "b", "a"], valid)).toEqual(["a", "b"]);
  });

  it("rejects non-array / non-string payloads outright (row skipped)", () => {
    expect(sanitizeEventIds("a", valid)).toBeNull();
    expect(sanitizeEventIds([1, "a"], valid)).toBeNull();
    expect(sanitizeEventIds(null, valid)).toBeNull();
  });

  it("is bounded by the valid-id universe — a hostile huge array cannot bloat state", () => {
    const flood = Array.from({ length: 10_000 }, () => "a");
    expect(sanitizeEventIds(flood, valid)).toEqual(["a"]);
  });
});

describe("attendeesByEvent", () => {
  it("groups per event, sorted by displayName for stable renders", () => {
    const index = attendeesByEvent([
      { userId: "u2", displayName: "Tim", eventIds: ["a"] },
      { userId: "u1", displayName: "Max", eventIds: ["a", "b"] },
    ]);
    expect(index.get("a")).toEqual([
      { userId: "u1", displayName: "Max" },
      { userId: "u2", displayName: "Tim" },
    ]);
    expect(index.get("b")).toEqual([{ userId: "u1", displayName: "Max" }]);
    expect(index.get("zzz")).toBeUndefined();
  });
});

describe("time formatting", () => {
  it("renders clock times incl. the past-midnight wrap and open-ended events", () => {
    expect(minToClock(600)).toBe("10:00 AM");
    expect(minToClock(720)).toBe("12:00 PM");
    expect(minToClock(1530)).toBe("1:30 AM"); // Moktar — Friday column, Saturday clock
    expect(formatEventTime(1200, 1380)).toBe("8:00 PM – 11:00 PM");
    expect(formatEventTime(540, null)).toBe("9:00 AM");
  });
});

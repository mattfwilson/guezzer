import { describe, expect, it } from "vitest";
import latestSample from "../../../data/samples/latest.sample.json" with { type: "json" };
import type { LatestSetlistRow } from "../src/ingest/latest-types.ts";
import { bindShowFromLatest, type TrackedShowInput } from "../src/live/bind-show.ts";

const TODAY = "2026-07-13";

function row(overrides: Partial<LatestSetlistRow>): LatestSetlistRow {
  return {
    ...(latestSample.data[0] as unknown as LatestSetlistRow),
    artist_id: 1,
    ...overrides,
  };
}

const todayRows = [
  row({
    show_id: 1782000000,
    showdate: TODAY,
    venue_id: 447,
    venuename: "Red Rocks Amphitheatre",
    city: "Morrison",
    position: 1,
  }),
];

describe("bindShowFromLatest — wrong-show guard (D-07)", () => {
  it("returns a binding for today's latest on an unbound show", () => {
    const tracked: TrackedShowInput = { showId: null };
    const binding = bindShowFromLatest(todayRows, tracked, TODAY);
    expect(binding).toEqual({
      showId: 1782000000,
      venueId: 447,
      venueName: "Red Rocks Amphitheatre",
      city: "Morrison",
    });
  });

  it("returns null when the latest showdate !== today (wrong-show/date guard)", () => {
    const yesterdayRows = [row({ showdate: "2026-07-12", show_id: 1781000000 })];
    expect(bindShowFromLatest(yesterdayRows, { showId: null }, TODAY)).toBeNull();
  });

  it("returns null when the tracked show is already bound (never overwrites showId)", () => {
    expect(bindShowFromLatest(todayRows, { showId: 999888777 }, TODAY)).toBeNull();
  });

  it("returns null when latest rows is empty", () => {
    expect(bindShowFromLatest([], { showId: null }, TODAY)).toBeNull();
  });

  it("binds off the first row's identity fields", () => {
    const multi = [
      row({ show_id: 42, showdate: TODAY, venue_id: 7, venuename: "The Forum", city: "Inglewood", position: 1 }),
      row({ show_id: 42, showdate: TODAY, position: 2 }),
    ];
    const binding = bindShowFromLatest(multi, { showId: null }, TODAY);
    expect(binding).toMatchObject({ showId: 42, venueId: 7, venueName: "The Forum", city: "Inglewood" });
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { db, getMeta, setMeta } from "../src/db/db.ts";

describe("db: Dexie v1 schema round-trips", () => {
  beforeEach(async () => {
    await db.attendedShows.clear();
    await db.meta.clear();
  });

  it("round-trips an attendedShows row by the stable 10-digit show_id (survives-relaunch foundation)", async () => {
    const show = { show_id: 1234567890, showDate: "2026-08-15" };

    await db.attendedShows.put(show);
    const read = await db.attendedShows.get(1234567890);

    expect(read).toEqual(show);
  });

  it("round-trips a value through the meta table via setMeta/getMeta", async () => {
    await setMeta("persistStatus", "persisted");

    const value = await getMeta<string>("persistStatus");

    expect(value).toBe("persisted");
  });

  it("returns undefined from getMeta for a key that was never set", async () => {
    const value = await getMeta<string>("neverSet");

    expect(value).toBeUndefined();
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db, type FriendBeaconRow, type MapPinRow } from "../../src/db/db.ts";

async function resetDb(): Promise<void> {
  await db.delete();
  await db.open();
}

describe("db version(6) — GizzMap tables (additive)", () => {
  beforeEach(resetDb);
  afterEach(resetDb);

  it("opens at version(6) with friendBeacons + mapPins present", () => {
    expect(db.verno).toBe(6);
    expect(db.friendBeacons).toBeDefined();
    expect(db.mapPins).toBeDefined();
  });

  it("friendBeacons upserts by memberId — one row per member, never history", async () => {
    const beacon: FriendBeaconRow = {
      memberId: "m1",
      name: "Max",
      lat: 38.843,
      lng: -106.156,
      accuracyM: 20,
      status: null,
      avatar: "🐊",
      updatedAt: 111,
      receivedAt: 112,
    };
    await db.friendBeacons.put(beacon);
    await db.friendBeacons.put({ ...beacon, lat: 38.844, updatedAt: 222, receivedAt: 223 });

    expect(await db.friendBeacons.count()).toBe(1);
    expect((await db.friendBeacons.get("m1"))?.updatedAt).toBe(222);
  });

  it("mapPins indexes `synced` so the sync loop can query offline-created pins", async () => {
    const pin = (pinId: string, synced: 0 | 1): MapPinRow => ({
      pinId,
      createdBy: "Max",
      label: "Meet here",
      lat: 38.843,
      lng: -106.156,
      createdAt: 1,
      synced,
    });
    await db.mapPins.bulkPut([pin("a", 0), pin("b", 1), pin("c", 0)]);

    const unsynced = await db.mapPins.where("synced").equals(0).toArray();
    expect(unsynced.map((p) => p.pinId).sort()).toEqual(["a", "c"]);
  });
});

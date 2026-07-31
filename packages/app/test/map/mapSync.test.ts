import { describe, expect, it, vi } from "vitest";
import { config as coreConfig } from "@guezzer/core/config";

/**
 * GizzMap Supabase fence (map/mapSync.ts — the relay/group-crypto replacement).
 * The Supabase singleton is mocked so NO network I/O happens. These pin the
 * validateFriendRow-style read boundary (malformed rows skipped, own row
 * dropped, render strings length-clamped, client-side pin TTL), the
 * snake_case column mapping + WR-02 error-reading on the own-beacon upsert,
 * and the two-table realtime subscription.
 */

const NOW = 1_800_000_000_000; // fixed epoch — determinism (core zero-wall-clock discipline)

const mock = vi.hoisted(() => {
  const capture = {
    beaconSelect: { data: [] as unknown[] | null, error: null as unknown },
    pinSelect: { data: [] as unknown[] | null, error: null as unknown },
    upsertResult: { error: null as unknown },
    onChange: null as null | (() => void),
    onFilters: [] as unknown[],
  };
  const upsertSpy = vi.fn((..._args: unknown[]) => Promise.resolve(capture.upsertResult));
  const eqSpy = vi.fn(() => Promise.resolve({ error: null as unknown }));
  const ltSpy = vi.fn(() => Promise.resolve({ error: null as unknown }));
  const deleteSpy = vi.fn(() => ({ eq: eqSpy, lt: ltSpy }));
  const fromSpy = vi.fn((table: string) => ({
    upsert: upsertSpy,
    select: vi.fn(() =>
      Promise.resolve(table === "map_beacons" ? capture.beaconSelect : capture.pinSelect),
    ),
    delete: deleteSpy,
  }));
  const subscribeSpy = vi.fn(() => ({ __channel: "map-feed" }));
  const builder = {
    on: vi.fn((_evt: unknown, filter: unknown, cb: () => void) => {
      capture.onFilters.push(filter);
      capture.onChange = cb;
      return builder;
    }),
    subscribe: subscribeSpy,
  };
  const channelSpy = vi.fn(() => builder);
  const removeChannelSpy = vi.fn(() => Promise.resolve());
  return { capture, upsertSpy, eqSpy, ltSpy, deleteSpy, fromSpy, channelSpy, removeChannelSpy };
});

vi.mock("../../src/db/supabase.ts", () => ({
  supabase: {
    from: mock.fromSpy,
    channel: mock.channelSpy,
    removeChannel: mock.removeChannelSpy,
  },
}));

const {
  validateBeaconRow,
  validatePinRow,
  fetchMapState,
  upsertOwnBeacon,
  insertPin,
  deletePinRemote,
  subscribeMapChanges,
} = await import("../../src/map/mapSync.ts");

const beaconRow = {
  user_id: "friend-1",
  display_name: "Tim",
  lat: 38.843,
  lng: -106.156,
  accuracy_m: 12,
  status: "At the rail",
  avatar: "🐊",
  updated_at: new Date(NOW - 60_000).toISOString(),
};

const pinRow = {
  pin_id: "p1",
  created_by: "friend-1",
  created_by_name: "Tim",
  label: "Meet after encore",
  lat: 38.843,
  lng: -106.156,
  created_at: new Date(NOW - 3_600_000).toISOString(),
};

describe("validateBeaconRow (untrusted read boundary)", () => {
  it("maps a valid row to the app shape with an epoch-ms stamp", () => {
    const row = validateBeaconRow(beaconRow, "me");
    expect(row).toEqual({
      memberId: "friend-1",
      name: "Tim",
      lat: 38.843,
      lng: -106.156,
      accuracyM: 12,
      status: "At the rail",
      avatar: "🐊",
      updatedAt: NOW - 60_000,
    });
  });

  it("drops the caller's OWN row (the live fix renders the own dot)", () => {
    expect(validateBeaconRow(beaconRow, "friend-1")).toBeNull();
  });

  it("skips structurally hostile rows (RLS write-own means a friend controls their columns)", () => {
    expect(validateBeaconRow(null, "me")).toBeNull();
    expect(validateBeaconRow({ ...beaconRow, display_name: "" }, "me")).toBeNull();
    expect(validateBeaconRow({ ...beaconRow, display_name: 7 }, "me")).toBeNull();
    expect(validateBeaconRow({ ...beaconRow, lat: 91 }, "me")).toBeNull();
    expect(validateBeaconRow({ ...beaconRow, lng: "x" }, "me")).toBeNull();
    expect(validateBeaconRow({ ...beaconRow, updated_at: "not-a-date" }, "me")).toBeNull();
  });

  it("CLAMPS over-long render strings instead of dropping the friend", () => {
    const long = "x".repeat(coreConfig.map.STATUS_MAX_LENGTH + 40);
    const row = validateBeaconRow({ ...beaconRow, status: long }, "me");
    expect(row?.status).toHaveLength(coreConfig.map.STATUS_MAX_LENGTH);
  });

  it("degrades a malformed accuracy to null (ring hidden) without losing the row", () => {
    expect(validateBeaconRow({ ...beaconRow, accuracy_m: -5 }, "me")?.accuracyM).toBeNull();
    expect(validateBeaconRow({ ...beaconRow, accuracy_m: "12" }, "me")?.accuracyM).toBeNull();
  });
});

describe("validatePinRow (untrusted read boundary + client-side TTL)", () => {
  it("maps a valid row to a synced=1 app pin", () => {
    expect(validatePinRow(pinRow, NOW)).toEqual({
      pinId: "p1",
      createdBy: "friend-1",
      createdByName: "Tim",
      label: "Meet after encore",
      lat: 38.843,
      lng: -106.156,
      createdAt: NOW - 3_600_000,
      synced: 1,
    });
  });

  it("drops pins past PIN_TTL_MS — the TTL is client-enforced now", () => {
    const expired = {
      ...pinRow,
      created_at: new Date(NOW - coreConfig.map.PIN_TTL_MS).toISOString(),
    };
    expect(validatePinRow(expired, NOW)).toBeNull();
  });

  it("skips malformed rows and clamps over-long labels", () => {
    expect(validatePinRow({ ...pinRow, label: "" }, NOW)).toBeNull();
    expect(validatePinRow({ ...pinRow, created_by: "" }, NOW)).toBeNull();
    const long = "x".repeat(coreConfig.map.PIN_LABEL_MAX_LENGTH + 9);
    expect(validatePinRow({ ...pinRow, label: long }, NOW)?.label).toHaveLength(
      coreConfig.map.PIN_LABEL_MAX_LENGTH,
    );
  });
});

describe("fetchMapState", () => {
  it("returns validated survivors and skips hostile rows without crashing the pull", async () => {
    mock.capture.beaconSelect = {
      data: [beaconRow, { ...beaconRow, user_id: "me" }, { junk: true }],
      error: null,
    };
    mock.capture.pinSelect = { data: [pinRow, null], error: null };
    const state = await fetchMapState("me", NOW);
    expect(state?.beacons.map((b) => b.memberId)).toEqual(["friend-1"]);
    expect(state?.pins.map((p) => p.pinId)).toEqual(["p1"]);
  });

  it("returns null (keep last-synced Dexie state) when either select fails", async () => {
    mock.capture.beaconSelect = { data: null, error: { message: "boom" } };
    mock.capture.pinSelect = { data: [], error: null };
    expect(await fetchMapState("me", NOW)).toBeNull();
  });
});

describe("write primitives (WR-02: the returned { error } is READ)", () => {
  it("upsertOwnBeacon maps to snake_case columns keyed on user_id", async () => {
    mock.capture.upsertResult = { error: null };
    const ok = await upsertOwnBeacon({
      userId: "me",
      displayName: "Max",
      lat: 1,
      lng: 2,
      accuracyM: null,
      status: null,
      avatar: "🦎",
      updatedAt: NOW,
    });
    expect(ok).toBe(true);
    expect(mock.upsertSpy).toHaveBeenLastCalledWith(
      {
        user_id: "me",
        display_name: "Max",
        lat: 1,
        lng: 2,
        accuracy_m: null,
        status: null,
        avatar: "🦎",
        updated_at: new Date(NOW).toISOString(),
      },
      { onConflict: "user_id" },
    );
  });

  it("upsertOwnBeacon returns false on an RLS/4xx error instead of resolving silently", async () => {
    mock.capture.upsertResult = { error: { message: "rls" } };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      await upsertOwnBeacon({
        userId: "me",
        displayName: "Max",
        lat: 1,
        lng: 2,
        accuracyM: null,
        status: null,
        avatar: null,
        updatedAt: NOW,
      }),
    ).toBe(false);
    warn.mockRestore();
    mock.capture.upsertResult = { error: null };
  });

  it("insertPin uses ignoreDuplicates so a retry after an unmarked success is idempotent", async () => {
    await insertPin({
      pinId: "p9",
      createdBy: "me",
      createdByName: "Max",
      label: "Rail",
      lat: 1,
      lng: 2,
      createdAt: NOW,
    });
    expect(mock.upsertSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ pin_id: "p9", created_by: "me" }),
      { onConflict: "pin_id", ignoreDuplicates: true },
    );
  });

  it("deletePinRemote deletes by pin_id", async () => {
    expect(await deletePinRemote("p9")).toBe(true);
    expect(mock.eqSpy).toHaveBeenCalledWith("pin_id", "p9");
  });
});

describe("subscribeMapChanges", () => {
  it("registers '*' postgres_changes on BOTH map tables and relays events", () => {
    mock.capture.onFilters = [];
    let fired = 0;
    subscribeMapChanges(() => {
      fired += 1;
    });
    expect(mock.channelSpy).toHaveBeenCalledWith("map-feed");
    expect(mock.capture.onFilters).toEqual([
      { event: "*", schema: "public", table: "map_beacons" },
      { event: "*", schema: "public", table: "map_pins" },
    ]);
    mock.capture.onChange?.();
    expect(fired).toBe(1);
  });
});

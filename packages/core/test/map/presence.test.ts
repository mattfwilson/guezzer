import { describe, expect, it } from "vitest";
import { config } from "../../src/config.ts";
import {
  ageLabel,
  describeOffset,
  friendBeaconSchema,
  meetPinSchema,
  shouldPublishBeacon,
  stalenessTier,
} from "../../src/map/presence.ts";

const NOW = 1_800_000_000_000; // fixed epoch — `now` is always a parameter (zero Date.now in core)

describe("stalenessTier", () => {
  it("buckets ages against the config.map thresholds (inclusive lower bounds)", () => {
    expect(stalenessTier(NOW, NOW)).toBe("fresh");
    expect(stalenessTier(NOW - (config.map.STALE_FRESH_MAX_MS - 1), NOW)).toBe("fresh");
    expect(stalenessTier(NOW - config.map.STALE_FRESH_MAX_MS, NOW)).toBe("recent");
    expect(stalenessTier(NOW - (config.map.STALE_RECENT_MAX_MS - 1), NOW)).toBe("recent");
    expect(stalenessTier(NOW - config.map.STALE_RECENT_MAX_MS, NOW)).toBe("stale");
    expect(stalenessTier(NOW - config.map.STALE_GONE_AFTER_MS, NOW)).toBe("gone");
  });
});

describe("ageLabel", () => {
  it("renders now / minutes / hours and clamps clock-skewed future stamps to 'now'", () => {
    expect(ageLabel(NOW - 30_000, NOW)).toBe("now");
    expect(ageLabel(NOW - 4 * 60_000, NOW)).toBe("4 min ago");
    expect(ageLabel(NOW - 2 * 3_600_000 - 60_000, NOW)).toBe("2 h ago");
    expect(ageLabel(NOW + 60_000, NOW)).toBe("now"); // a friend's fast clock must not render "-1 min ago"
  });
});

describe("describeOffset", () => {
  it("yields the '~120m NE' substrate: meters + bearing + compass", () => {
    // ~0.001° N and ~0.001° E of the venue → NE, ~140m at this latitude
    const offset = describeOffset(
      { lat: 38.843, lng: -106.156 },
      { lat: 38.844, lng: -106.1547 },
    );
    expect(offset.compass).toBe("NE");
    expect(offset.meters).toBeGreaterThan(120);
    expect(offset.meters).toBeLessThan(180);
  });
});

describe("shouldPublishBeacon", () => {
  const at = { lat: 38.843, lng: -106.156 };
  const last = { at, publishedAtMs: NOW - 10_000, status: null, avatar: null };
  const still = { at, nowMs: NOW, status: null, avatar: null };

  it("always publishes a first fix", () => {
    expect(shouldPublishBeacon({ last: null, next: still })).toBe(true);
  });

  it("suppresses when neither time nor distance gate passes", () => {
    expect(shouldPublishBeacon({ last, next: still })).toBe(false);
  });

  it("publishes after the min interval even without movement", () => {
    expect(
      shouldPublishBeacon({
        last,
        next: { ...still, nowMs: NOW + config.map.BEACON_MIN_INTERVAL_MS },
      }),
    ).toBe(true);
  });

  it("publishes on sufficient movement even inside the interval", () => {
    const moved = { lat: at.lat + 0.0005, lng: at.lng }; // ~55m north
    expect(shouldPublishBeacon({ last, next: { ...still, at: moved } })).toBe(true);
  });

  it("publishes IMMEDIATELY on a status change (a check-in must land now)", () => {
    expect(shouldPublishBeacon({ last, next: { ...still, status: "At the rail" } })).toBe(true);
  });

  it("publishes IMMEDIATELY on an avatar change (identity edits land now)", () => {
    expect(shouldPublishBeacon({ last, next: { ...still, avatar: "🐊" } })).toBe(true);
  });
});

describe("plaintext schemas (ASVS V5 clamps on friend-crossing strings)", () => {
  it("rejects an over-length status and accepts a valid beacon", () => {
    const beacon = {
      memberId: "m1",
      name: "Max",
      lat: 38.843,
      lng: -106.156,
      accuracyM: 12,
      status: null,
      avatar: "🐊",
      updatedAt: NOW,
    };
    expect(friendBeaconSchema.safeParse(beacon).success).toBe(true);
    expect(
      friendBeaconSchema.safeParse({
        ...beacon,
        status: "x".repeat(config.map.STATUS_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it("fills avatar=null for pre-avatar beacons (crew update-window tolerance)", () => {
    const legacy = {
      memberId: "m1",
      name: "Max",
      lat: 38.843,
      lng: -106.156,
      accuracyM: 12,
      status: null,
      updatedAt: NOW,
    };
    const parsed = friendBeaconSchema.safeParse(legacy);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.avatar).toBeNull();
    expect(
      friendBeaconSchema.safeParse({ ...legacy, avatar: "x".repeat(9) }).success,
    ).toBe(false);
  });

  it("rejects a pin with an empty label or out-of-range coordinate", () => {
    const pin = {
      pinId: "p1",
      createdBy: "Max",
      label: "Meet after encore",
      lat: 38.843,
      lng: -106.156,
      createdAt: NOW,
    };
    expect(meetPinSchema.safeParse(pin).success).toBe(true);
    expect(meetPinSchema.safeParse({ ...pin, label: "" }).success).toBe(false);
    expect(meetPinSchema.safeParse({ ...pin, lat: 91 }).success).toBe(false);
  });
});

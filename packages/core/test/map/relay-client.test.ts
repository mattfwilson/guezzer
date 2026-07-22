import { describe, expect, it } from "vitest";
import {
  deletePin,
  fetchGroupState,
  publishBeacon,
} from "../../src/map/relay-client.ts";
import type { RelayDeps } from "../../src/map/relay-client.ts";

const TOKEN = "a".repeat(64);

function depsWith(fetchFn: RelayDeps["fetch"]): RelayDeps {
  return { fetch: fetchFn, baseUrl: "https://relay.test", token: TOKEN };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("publishBeacon", () => {
  it("PUTs the envelope to the token-scoped path and returns true on ok", async () => {
    let seenUrl = "";
    let seenBody = "";
    const deps = depsWith(async (url, init) => {
      seenUrl = String(url);
      seenBody = String(init?.body);
      return new Response(null, { status: 204 });
    });
    const ok = await publishBeacon(deps, { memberId: "m1", iv: "aXY=", data: "ZGF0YQ==" });
    expect(ok).toBe(true);
    expect(seenUrl).toBe(`https://relay.test/g/${TOKEN}/beacon`);
    expect(JSON.parse(seenBody)).toEqual({ memberId: "m1", iv: "aXY=", data: "ZGF0YQ==" });
  });

  it("returns false (never throws) on network reject and non-OK status", async () => {
    expect(
      await publishBeacon(depsWith(async () => Promise.reject(new Error("offline"))), {
        memberId: "m1",
        iv: "aXY=",
        data: "ZGF0YQ==",
      }),
    ).toBe(false);
    expect(
      await publishBeacon(depsWith(async () => new Response(null, { status: 500 })), {
        memberId: "m1",
        iv: "aXY=",
        data: "ZGF0YQ==",
      }),
    ).toBe(false);
  });
});

describe("deletePin", () => {
  it("URL-encodes the pin id into the DELETE path", async () => {
    let seenUrl = "";
    const deps = depsWith(async (url) => {
      seenUrl = String(url);
      return new Response(null, { status: 204 });
    });
    await deletePin(deps, "pin/../weird id");
    expect(seenUrl).toBe(`https://relay.test/g/${TOKEN}/pin/pin%2F..%2Fweird%20id`);
  });
});

describe("fetchGroupState", () => {
  const validState = {
    beacons: [{ memberId: "m1", iv: "aXY=", data: "ZGF0YQ==", receivedAt: 1_800_000_000_000 }],
    pins: [],
  };

  it("returns validated state on a well-formed response", async () => {
    const state = await fetchGroupState(depsWith(async () => jsonResponse(validState)));
    expect(state).toEqual(validState);
  });

  it("returns null on non-OK, malformed shape, and network reject — degrade to last-synced Dexie state", async () => {
    expect(await fetchGroupState(depsWith(async () => jsonResponse(validState, 502)))).toBeNull();
    expect(
      await fetchGroupState(depsWith(async () => jsonResponse({ beacons: [{ nope: 1 }], pins: [] }))),
    ).toBeNull();
    expect(
      await fetchGroupState(depsWith(async () => Promise.reject(new Error("timeout")))),
    ).toBeNull();
  });
});

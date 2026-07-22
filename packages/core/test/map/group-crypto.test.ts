import { describe, expect, it } from "vitest";
import { config } from "../../src/config.ts";
import {
  decryptJson,
  deriveGroupKeys,
  encryptJson,
} from "../../src/map/group-crypto.ts";

const OPTS = {
  iterations: 1_000, // reduced from config's 100k for test speed — same code path
  salt: config.map.KEY_DERIVE_SALT,
};

describe("deriveGroupKeys", () => {
  it("is deterministic per secret — the join mechanism", async () => {
    const a = await deriveGroupKeys("gizz-fov-2026", OPTS);
    const b = await deriveGroupKeys("gizz-fov-2026", OPTS);
    expect(a.token).toBe(b.token);
    expect(a.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("different secrets → different tokens AND mutually undecryptable keys", async () => {
    const a = await deriveGroupKeys("our-group", OPTS);
    const b = await deriveGroupKeys("not-our-group", OPTS);
    expect(a.token).not.toBe(b.token);

    const envelope = await encryptJson(a.key, { hello: "gizz" });
    expect(await decryptJson(b.key, envelope)).toBeNull(); // GCM auth failure → tolerant null
  });
});

describe("encryptJson / decryptJson", () => {
  it("round-trips a beacon-shaped value", async () => {
    const { key } = await deriveGroupKeys("s3cret-gizz", OPTS);
    const value = {
      memberId: "m1",
      name: "Max",
      lat: 38.843,
      lng: -106.156,
      accuracyM: null,
      status: "At the rail",
      updatedAt: 1_800_000_000_000,
    };
    const envelope = await encryptJson(key, value);
    expect(envelope.iv).not.toBe("");
    expect(envelope.data).not.toContain("Max"); // ciphertext, not plaintext-in-base64
    expect(await decryptJson(key, envelope)).toEqual(value);
  });

  it("fresh IV per message — identical plaintexts yield different ciphertexts", async () => {
    const { key } = await deriveGroupKeys("s3cret-gizz", OPTS);
    const e1 = await encryptJson(key, { v: 1 });
    const e2 = await encryptJson(key, { v: 1 });
    expect(e1.iv).not.toBe(e2.iv);
    expect(e1.data).not.toBe(e2.data);
  });

  it("returns null (never throws) on garbage envelopes", async () => {
    const { key } = await deriveGroupKeys("s3cret-gizz", OPTS);
    expect(await decryptJson(key, { iv: "!!!", data: "???" })).toBeNull();
    expect(await decryptJson(key, { iv: "AAAAAAAAAAAAAAAA", data: "AAAA" })).toBeNull();
  });
});
